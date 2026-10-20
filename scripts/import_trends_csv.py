"""Load Google Trends CSV exports you downloaded by hand from trends.google.com, instead of calling the rate-limited API.

How to export (takes about 30 seconds per destination, works even when the API is blocking this machine):
  1. trends.google.com > Explore. Search term: e.g. "Perhentian Islands". Location: Malaysia. Time: Past 5 years.
  2. Click the download arrow on "Interest over time". You get multiTimeline.csv.
  3. Save it as data/trends_manual/<destination>.csv, using the dashboard's destination name:
     Perhentian.csv, Redang.csv, Tioman.csv, Kapas.csv, Langkawi.csv, Pangkor.csv, Cameron Highlands.csv, ...
     (names with a slash: "Sipadan - Mabul.csv", "Kinabalu - Kundasang.csv"; the full list is in data/trends_manual/search_terms.txt)
  4. python scripts/import_trends_csv.py     then     python scripts/build_pending.py

Put the English AND Malay variants of a destination in ONE chart (+ Compare) before exporting: they then share one 0-100 scale and
are added together, with each term's share recorded. See data/trends_manual/search_terms.txt.

Merges into data/trends_weekly_MY.csv and data/seasonality_trends_MY.json (same files and metrics fetch_trends.py writes), so a mix
of API-fetched and hand-exported destinations works. Trends scales every export to its own 0-100 peak: compare shapes, not levels.
"""
import io
import json
import pathlib
import sys

import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fetch_trends import PARENT, metrics  # noqa: E402

DATA = pathlib.Path(__file__).parent.parent / "data"
SRC = DATA / "trends_manual"


def parse(path: pathlib.Path):
    """One export may hold several terms (English and Malay compared in one chart, so they share a 0-100 scale).
    Returns the term names and a DataFrame with one column per term."""
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    start = next(i for i, l in enumerate(lines) if l.split(",")[0].strip().strip('"') in ("Week", "Month", "Day", "Time"))
    df = pd.read_csv(io.StringIO("\n".join(lines[start:])))
    idx = pd.to_datetime(df.iloc[:, 0])
    cols = {c.split(":")[0].strip(): pd.to_numeric(df[c].astype(str).str.replace("<1", "0.5"), errors="coerce").values for c in df.columns[1:]}
    return list(cols), pd.DataFrame(cols, index=idx).dropna(how="all").fillna(0)


def main():
    files = sorted(SRC.glob("*.csv")) if SRC.exists() else []
    if not files:
        print(f"No CSVs in {SRC}. See the instructions at the top of this script.")
        return
    cpath, jpath = DATA / "trends_weekly_MY.csv", DATA / "seasonality_trends_MY.json"
    out = json.loads(jpath.read_text()) if jpath.exists() else {}
    old = pd.read_csv(cpath) if cpath.exists() else pd.DataFrame(columns=["destination", "term", "week", "interest"])
    rows = []
    for f in files:
        dest = f.stem.replace(" - ", " / ")  # "Sipadan - Mabul.csv" -> "Sipadan / Mabul" (a slash cannot be in a filename)
        terms, df = parse(f)
        s = df.sum(axis=1)  # same-chart terms share one scale, so adding them is fair
        if s.sum() == 0:
            print(f"{dest}: every month is 0, so Trends has too few searches; skipped (no seasonality for this place)")
            continue
        share = (df.sum() / max(df.values.sum(), 1e-9)).round(3).to_dict()
        rows += [(dest, t, d.date().isoformat(), float(v)) for t in terms for d, v in df[t].items()]
        rows += [(dest, "(sum of terms)", d.date().isoformat(), float(v)) for d, v in s.items()]
        out[dest] = {"term": " + ".join(terms), "terms": terms, "term_share": share, **metrics(s), "source": "Google Trends, Malaysia (hand-exported CSV, terms summed)"}
        print(f"{dest}: {share}, {len(s)} points, peak {out[dest]['peak_month']}, {'ok' if out[dest]['reliable'] else 'LOW VOLUME'}")
        if len(terms) == 1:
            print("   note: only one term in this file; add the Malay and English variants to the same chart (see search_terms.txt)")
    done = {r[0] for r in rows}
    keep = old[~old.destination.isin(done)]
    pd.concat([keep, pd.DataFrame(rows, columns=keep.columns)]).to_csv(cpath, index=False)
    for child, parent in PARENT.items():
        if parent in done:
            out[child] = {**out[parent], "term": f"{out[parent]['term']} (parent: {parent})"}
    jpath.write_text(json.dumps(out, indent=1))
    print(f"Merged {len(files)} file(s). Now run: python scripts/build_pending.py")


if __name__ == "__main__":
    main()
