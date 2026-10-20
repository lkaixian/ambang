"""Fetch real per-destination signals from open, keyless APIs. Writes CSVs to data/.

  1. Sabah Parks public dashboard JSON  -> data/sabah_parks_visitors.csv   (annual visitors per park, 2020-)
  2. OpenStreetMap (Overpass API)       -> data/osm_accommodation.csv      (tourist accommodation features per area)
  3. Wikimedia pageviews REST API       -> data/wiki_pageviews_monthly.csv (monthly article views = public attention)
  4. Tourism Malaysia occupancy by state (archive.data.gov.my) -> data/occupancy_state.csv
  5. LADA statistics page (Langkawi arrivals per year)        -> data/lada_visitors.csv
  6. Sabah Parks Mount Kinabalu planning JSON (climbers/month, 2023-25 average) -> data/kinabalu_climbers_monthly.csv

Caveats the numbers carry: OSM is volunteer-mapped, so counts are lower bounds and uneven between places; the area boxes
below are hand-set rectangles that can include a little mainland. Pageviews measure attention, not visits. Sabah Parks
counts are per park, a different unit from the Marine Park Malaysia per-state series used for the Peninsula islands.

Usage: python scripts/fetch_open_apis.py
"""
import io
import pathlib
import re
import time
import urllib.parse

import pandas as pd
import requests

DATA = pathlib.Path(__file__).parent.parent / "data"
UA = {"User-Agent": "AMBANG-datathon/1.0 (research prototype; lkaixian91@gmail.com)"}

SABAH_PARKS = {"Tunku Abdul Rahman Park": "tunku-abdul-rahman-park", "Sipadan / Mabul": "sipadan-island-park", "Kinabalu / Kundasang": "kinabalu-park",
               "Pulau Tiga": "pulau-tiga-park", "Tun Sakaran": "tun-sakaran-marine-park", "Turtle Islands": "turtle-islands-park"}

# destination -> (south, west, north, east) rectangle for OSM accommodation counts
BOXES = {
    "Perhentian": (5.85, 102.70, 5.95, 102.78), "Redang": (5.72, 102.97, 5.84, 103.07), "Lang Tengah": (5.77, 102.86, 5.84, 102.93),
    "Kapas": (5.19, 103.24, 5.24, 103.29), "Tioman": (2.70, 104.10, 2.95, 104.25), "Sibu": (2.19, 104.03, 2.26, 104.10),
    "Tinggi": (2.26, 104.08, 2.34, 104.16), "Besar": (2.40, 103.95, 2.50, 104.03), "Rawa": (2.50, 103.94, 2.57, 104.02),
    "Cameron Highlands": (4.35, 101.30, 4.60, 101.55), "Langkawi": (6.15, 99.60, 6.50, 99.95), "Pangkor": (4.18, 100.52, 4.27, 100.62),
    "Fraser's Hill": (3.69, 101.72, 3.73, 101.76), "Sipadan / Mabul": (4.22, 118.60, 4.27, 118.66),
    "Tunku Abdul Rahman Park": (5.95, 115.98, 6.05, 116.08), "Kinabalu / Kundasang": (5.95, 116.52, 6.12, 116.62),
}
# destination -> Wikipedia article titles per language. Malaysians read and search in Malay ("Pulau Redang"), so English alone
# undercounts local interest badly; both are fetched and summed. Titles that are ambiguous in Malay (Pulau Besar, Pulau Rawa) are left out.
WIKI = {
    "Perhentian": {"en": ["Perhentian_Islands"], "ms": ["Pulau_Perhentian", "Pulau_Perhentian_Besar", "Pulau_Perhentian_Kecil"]},
    "Redang": {"en": ["Redang_Island"], "ms": ["Pulau_Redang"]},
    "Lang Tengah": {"en": [], "ms": ["Pulau_Lang_Tengah"]},
    "Kapas": {"en": ["Kapas_Island"], "ms": ["Pulau_Kapas"]},
    "Tioman": {"en": ["Tioman_Island"], "ms": ["Pulau_Tioman"]},
    "Payar": {"en": ["Pulau_Payar_Marine_Park"], "ms": ["Pulau_Payar"]},
    "Sibu": {"en": ["Sibu_Island"], "ms": ["Pulau_Sibu"]},
    "Tinggi": {"en": ["Tinggi_Island"], "ms": ["Pulau_Tinggi"]},
    "Cameron Highlands": {"en": ["Cameron_Highlands"], "ms": ["Tanah_Tinggi_Cameron"]},
    "Langkawi": {"en": ["Langkawi"], "ms": ["Langkawi"]},
    "Pangkor": {"en": ["Pangkor_Island"], "ms": ["Pulau_Pangkor"]},
    "Fraser's Hill": {"en": ["Fraser's_Hill"], "ms": ["Bukit_Fraser"]},
    "Sipadan / Mabul": {"en": ["Sipadan"], "ms": ["Pulau_Sipadan"]},
    "Tunku Abdul Rahman Park": {"en": ["Tunku_Abdul_Rahman_Park"], "ms": ["Taman_Tunku_Abdul_Rahman"]},
}


def sabah_parks():
    rows = []
    for dest, slug in SABAH_PARKS.items():
        r = requests.get(f"https://dashboard.sabahparks.org.my/dashboard/parks/{slug}/data", headers={**UA, "Accept": "application/json"}, timeout=40)
        r.raise_for_status()
        a = r.json()["annual"]
        for y, t, i in zip(a["categories"], a["total"], a["international"]):
            rows.append({"destination": dest, "year": y, "visitors": t, "international": i, "source": f"Sabah Parks public dashboard ({slug})"})
    pd.DataFrame(rows).to_csv(DATA / "sabah_parks_visitors.csv", index=False)
    return len(rows)


def osm():
    rows = []
    q = 'nwr["tourism"~"hotel|guest_house|hostel|chalet|resort|apartment|motel|camp_site"]({s},{w},{n},{e});out tags center;'
    for dest, (s, w, n, e) in BOXES.items():
        for attempt in range(3):
            r = requests.post("https://overpass-api.de/api/interpreter", data={"data": "[out:json][timeout:50];" + q.format(s=s, w=w, n=n, e=e)}, headers=UA, timeout=70)
            if r.ok and r.headers.get("content-type", "").startswith("application/json"):
                break
            time.sleep(10)
        else:
            print("  OSM gave up on", dest)
            continue
        els = r.json()["elements"]
        beds = sum(int(x["tags"]["beds"]) for x in els if str(x["tags"].get("beds", "")).isdigit())
        rooms = sum(int(x["tags"]["rooms"]) for x in els if str(x["tags"].get("rooms", "")).isdigit())
        rows.append({"destination": dest, "accommodation_features": len(els), "with_rooms_tag": sum(1 for x in els if "rooms" in x["tags"]),
                     "rooms_tagged": rooms, "beds_tagged": beds, "south": s, "west": w, "north": n, "east": e})
        time.sleep(3)
    pd.DataFrame(rows).to_csv(DATA / "osm_accommodation.csv", index=False)
    return len(rows)


def wiki():
    """Monthly pageviews per article, English and Malay. The API throttles bursts (HTTP 429), so requests are spaced and retried."""
    rows = []
    for dest, langs in WIKI.items():
        for lang, arts in langs.items():
            for art in arts:
                url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{lang}.wikipedia/all-access/user/{urllib.parse.quote(art)}/monthly/20160101/20251231"
                for wait in (10, 30, 60, None):
                    r = requests.get(url, headers=UA, timeout=40)
                    if r.status_code != 429 or wait is None:
                        break
                    time.sleep(wait)
                if not r.ok:
                    print(f"  wiki missing: {dest} {lang}:{art} ({r.status_code})")
                    continue
                for it in r.json()["items"]:
                    rows.append({"destination": dest, "lang": lang, "article": art, "month": it["timestamp"][:6], "views": it["views"]})
                time.sleep(1.5)
    pd.DataFrame(rows).to_csv(DATA / "wiki_pageviews_monthly.csv", index=False)
    return len(rows)


def occupancy():
    url = "https://archive.data.gov.my/data/dataset/28b0ef10-c84b-4667-a1f7-f4797e91f5c9/resource/b15a3720-9c70-4aa7-8c65-912ee9077d42/download/_202306010434400_2015-2022-malaysia-average-occupancy-rates-by-state.csv"
    r = requests.get(url, headers=UA, timeout=40)
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.content.decode("utf-8", errors="replace")))
    df.to_csv(DATA / "occupancy_state.csv", index=False)
    return len(df)


def lada():
    """LADA's own statistics page lists total visitor arrivals per year (jetty, cruise, yacht, airport, port touchpoints)."""
    r = requests.get("https://www.lada.gov.my/en/statistics", headers=UA, timeout=40)
    r.raise_for_status()
    pairs = re.findall(r'font-weight: bold;">(20\d\d)</span>.{0,900}?<h2[^>]*>([\d,]+)</h2>', r.text, flags=re.S)
    rows = [{"destination": "Langkawi", "year": int(y), "arrivals": int(v.replace(",", "")), "note": "year to date" if int(y) == pd.Timestamp.today().year else "full year",
             "source": "LADA statistics page"} for y, v in pairs]
    pd.DataFrame(rows).to_csv(DATA / "lada_visitors.csv", index=False)
    return len(rows)


def kinabalu_monthly():
    r = requests.get("https://dashboard.sabahparks.org.my/dashboard/mount-kinabalu-data/planning", headers={**UA, "Accept": "application/json"}, timeout=40)
    r.raise_for_status()
    j = r.json()
    rows = [{"month": m["month"], "name": m["name"], "climbers_avg": m["average_total"], "benchmark": j["summary"]["benchmark_label"]} for m in j["monthly"]]
    pd.DataFrame(rows).to_csv(DATA / "kinabalu_climbers_monthly.csv", index=False)
    return len(rows)


if __name__ == "__main__":
    for fn in (sabah_parks, osm, wiki, occupancy, lada, kinabalu_monthly):
        try:
            print(f"{fn.__name__}: {fn()} rows")
        except Exception as e:
            print(f"{fn.__name__}: FAILED {type(e).__name__}: {e}")
