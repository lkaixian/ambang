"""Seasonality of public interest per destination from Wikipedia pageviews in English AND Malay (data/wiki_pageviews_monthly.csv,
written by fetch_open_apis.py from the keyless Wikimedia REST API). Views from all language editions are summed per month, because
Malaysians read in Malay: English alone would mostly show foreign travellers. Writes data/seasonality_wiki.json in the
same shape as the Google Trends output, so build_pending.py can use either.

What it measures: when people read about the place (trip research), not when they visit. COVID years (2020, 2021)
are left out so the closed-borders collapse does not flatten the season. A destination is marked unreliable when its
typical month has under MIN_VIEWS views, because small counts are mostly noise.

Usage: python scripts/seasonality_wiki.py
"""
import json
import pathlib

import pandas as pd

DATA = pathlib.Path(__file__).parent.parent / "data"
MIN_VIEWS = 300  # median monthly views below this = too little to read a season from
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def main():
    w = pd.read_csv(DATA / "wiki_pageviews_monthly.csv")
    w["year"] = w["month"].astype(str).str[:4].astype(int)
    w["m"] = w["month"].astype(str).str[4:6].astype(int)
    w = w[~w.year.isin([2020, 2021])]
    out = {}
    for dest, g0 in w.groupby("destination"):
        ms_share = float(g0[g0.lang == "ms"].views.sum() / max(g0.views.sum(), 1)) if "lang" in g0 else None
        g = g0.groupby(["year", "m"], as_index=False).views.sum()  # all articles and languages, per month
        g["article"] = " + ".join(sorted(g0.article.unique()))
        month = g.groupby("m").views.mean().reindex(range(1, 13))
        p = month / month.sum()
        top3 = p.sort_values(ascending=False).head(3)
        med = float(g.views.median())
        out[dest] = {
            "term": g.article.iloc[0], "source": "Wikipedia pageviews in English and Malay (Wikimedia REST API), 2016-2025 excluding 2020-21",
            "ms_share": None if ms_share is None else round(ms_share, 2), "languages": sorted(g0.lang.unique().tolist()) if "lang" in g0 else ["en"],
            "n_months": int(len(g)), "median_monthly_views": round(med), "reliable": bool(med >= MIN_VIEWS),
            "month_share": [round(float(v), 4) for v in p], "peak_month": MONTHS[int(p.idxmax()) - 1],
            "peak_share": round(float(p.max()), 3), "effective_months": round(float(1 / (p ** 2).sum()), 1), "top3_share": round(float(top3.sum()), 3),
        }
    (DATA / "seasonality_wiki.json").write_text(json.dumps(out, indent=1))
    for k, v in sorted(out.items(), key=lambda kv: -kv[1]["median_monthly_views"]):
        print(f"{k:<26} median {v['median_monthly_views']:>6} views/mo  malay {('%d%%' % round((v['ms_share'] or 0)*100)):>4}  peak {v['peak_month']} {v['peak_share']:.3f}  eff.months {v['effective_months']:>4}  {'ok' if v['reliable'] else 'LOW VOLUME'}")


if __name__ == "__main__":
    main()
