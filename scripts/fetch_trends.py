"""Weekly Google Trends interest per destination, plus seasonality metrics.

Why weekly: Google Trends only returns weekly points for a multi-year window
(daily is limited to ~9 months), so weekly over 5 years is the finest series
that still shows the same season repeating across years.

Reads nothing; writes data/trends_weekly_<geo>.csv and data/seasonality_trends_<geo>.json.
"reliable" is false when over 30% of weeks are zero: do not score those destinations.
Uses the unofficial pytrends client, which Google rate-limits (HTTP 429), so
requests are spaced and retried with backoff. Trends scales each term to its
own 0-100 peak, so these curves show SHAPE (seasonality), not visitor volume
and not size comparisons between islands.

Usage: python scripts/fetch_trends.py [geo] [destination ...]     (pip install pytrends)
  Naming destinations fetches only those and merges them into the existing output files.
  Saves after every destination and, on a rerun, skips ones already saved, so a rate-limited run can simply be restarted.
  geo = "MY" (default): searches made in Malaysia, which follow school holidays and
        the monsoon more closely; "" = worldwide, which mostly reflects trip planning.
Output files get a _<geo> suffix (e.g. seasonality_trends_MY.json).
"""
import json
import pathlib
import sys
import time

import numpy as np
import pandas as pd
from pytrends.exceptions import TooManyRequestsError
from pytrends.request import TrendReq

DATA = pathlib.Path(__file__).parent.parent / "data"

# destination -> search term. Tulai/Sembilang and Lembu/Kaca are too small to
# have their own search volume, so they reuse their group's parent term.
# Malay AND English: Malaysians search in Malay ("Pulau Redang"), English terms mostly show foreign travellers. All terms for a
# destination go in one request (Trends allows 5), so they share one 0-100 scale and can be summed.
TERMS = {
    "Perhentian": ["Pulau Perhentian", "Perhentian Islands", "Perhentian"], "Redang": ["Pulau Redang", "Redang Island", "Redang"],
    "Lang Tengah": ["Pulau Lang Tengah", "Lang Tengah"], "Kapas": ["Pulau Kapas", "Kapas Island"],
    "Tioman": ["Pulau Tioman", "Tioman Island", "Tioman"], "Payar": ["Pulau Payar", "Payar Island"],
    "Sibu": ["Pulau Sibu", "Sibu Island"], "Tinggi": ["Pulau Tinggi", "Tinggi Island"], "Besar": ["Pulau Besar Mersing", "Besar Island Mersing"],
    "Rawa": ["Pulau Rawa", "Rawa Island"], "Cameron Highlands": ["Cameron Highlands", "Tanah Tinggi Cameron"],
    "Sipadan / Mabul": ["Pulau Sipadan", "Sipadan Island", "Pulau Mabul"], "Tunku Abdul Rahman Park": ["Taman Tunku Abdul Rahman", "Tunku Abdul Rahman Park", "Manukan"],
    "Kinabalu / Kundasang": ["Gunung Kinabalu", "Mount Kinabalu"],
    "Langkawi": ["Pulau Langkawi", "Langkawi"], "Pangkor": ["Pulau Pangkor", "Pangkor Island"], "Fraser's Hill": ["Bukit Fraser", "Fraser's Hill"],
    "Miri": ["Terumbu Karang Miri", "Miri Sibuti Coral Reef"],
}
PARENT = {"Tulai": "Tioman", "Sembilang": "Tioman", "Lembu": "Payar", "Kaca": "Payar"}
GEO = sys.argv[1] if len(sys.argv) > 1 else "MY"
ONLY = sys.argv[2:]
MAX_ZERO = 0.30  # more than 30% empty weeks = too little search volume to read a season from
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def fetch(terms):
    wait = 30
    for _ in range(4):
        try:
            p = TrendReq(hl="en-US", tz=-480, timeout=(10, 30), retries=0)
            p.build_payload(terms, timeframe="today 5-y", geo=GEO)
            df = p.interest_over_time()
            return df[terms] if not df.empty else None
        except TooManyRequestsError:
            print(f"  429 for {terms}, waiting {wait}s", flush=True)
            time.sleep(wait)
            wait = min(wait * 2, 120)
    return None


def metrics(s: pd.Series) -> dict:
    month = s.groupby(s.index.month).mean().reindex(range(1, 13))
    p = month / month.sum()  # share of a year's interest falling in each month
    week = s.groupby(s.index.isocalendar().week.clip(upper=52)).mean().reindex(range(1, 53)).interpolate()
    smooth = week.rolling(3, center=True, min_periods=1).mean()  # 3-week smoothing, 52 bins
    top3 = p.sort_values(ascending=False).head(3)
    return {
        "n_weeks": int(len(s)), "zero_weeks": round(float((s == 0).mean()), 2),
        "reliable": bool((s == 0).mean() <= MAX_ZERO), "start": str(s.index[0].date()), "end": str(s.index[-1].date()),
        "month_share": [round(float(v), 4) for v in p],
        "week_profile": [round(float(v), 1) for v in smooth],
        "peak_month": MONTHS[int(p.idxmax()) - 1],
        "peak_share": round(float(p.max()), 3),  # 0.083 = perfectly even
        "peak_to_trough": round(float(p.max() / max(p.min(), 0.005)), 1),
        "effective_months": round(float(1 / (p ** 2).sum()), 1),  # 12 = even, 1 = one month only
        "cv": round(float(p.std() / p.mean()), 3),
        "top3_share": round(float(top3.sum()), 3),
    }


def main():
    DATA.mkdir(exist_ok=True)
    tag = GEO or "world"
    jpath, cpath = DATA / f"seasonality_trends_{tag}.json", DATA / f"trends_weekly_{tag}.csv"
    rows, out = [], {}
    if jpath.exists() and cpath.exists():  # keep what is already fetched; only re-fetch destinations named on the command line
        out = json.loads(jpath.read_text())
        old = pd.read_csv(cpath)
        rows = list(old[~old.destination.isin(ONLY)].itertuples(index=False, name=None))
        for d in ONLY:
            out.pop(d, None)
    for dest, terms in TERMS.items():
        if (ONLY and dest not in ONLY) or (not ONLY and dest in out):
            continue
        print(f"{dest}: {terms}", flush=True)
        df = fetch(terms)
        if df is None:
            print("  gave up (rate limited or empty); rerun later")
            continue
        s = df.sum(axis=1)
        rows += [(dest, t, d.date().isoformat(), int(v)) for t in terms for d, v in df[t].items()]
        rows += [(dest, "(sum of terms)", d.date().isoformat(), int(v)) for d, v in s.items()]
        out[dest] = {"term": " + ".join(terms), "terms": terms, "term_share": (df.sum() / max(df.values.sum(), 1)).round(3).to_dict(), **metrics(s)}
        pd.DataFrame(rows, columns=["destination", "term", "week", "interest"]).to_csv(cpath, index=False)
        jpath.write_text(json.dumps(out, indent=1))
        print(f"  saved ({len(out)} destinations so far)", flush=True)
        time.sleep(15)
    for child, parent in PARENT.items():
        if parent in out:
            out[child] = {**out[parent], "term": f"{out[parent]['term']} (parent: {parent})"}
    pd.DataFrame(rows, columns=["destination", "term", "week", "interest"]).to_csv(cpath, index=False)
    jpath.write_text(json.dumps(out, indent=1))
    print(f"\nWrote {len(out)} destinations. Interest is each term's own 0-100 scale: compare shapes, not levels.")


if __name__ == "__main__":
    main()
