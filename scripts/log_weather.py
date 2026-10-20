"""Append MET Malaysia's daily forecast for each destination's nearest location to data/weather_log.csv.

Why a logger: the open API (api.data.gov.my/weather/forecast, MET Malaysia) only
serves the current ~7 days and keeps no history, and the open portal's station
dataset is annual only (2000-2021). So the only way to get Malaysian weather
aligned with Google Trends weeks is to record it ourselves, day by day. Run
this daily (Windows Task Scheduler: python scripts/log_weather.py). It is
idempotent: each (location, date) is stored once, and a later run overwrites
the earlier forecast for the same date with the newer one.

This is FORECAST text, not a rain-gauge reading. "rain" is true when the day's
summary forecast mentions rain/thunderstorm (Malay: hujan, ribut petir).
"""
import pathlib

import pandas as pd
import requests

OUT = pathlib.Path(__file__).parent.parent / "data" / "weather_log.csv"
API = "https://api.data.gov.my/weather/forecast"

# MET forecast location nearest each destination (Rc = resort/island locations).
LOCATION = {
    "Perhentian": "Rc007", "Redang": "Rc009", "Lang Tengah": "Rc009", "Kapas": "Rc015",
    "Tioman": "Rc024", "Tulai": "Rc024", "Sembilang": "Rc024",
    "Payar": "Rc001", "Lembu": "Rc001", "Kaca": "Rc001",  # Langkawi, nearest MET location to Pulau Payar
    "Sibu": "Rc025", "Tinggi": "Rc025", "Besar": "Rc025", "Rawa": "Rc025",
    "Cameron Highlands": "Rc008",
    "Sipadan / Mabul": "Rc502", "Tunku Abdul Rahman Park": "Rc511", "Kinabalu / Kundasang": "Rc503",
    "Langkawi": "Rc001", "Pangkor": "Rc005", "Fraser's Hill": "Rc014", "Miri": "Ds537",  # Ds537 = Miri district forecast
}
RAIN_WORDS = ("hujan", "ribut")


def main():
    rows = []
    for loc in sorted(set(LOCATION.values())):
        r = requests.get(API, params={"contains": f"{loc}@location__location_id", "limit": 30}, timeout=30)
        r.raise_for_status()
        for d in r.json():
            summary = d["summary_forecast"].lower()
            rows.append({
                "location_id": loc, "location": d["location"]["location_name"], "date": d["date"],
                "summary": d["summary_forecast"], "min_temp": d["min_temp"], "max_temp": d["max_temp"],
                "rain": any(w in summary and "tiada" not in summary for w in RAIN_WORDS),
            })
    new = pd.DataFrame(rows)
    old = pd.read_csv(OUT) if OUT.exists() else new.iloc[0:0]
    both = pd.concat([old, new]).drop_duplicates(["location_id", "date"], keep="last").sort_values(["location_id", "date"])
    both.to_csv(OUT, index=False)
    print(f"{len(new)} forecast rows fetched; {len(both)} total in {OUT}")


if __name__ == "__main__":
    main()
