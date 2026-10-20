"""Pull real, machine-readable open-data series for AMBANG's 5 destinations.

Only fetches datasets whose OpenDOSM/data.gov.my catalogue ID has actually been
confirmed (see SOURCES below). Hotel occupancy, MyTAS accommodation stock, and
rainfall remain unconfirmed/PDF-only per the 2026-09-17 research pass (see
progress.md) -- don't guess a URL for those.

Usage: python scripts/fetch_open_data.py
"""
import csv
import io
import pathlib

import pandas as pd
import requests

DATA_DIR = pathlib.Path(__file__).parent.parent / "data"

# destination -> (state, district-or-None). District is only used for the one
# destination (Cameron Highlands) where AMBANG tracks district-level data.
DESTINATIONS = {
    "Terengganu marine parks": ("Terengganu", None),
    "Cameron Highlands": ("Pahang", "Cameron Highlands"),
    "Pahang marine parks": ("Pahang", None),
    "Kedah marine parks": ("Kedah", None),
    "Johor marine parks": ("Johor", None),
    # Sabah additions: district-level where the source has districts, state-level otherwise.
    "Sipadan / Mabul": ("Sabah", "Semporna"),
    "Tunku Abdul Rahman Park": ("Sabah", "Kota Kinabalu"),
    "Kinabalu / Kundasang": ("Sabah", "Ranau"),
    # West Malaysia and Sarawak additions
    "Langkawi": ("Kedah", "Langkawi"),
    "Pangkor": ("Perak", "Manjung"),
    "Fraser's Hill": ("Pahang", "Raub"),
    "Miri": ("Sarawak", "Miri"),
    # Gazetted districts of the other federal marine parks (Department of Marine Park Malaysia list, archive.data.gov.my "taman-laut-terengganu").
    # Kuala Terengganu is left out: the 1994 gazette says Kuala Terengganu for Redang and neighbours, but the district has since been split.
    "Besut parks": ("Terengganu", "Besut"), "Dungun parks": ("Terengganu", "Dungun"), "Rompin parks": ("Pahang", "Rompin"),
    "Mersing parks": ("Johor", "Mersing"), "Kota Setar parks": ("Kedah", "Kota Setar"),
}

# Confirmed dataset_id -> storage URL. Verified against the live catalogue --
# see progress.md for the date/method of each.
SOURCES = {
    "population_district": "https://storage.dosm.gov.my/population/population_district.parquet",
    # State-level CPI (13 groups) -- socioeconomic cost-of-living pressure proxy.
    "cpi_state": "https://storage.dosm.gov.my/cpi/cpi_2d_state.parquet",
    # District-level mean/median household income, Gini, poverty (2019-2024) --
    # the new socioeconomic pressure factor: resident income relative to
    # tourism-driven cost/visitor pressure.
    "hh_income_district": "https://storage.dosm.gov.my/hies/hh_income_district.parquet",
    # District-level labour force stats -- tourism employment absorption proxy.
    # Only 140/160 districts covered (remote-area data gaps, per DOSM).
    "lfs_district": "https://storage.dosm.gov.my/labour/lfs_district.parquet",
    # State-level water production/consumption/access (data.gov.my, not DOSM).
    # production - consumption is a genuine "water headroom" candidate for
    # the dashboard's currently-placeholder "Water headroom" capacity
    # indicator -- see progress.md for the proposed design, not wired in yet.
    "water_production": "https://storage.data.gov.my/water/water_production.parquet",
    "water_consumption": "https://storage.data.gov.my/water/water_consumption.parquet",
    "water_access": "https://storage.data.gov.my/water/water_access.parquet",
    # District-level % of households with piped water, sanitation, electricity (2016-2024). Found in the 2026-10 full-catalogue sweep.
    "hh_access_amenities": "https://storage.dosm.gov.my/hies/hh_access_amenities.parquet",
    # District GDP by sector, 2015-2020 only (p0 total, p5 services). Shows how service-dependent the district economy is.
    "gdp_district_real_supply": "https://storage.dosm.gov.my/gdp/gdp_district_real_supply.parquet",
}

# Deliberately NOT added: data.gov.my's arrivals_soe (monthly foreign
# arrivals by state of entry). It's real and machine-readable, but Johor's
# figure is dominated by Johor-Singapore land-border crossings (~17.7M/yr
# vs Kedah's 828K and Terengganu's <100), not marine-park tourism -- using
# it as a visitor-pressure proxy would misrepresent Johor's islands as the
# worst foreign-visitor pressure in the dataset. See progress.md.

# Marine park visitor counts (domestic + foreign), by state, 2000-2017.
# Confirmed 2026-09-22: NOT on OpenDOSM or DOF's own site (both checked in the
# 2026-09-17 pass and came up empty) but live on the legacy CKAN portal
# archive.data.gov.my under publisher "Department of Marine Park Malaysia".
# Direct CSV download, not a parquet dataset_id -- different shape from
# SOURCES above, so fetched/tidied separately. See progress.md.
MARINE_PARK_VISITOR_URLS = {
    "Terengganu marine parks": "https://archive.data.gov.my/data/dataset/71412cd0-7849-4186-bec8-d6374999a80d/resource/98daeda2-1465-4306-ba5e-b2a0fa141034/download/senarai-pelancong-ke-taman-laut-terengganu-dari-2000-2017.csv",
    "Pahang marine parks": "https://archive.data.gov.my/data/dataset/63accf7b-0548-4227-9cec-1b39d547860a/resource/adec1dcb-0e6b-4948-9b4a-e13affda75f8/download/senarai-pelancong-ke-taman-laut-pahang-dari-2000-2017.csv",
    "Kedah marine parks": "https://archive.data.gov.my/data/dataset/3f856857-413e-4ef5-93f6-7d391e787c98/resource/1daa3fed-6f6f-47c8-9201-aa3939e9f566/download/senarai-pelancong-ke-taman-laut-kedah-dari-2000-2017.csv",
    "Johor marine parks": "https://archive.data.gov.my/data/dataset/407f5909-fff1-4c57-98af-23d5fff10009/resource/c97e1ec3-f5b1-4be3-bf8b-aabcb931a275/download/senarai-pelancong-ke-taman-laut-johor-dari-2000-2017.csv",
}


def fetch_marine_park_visitors() -> pd.DataFrame:
    """Each state's CSV is a hand-formatted CKAN export: a 2-row header, then
    (year, "TEMPATAN"/domestic, count, year-total) / (blank, "LUAR NEGARA"/
    foreign, count, blank) row pairs, then non-data footer rows (JUMLAH.../%).
    Parse defensively: keep only rows whose first cell is a 4-digit year.
    """
    rows = []
    for dest, url in MARINE_PARK_VISITOR_URLS.items():
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        raw = resp.content.decode("cp1252", errors="replace")
        year = None
        for cells in csv.reader(io.StringIO(raw)):
            cells = [c.strip() for c in cells]
            if len(cells) < 3:
                continue
            if cells[0].isdigit() and len(cells[0]) == 4:
                year = int(cells[0])
            if year is None or cells[1] not in ("TEMPATAN", "LUAR NEGARA"):
                continue
            count = cells[2].replace(",", "")
            if not count.isdigit():
                continue
            rows.append({
                "destination": dest, "year": year,
                "visitor_type": "domestic" if cells[1] == "TEMPATAN" else "foreign",
                "count": int(count),
            })
            if cells[1] == "LUAR NEGARA":
                year = None  # each year's pair is consumed; guard against footer rows
    return pd.DataFrame(rows)


# Solid-waste facility counts by state and type, current through 2020.
# Confirmed 2026-09-22 on archive.data.gov.my (publisher: SWCorp) -- a
# facility-count directory, not tonnage/capacity, but real and state-level
# for all 4 marine states. See progress.md.
WASTE_FACILITIES_URL = "https://archive.data.gov.my/data/dataset/a30d97ce-2a0c-41ac-8f68-d4e9192e97f6/resource/387a09fc-ab90-48e5-a211-0ecf34ae2687/download/_202202161131050_281.-swcorp_kemudahan-dibawah-seliaan-swcorp.csv"

STATE_TO_DEST = {
    "TERENGGANU": "Terengganu marine parks",
    "PAHANG": "Pahang marine parks",
    "KEDAH": "Kedah marine parks",
    "JOHOR": "Johor marine parks",
    "PERAK": "Perak",  # SWCorp also covers Perak; used for Pangkor
}


def fetch_waste_facilities() -> pd.DataFrame:
    resp = requests.get(WASTE_FACILITIES_URL, timeout=30)
    resp.raise_for_status()
    raw = resp.content.decode("cp1252", errors="replace")
    df = pd.read_csv(io.StringIO(raw))
    df = df.rename(columns={df.columns[0]: "facility_type"})
    rows = []
    for state_col, dest in STATE_TO_DEST.items():
        for _, r in df.iterrows():
            rows.append({
                "destination": dest,
                "facility_type": r["facility_type"].strip(),
                "count": int(r[state_col]),
            })
    return pd.DataFrame(rows)


# Live coral cover, per site, from Reef Check Malaysia's own interactive-map
# GeoJSON (not a PDF -- confirmed 2026-09-22, see progress.md). Covers 13 of
# AMBANG's 14 tracked islands (Tulai has no matching site in this dataset).
REEF_CHECK_MAP_URL = "https://reefcheck.org.my/wp-content/plugins/mapbox-builder/public/assets/interactive-map.geojson"

# island -> ("location", locationName) uses that location's own trend series
# (already an average across its sites); ("site", title) uses one site's own
# surveyData (for islands sharing a locationName with others, e.g. Kaca/Lembu
# both roll up to "Payar", Sembilang to "Seri Buat" -- the shared location
# trend would blend in sites this island isn't).
REEF_ISLAND_LOOKUP = {
    "Perhentian": ("location", "Perhentian"), "Redang": ("location", "Redang"),
    "Lang Tengah": ("location", "Lang Tengah"), "Kapas": ("location", "Kapas"),
    "Tioman": ("location", "Tioman"), "Sembilang": ("site", "Sembilang"),
    "Payar": ("location", "Payar"), "Lembu": ("site", "Lembu"), "Kaca": ("site", "Kaca"),
    "Sibu": ("location", "Sibu"), "Tinggi": ("location", "Tinggi"),
    "Besar": ("location", "Pulau Besar"), "Rawa": ("location", "Rawa"),
    # Sabah: Reef Check surveys these; Sipadan and Mabul are averaged later in build_pending.py
    "Sipadan": ("location", "Sipadan"), "Mabul": ("location", "Mabul"),
    "Tunku Abdul Rahman Park": ("location", "Tunku Abdul Rahman Park"),
    # Langkawi's reef site is Pulau Singa Besar; Pangkor and Miri are Reef Check locations
    "Pulau Singa Besar": ("location", "P Singa"), "Pangkor": ("location", "Pangkor"), "Miri": ("location", "Miri"),
    # Atlas MPAs added to the map later; keys are the pin names from build_pending.atlas_parks(). Each Reef Check location was matched
    # to the Atlas point by distance (all within 7 km). Labuan is one location covering three parks, so the three share a value.
    "Pulau Aur": ("location", "Aur/Dayang"), "Pulau Gual": ("location", "Gual"), "Harimau": ("location", "Harimau"),
    "Babi Hujong": ("location", "Hujung"), "Babi Tengah": ("location", "Tengah"), "Mensirip": ("location", "Mensirip"),
    "Pemanggil": ("location", "Pemanggil"), "Seri Buat": ("location", "Seri Buat"), "Tenggol": ("location", "Tenggol"),
    "Pulau Tiga": ("location", "Pulau Tiga"), "Turtle Islands": ("location", "Pulau Penyu"),
    "Tun Sakaran": ("location", "Tun Sakaran Marine Park"), "Tun Mustapha": ("location", "Tun Mustapha Park"),
    "Kuraman": ("location", "Labuan"), "Rusukan Kecil": ("location", "Labuan"), "Rusukan Besar": ("location", "Labuan"),
    "Yu Besar": ("site", "Yu Besar"), "Yu Kecil": ("site", "Yu Kecil"), "Pulau Pinang": ("site", "Pulau Pinang Marine Park"),
    "Pulau Lima": ("site", "Pulau Lima Southern Tip"),
}


def fetch_coral_cover() -> pd.DataFrame:
    resp = requests.get(REEF_CHECK_MAP_URL, timeout=60)
    resp.raise_for_status()
    feats = [f for f in resp.json()["features"] if f["properties"].get("type") == "site"]
    rows = []
    for island, (kind, key) in REEF_ISLAND_LOOKUP.items():
        if kind == "location":
            sites = [f for f in feats if f["properties"].get("locationName") == key]
            trend = sorted(sites[0]["properties"].get("trend") or [], key=lambda t: t["year"], reverse=True)
            for t in trend:
                if t.get("live_coral_cover"):
                    rows.append({"destination": island, "year": int(t["year"]),
                                 "live_coral_cover_pct": float(t["live_coral_cover"])})
                    break
        else:
            site = next(f for f in feats if f["properties"].get("title") == key)
            survey = sorted(site["properties"].get("surveyData") or [], key=lambda s: s["year"], reverse=True)
            for s in survey:
                hc = s["substrate"].get("hard_coral")
                if hc is not None:
                    val = float(hc) + float(s["substrate"].get("soft_coral") or 0)
                    rows.append({"destination": island, "year": int(s["year"]), "live_coral_cover_pct": val})
                    break
    return pd.DataFrame(rows)


LABUAN_2017_URL = ("https://archive.data.gov.my/data/dataset/f0b4a017-6db7-4802-acf5-765e86864001/resource/"
                   "0089cae3-7f16-447d-b4e8-5bda736c941d/download/corak-kunjungan-pelawat-tahun-2017.csv")


def fetch_labuan_2017() -> pd.DataFrame:
    """Labuan marine park visitors, 2017 (Department of Marine Park Malaysia, 'Pelawat Taman Laut Malaysia 2017'): the JUMLAH row, last two columns."""
    resp = requests.get(LABUAN_2017_URL, timeout=60)
    resp.raise_for_status()
    row = next(r for r in csv.reader(io.StringIO(resp.text)) if r and r[0].strip() == "JUMLAH")
    dom, foreign = (int(v.replace(",", "")) for v in row[-2:])
    return pd.DataFrame([{"year": 2017, "visitor_type": "domestic", "count": dom}, {"year": 2017, "visitor_type": "foreign", "count": foreign}])


def fetch_monthly_2017() -> pd.DataFrame:
    """Marine park visitors by month and state, 2017 (same file as the Labuan figure). Real seasonality of actual visits, state level."""
    resp = requests.get(LABUAN_2017_URL, timeout=60)
    resp.raise_for_status()
    rows = [r for r in csv.reader(io.StringIO(resp.text)) if r and r[0].strip() in ("JAN", "FEB", "MAC", "APR", "MEI", "JUN", "JUL", "OGOS", "SEPT", "OKT", "NOV", "DIS")]
    num = lambda x: int(x.replace(",", "")) if x.strip() else 0
    states = {"Terengganu": (1, 2), "Johor": (3, 4), "Kedah": (5, 6), "Pahang": (7, 8), "Labuan": (9, 10)}
    return pd.DataFrame([{"state": st, "month": i + 1, "domestic": num(r[a]), "foreign": num(r[b])} for st, (a, b) in states.items() for i, r in enumerate(rows)])


def fetch(dataset_id: str, url: str) -> pd.DataFrame:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    tmp = DATA_DIR / f"_raw_{dataset_id}.parquet"
    tmp.write_bytes(resp.content)
    df = pd.read_parquet(tmp)
    tmp.unlink()
    return df


def filter_to_destinations(df: pd.DataFrame) -> pd.DataFrame:
    # district naming isn't fully standardised in this dataset ("Cameron
    # Highlands" vs "Cameron Highland") -- normalise before matching. Not
    # every source has a district column (e.g. cpi_state is state-only).
    df = df.copy()
    has_district = "district" in df.columns
    if has_district:
        df["district_norm"] = df["district"].str.replace(
            "Cameron Highland$", "Cameron Highlands", regex=True
        )
    rows = []
    for dest, (state, district) in DESTINATIONS.items():
        if district and has_district:
            mask = (df["state"] == state) & (df["district_norm"] == district)
        else:
            mask = df["state"] == state
        sub = df[mask].copy()
        sub.insert(0, "destination", dest)
        rows.append(sub)
    out = pd.concat(rows, ignore_index=True)
    return out.drop(columns=["district_norm"]) if has_district else out


def main():
    DATA_DIR.mkdir(exist_ok=True)
    for dataset_id, url in SOURCES.items():
        print(f"Fetching {dataset_id} ...")
        df = fetch(dataset_id, url)
        tidy = filter_to_destinations(df)
        out = DATA_DIR / f"{dataset_id}.csv"
        tidy.to_csv(out, index=False)
        print(f"  -> {out} ({len(tidy)} rows)")

    print("Fetching marine_park_visitors ...")
    mpv = fetch_marine_park_visitors()
    out = DATA_DIR / "marine_park_visitors.csv"
    mpv.to_csv(out, index=False)
    print(f"  -> {out} ({len(mpv)} rows)")

    print("Fetching labuan_marine_park_2017 ...")
    fetch_labuan_2017().to_csv(DATA_DIR / "labuan_marine_park_2017.csv", index=False)

    print("Fetching marine_park_monthly_2017 ...")
    fetch_monthly_2017().to_csv(DATA_DIR / "marine_park_monthly_2017.csv", index=False)

    print("Fetching waste_facilities ...")
    wf = fetch_waste_facilities()
    out = DATA_DIR / "waste_facilities.csv"
    wf.to_csv(out, index=False)
    print(f"  -> {out} ({len(wf)} rows)")

    print("Fetching coral_cover ...")
    cc = fetch_coral_cover()
    out = DATA_DIR / "coral_cover.csv"
    cc.to_csv(out, index=False)
    print(f"  -> {out} ({len(cc)} rows)")

    print(
        "\nNot fetched (no machine-readable dataset ID exists, per the "
        "2026-09-17 research pass -- see progress.md): hotel occupancy, "
        "MyTAS accommodation stock, rainfall by station."
    )


if __name__ == "__main__":
    main()
