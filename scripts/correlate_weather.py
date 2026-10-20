"""Correlate weekly Google Trends interest with Malaysian (MET) rainy-day share per destination.

Inputs: data/trends_weekly_MY.csv (scripts/fetch_trends.py) and data/weather_log.csv
(scripts/log_weather.py, built up daily). Like correlate.py, this refuses to
print a coefficient on too little data: it needs MIN_WEEKS weeks where both
exist. The weather log starts empty, so expect "not enough yet" for months.
Spearman (rank) correlation, since interest is a 0-100 index, not a count.

Usage: python scripts/correlate_weather.py
"""
import pathlib

import pandas as pd
from scipy.stats import spearmanr

DATA = pathlib.Path(__file__).parent.parent / "data"
MIN_WEEKS = 26  # half a year of paired weeks; below this a coefficient isn't meaningful
LOCATION = {
    "Perhentian": "Rc007", "Redang": "Rc009", "Lang Tengah": "Rc009", "Kapas": "Rc015",
    "Tioman": "Rc024", "Payar": "Rc001", "Sibu": "Rc025", "Tinggi": "Rc025", "Besar": "Rc025",
    "Rawa": "Rc025", "Cameron Highlands": "Rc008",
    "Sipadan / Mabul": "Rc502", "Tunku Abdul Rahman Park": "Rc511", "Kinabalu / Kundasang": "Rc503",
    "Langkawi": "Rc001", "Pangkor": "Rc005", "Fraser's Hill": "Rc014", "Miri": "Ds537",
}


def main():
    tp, wp = DATA / "trends_weekly_MY.csv", DATA / "weather_log.csv"
    if not tp.exists() or not wp.exists():
        print("Need both data/trends_weekly_MY.csv (fetch_trends.py) and data/weather_log.csv (log_weather.py).")
        return
    tr = pd.read_csv(tp, parse_dates=["week"])
    tr = tr[tr.term == "(sum of terms)"]  # Malay and English terms summed; per-term rows are for inspection
    wx = pd.read_csv(wp, parse_dates=["date"])
    # Trends weeks are labelled by their Sunday start; group daily weather the same way.
    wx["week"] = wx["date"] - pd.to_timedelta((wx["date"].dt.dayofweek + 1) % 7, unit="D")
    weekly = wx.groupby(["location_id", "week"]).agg(rain_share=("rain", "mean"), days=("rain", "size")).reset_index()
    weekly = weekly[weekly["days"] >= 5]  # skip partial weeks
    for dest, loc in LOCATION.items():
        pair = tr[tr.destination == dest].merge(weekly[weekly.location_id == loc], on="week")
        if len(pair) < MIN_WEEKS:
            print(f"{dest}: {len(pair)} paired weeks, need {MIN_WEEKS}: not enough weather history yet.")
            continue
        r, p = spearmanr(pair["interest"], pair["rain_share"])
        print(f"{dest}: Spearman rho={r:.2f}, p={p:.3f}, n={len(pair)} weeks (rain = MET forecast, not gauge)")


if __name__ == "__main__":
    main()
