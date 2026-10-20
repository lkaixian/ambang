"""Compute real pairwise correlations between whatever destination-level series
have actually been fetched into data/ (see fetch_open_data.py).

Deliberately does not force a number out of too little data: prints an honest
"not enough series / not enough years" message instead of a misleading
correlation when the panel is too thin, per AMBANG's own bottleneck/small-panel
findings.

Usage: python scripts/correlate.py
"""
import pathlib

import pandas as pd
from scipy.stats import pearsonr

DATA_DIR = pathlib.Path(__file__).parent.parent / "data"

MIN_PAIRED_YEARS = 4  # below this, a correlation coefficient isn't meaningful


def load_population(path: pathlib.Path) -> pd.Series:
    df = pd.read_csv(path)
    df = df[(df["sex"] == "both") & (df["age"] == "overall") & (df["ethnicity"] == "overall")]
    df["year"] = pd.to_datetime(df["date"]).dt.year
    yearly = df.groupby(["destination", "year"])["population"].sum()
    yearly.name = "population"
    return yearly


def load_cpi(path: pathlib.Path) -> pd.Series:
    df = pd.read_csv(path)
    df = df[df["division"] == "overall"]
    df["year"] = pd.to_datetime(df["date"]).dt.year
    yearly = df.groupby(["destination", "year"])["index"].mean()
    yearly.name = "cpi_state"
    return yearly


def load_household_income(path: pathlib.Path) -> pd.Series:
    df = pd.read_csv(path)
    df["year"] = pd.to_datetime(df["date"]).dt.year
    yearly = df.groupby(["destination", "year"])["income_median"].mean()
    yearly.name = "hh_income_district"
    return yearly


def load_unemployment(path: pathlib.Path) -> pd.Series:
    df = pd.read_csv(path)
    df["year"] = pd.to_datetime(df["date"]).dt.year
    yearly = df.groupby(["destination", "year"])["u_rate"].mean()
    yearly.name = "lfs_district"
    return yearly


def load_water_production(path: pathlib.Path) -> pd.Series:
    df = pd.read_csv(path)
    df["year"] = pd.to_datetime(df["date"]).dt.year
    yearly = df.groupby(["destination", "year"])["value"].sum()
    yearly.name = "water_production"
    return yearly


def load_water_consumption(path: pathlib.Path) -> pd.Series:
    df = pd.read_csv(path)
    df["year"] = pd.to_datetime(df["date"]).dt.year
    yearly = df.groupby(["destination", "year"])["value"].sum()
    yearly.name = "water_consumption"
    return yearly


def load_marine_park_visitors(path: pathlib.Path) -> pd.Series:
    # Already year-level (not a date column) and split domestic/foreign --
    # sum both to a single per-destination-year visitor total.
    df = pd.read_csv(path)
    yearly = df.groupby(["destination", "year"])["count"].sum()
    yearly.name = "marine_park_visitors"
    return yearly


def load_water_access(path: pathlib.Path) -> pd.Series:
    df = pd.read_csv(path)
    df = df[df["strata"] == "overall"]
    df["year"] = pd.to_datetime(df["date"]).dt.year
    yearly = df.groupby(["destination", "year"])["proportion"].mean()
    yearly.name = "water_access"
    return yearly


# dataset_id -> loader that reduces the raw fetched CSV to a single named
# destination-year series. Add an entry here each time fetch_open_data.py
# gains a new confirmed source.
LOADERS = {
    "population_district": load_population,
    "cpi_state": load_cpi,
    "hh_income_district": load_household_income,
    "lfs_district": load_unemployment,
    "water_production": load_water_production,
    "water_consumption": load_water_consumption,
    "water_access": load_water_access,
    "marine_park_visitors": load_marine_park_visitors,
}


def main():
    series = {}
    for dataset_id, loader in LOADERS.items():
        path = DATA_DIR / f"{dataset_id}.csv"
        if path.exists():
            series[dataset_id] = loader(path)
        else:
            print(f"Skipping {dataset_id}: {path} not found, run fetch_open_data.py first.")

    if len(series) < 2:
        print(
            f"\nOnly {len(series)} real series available ({', '.join(series) or 'none'}). "
            "Correlation needs at least 2 independent indicators -- add more confirmed "
            "sources to fetch_open_data.py's SOURCES first. No correlation computed."
        )
        return

    # Pairwise, not one global panel: series cover different year ranges
    # (e.g. marine_park_visitors stops at 2017, population_district starts at
    # 2020), so requiring all series simultaneously would empty every pair's
    # overlap just because two unrelated series never share a year.
    names = list(series)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            pair = pd.concat({a: series[a], b: series[b]}, axis=1).dropna()
            n = len(pair)
            if n < MIN_PAIRED_YEARS:
                print(f"{a} vs {b}: only {n} paired destination-years -- too thin to report a correlation.")
                continue
            r, p = pearsonr(pair[a], pair[b])
            print(f"{a} vs {b}: r={r:.2f}, p={p:.3f}, n={n}")


if __name__ == "__main__":
    main()
