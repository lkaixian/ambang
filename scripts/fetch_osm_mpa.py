"""Count OSM tourist accommodation near each Coral Triangle Atlas MPA point not already in fetch_open_apis.BOXES.
Writes data/osm_accommodation_mpa.csv. Box = point +/- 0.04 deg (about 4.5 km), so parks larger than 30,000 ha are skipped:
their Atlas point is the centre of a sea area and a box around it says nothing about the islands.
Run: python scripts/fetch_osm_mpa.py   (Overpass is slow and rate-limited; the script retries)"""
import pathlib
import time

import pandas as pd
import requests

DATA = pathlib.Path(__file__).parent.parent / "data"
UA = {"User-Agent": "AMBANG-datathon/1.0 (research)"}
HALF = 0.04
Q = 'nwr["tourism"~"hotel|guest_house|hostel|chalet|resort|apartment|motel|camp_site"]({s},{w},{n},{e});out tags center;'

df = pd.read_csv(DATA / "atlas_raw" / "mpalist_mys.csv", encoding="utf-8-sig")
rows = []
for _, r in df[df.AREA_R_HA <= 30000].iterrows():
    s, w, n, e = r.LAT - HALF, r.LON - HALF, r.LAT + HALF, r.LON + HALF
    for _ in range(4):
        try:
            x = requests.post("https://overpass-api.de/api/interpreter", data={"data": "[out:json][timeout:50];" + Q.format(s=s, w=w, n=n, e=e)}, headers=UA, timeout=70)
            if x.ok and x.headers.get("content-type", "").startswith("application/json"):
                break
        except requests.RequestException:
            pass
        time.sleep(10)
    else:
        print("gave up on", r.NAME)
        continue
    els = x.json()["elements"]
    rooms = sum(int(t["tags"]["rooms"]) for t in els if str(t["tags"].get("rooms", "")).isdigit())
    rows.append({"atlas_name": r.NAME, "accommodation_features": len(els), "rooms_tagged": rooms,
                 "south": round(s, 4), "west": round(w, 4), "north": round(n, 4), "east": round(e, 4)})
    print(r.NAME, len(els), flush=True)
    time.sleep(3)
pd.DataFrame(rows).to_csv(DATA / "osm_accommodation_mpa.csv", index=False)
