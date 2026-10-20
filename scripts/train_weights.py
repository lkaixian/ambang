"""Pretrain AMBANG's pressure-indicator weights via the Entropy Weight Method
(EWM) -- an unsupervised, data-driven alternative to the hand-set P1/P2/P3
priority weights used previously.

Why EWM and not a supervised model: AMBANG's historical "score" series isn't
a real, independently-measured target (see PROGRESS.md) -- it's derived from
the same pressure/capacity indicators, so training a supervised model against
it would just be fitting noise back onto itself. EWM instead computes weight
from how much each indicator actually *varies* across destinations: an
indicator that's nearly identical everywhere carries little discriminating
information and gets a low weight; one that spreads destinations out gets a
higher weight. No fabricated target needed.

IMPORTANT CAVEAT: this trains on the dashboard's illustrative per-island
placeholder values (mirrored in MATRIX below from AMBANG_Dashboard_
Prototype.html's PANEL), not real fetched data -- because no real per-island
pressure series exists yet. Treat this as a working, reproducible pipeline,
not yet a real-world weight. Re-run once scripts/fetch_open_data.py can
supply real per-destination values for these 5 indicator slots, replacing
MATRIX below.

Usage: python scripts/train_weights.py
"""
import json
import pathlib

import numpy as np

INDICATORS = [
    "Visitor volume",  # "Marine park visitors" (marine) / "District visitor/accommodation activity" (Cameron)
    "Hotel guest arrivals",
    "Accommodation density",
    "Occupancy",
    "Seasonality",
    "Cost-of-living pressure",  # new: resident income squeeze, sourced from hh_income_district (see progress.md)
]

# destination -> [value per INDICATORS slot], mirrored from PANEL in
# AMBANG_Dashboard_Prototype.html. Keep in sync by hand until real data lands.
MATRIX = {
    # Col 0 (visitor volume) is now real for the 14 marine islands: derived
    # from archive.data.gov.my's confirmed marine-park-visitor CSVs (2015-17
    # state average, min-max normalised across the 4 states) -- see
    # fetch_open_data.py's fetch_marine_park_visitors() and progress.md.
    # Cameron's col 0 is unrelated (district visitor/accommodation activity,
    # still a placeholder) and untouched.
    "Perhentian":   [.95, .81, .78, .70, .74, .75],
    "Redang":       [.92, .80, .76, .68, .72, .73],
    "Lang Tengah":  [.67, .58, .55, .50, .60, .54],
    "Kapas":        [.59, .52, .48, .45, .55, .48],
    "Tioman":       [.43, .60, .58, .60, .58, .58],
    "Tulai":        [.25, .30, .20, .35, .45, .32],
    "Sembilang":    [.22, .28, .22, .32, .40, .30],
    "Payar":        [.05, .62, .52, .66, .48, .55],
    "Lembu":        [.03, .45, .32, .55, .38, .40],
    "Kaca":         [.03, .40, .25, .48, .32, .33],
    "Sibu":         [.52, .38, .34, .48, .40, .37],
    "Tinggi":       [.48, .36, .32, .46, .38, .35],
    "Besar":        [.42, .32, .27, .42, .35, .31],
    "Rawa":         [.35, .29, .22, .40, .30, .28],
    "Cameron Highlands": [.70, .81, .83, .61, .64, .66],
}


def entropy_weights(matrix: np.ndarray) -> np.ndarray:
    """Rows = destinations, cols = indicators, values already normalised 0-1."""
    n = matrix.shape[0]
    col_sum = matrix.sum(axis=0)
    col_sum[col_sum == 0] = 1e-9
    p = matrix / col_sum
    eps = 1e-9
    entropy = -1 / np.log(n) * (p * np.log(p + eps)).sum(axis=0)
    diversity = 1 - entropy  # "degree of divergence" -- more spread = more informative
    return diversity / diversity.sum()


def main():
    real = pathlib.Path(__file__).parent.parent / "data" / "real_indicators.json"
    if real.exists():  # replace placeholder columns with real values where build_pending.py found them
        for dest, d in json.loads(real.read_text(encoding="utf-8")).items():
            for key, col in (("accom", 2), ("occ", 3), ("season", 4)):
                if key in d:
                    MATRIX[dest][col] = d[key]["v"]
    dests = list(MATRIX)
    m = np.array([MATRIX[d] for d in dests])
    weights = entropy_weights(m)

    print(f"Entropy Weight Method, n={len(dests)} destinations x {len(INDICATORS)} indicators\n")
    result = {}
    for name, w in sorted(zip(INDICATORS, weights), key=lambda x: -x[1]):
        print(f"  {name:<24} {w:.3f}")
        result[name] = round(float(w), 3)

    out = pathlib.Path(__file__).parent.parent / "data" / "pressure_weights_ewm.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(result, indent=2))
    print(f"\nWritten to {out}.")
    print("CAVEAT: trained on placeholder MATRIX values above, not real data -- see module docstring.")


if __name__ == "__main__":
    main()
