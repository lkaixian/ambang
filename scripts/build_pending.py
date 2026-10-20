"""Build the dashboard's "tracked, not scored yet" destinations from data/ and embed them in the HTML.

These destinations get a map pin and only the indicators backed by real fetched data. They get NO AMBANG
score until the missing pressure/capacity indicators have real data too (nothing is filled with placeholders).
Why not scored: the scored islands (Terengganu, Pahang, Kedah, Johor marine parks) have a real park-visitor
series from the Department of Marine Park Malaysia; no equivalent was found for these places.
Provisional scores exist only where a daily visitor limit was found (Sipadan permits, Mount Kinabalu climber quota, and an academic
carrying-capacity estimate for Tunku Abdul Rahman Park):
score = 100*U/(U+1) with U = average daily visitors / daily limit, i.e. AMBANG's P/(P+C) with the limit as capacity, so U=1 scores 50.
The limits have changed over the years and sources disagree, so each score is shown as a range across the plausible limits.
Langkawi has a real visitor series but no limit or capacity study with a number, so it is NOT scored.
Re-run after fetch_open_data.py, fetch_open_apis.py and fetch_trends.py:  python scripts/build_pending.py
Writes the JSON inside <script id="pendingData"> (tracked-not-scored places) and <script id="seasonData"> (monthly interest
curves for the Early warning calendar, scored and unscored places) in AMBANG_Dashboard_Prototype.html.
"""
import json
import pathlib
import re

import numpy as np
import pandas as pd

ROOT = pathlib.Path(__file__).parent.parent
DATA = ROOT / "data"
HTML = ROOT / "AMBANG_Dashboard_Prototype.html"

NO_HOTEL = "Hotel guest arrivals, accommodation density and occupancy: no open district-level dataset found; Tourism Malaysia publishes state totals only."
NO_VISITORS = "Visitor counts: no series found on the open portals checked (the scored islands use the Department of Marine Park Malaysia archive, which only covers Terengganu, Pahang, Kedah and Johor marine parks)."
NO_WASTE = "Waste handling: SWCorp's facility directory has no column for {state}."

# name -> district (DOSM), state, kind, pin, Reef Check location keys, SWCorp key in waste_facilities.csv, extra gaps
SPECS = {
    "Sipadan / Mabul": dict(state="Sabah", district="Semporna", kind="Marine", lat=4.114, lon=118.629, coral=["Sipadan", "Mabul"], waste=None,
        gaps=["Official daily dive-permit limit: reported as 120, then 176, and 252 from January 2026; none confirmed on a Sabah Parks page, so the provisional score is a range.", NO_HOTEL, NO_WASTE.format(state="Sabah"),
              "Only one capacity side is real here (coral cover, water); no sewage, waste or energy data for Semporna / Mabul."]),
    "Tunku Abdul Rahman Park": dict(state="Sabah", district="Kota Kinabalu", kind="Marine", lat=5.975, lon=116.0, coral=["Tunku Abdul Rahman Park"], waste=None,
        gaps=["No official daily visitor limit found. The provisional score uses an academic estimate (Maidin 2022) for three of the five islands, with its time unit not confirmed.", NO_HOTEL, NO_WASTE.format(state="Sabah")]),
    "Kinabalu / Kundasang": dict(state="Sabah", district="Ranau", kind="Highland", lat=6.06, lon=116.55, coral=[], waste=None,
        gaps=["Official daily climber quota not confirmed on the Sabah Parks pages read (news reports give 135, 165 and about 194), so the provisional score is a range.", NO_HOTEL, NO_WASTE.format(state="Sabah"),
              "No reef indicator applies to a highland. River water quality (DOE) for the Kinabalu / Kundasang basins is not fetched yet."]),
    "Langkawi": dict(state="Kedah", district="Langkawi", kind="Island", lat=6.35, lon=99.80, coral=["Pulau Singa Besar"], waste="Kedah marine parks",
        gaps=["No official limit on visitors found for Langkawi, and LADA counts every arrival (not marine park visitors), so the real arrivals series cannot be scored.", NO_HOTEL,
              "Reef cover is one Reef Check site (Pulau Singa Besar), not the whole island group."]),
    "Pangkor": dict(state="Perak", district="Manjung", kind="Island", lat=4.22, lon=100.55, coral=["Pangkor"], waste="Perak",
        gaps=[NO_VISITORS, NO_HOTEL, "Population and income are for Manjung district, which is much larger than the island (it includes Lumut and Seri Manjung), so they overstate the island's resident base."]),
    "Fraser's Hill": dict(state="Pahang", district="Raub", kind="Highland", lat=3.71, lon=101.74, coral=[], waste="Pahang marine parks",
        gaps=[NO_VISITORS, NO_HOTEL, "Population and income are for Raub district, far larger than the hill station. River water quality (DOE) for the Fraser's Hill basins is not fetched yet."]),
    "Miri": dict(state="Sarawak", district="Miri", kind="Marine", lat=4.45, lon=113.95, coral=["Miri"], waste=None,
        gaps=["Visitor counts: Sarawak Forestry Corporation figures for the Miri-Sibuti Coral Reef National Park were not found on the open portals.", NO_HOTEL, NO_WASTE.format(state="Sarawak"),
              "Reef Check's 'Miri' location is used for coral cover; it has the only Sarawak reef survey in the Reef Check data."]),
}


# Reported constraints: cited facts that matter for the place but are not numbers the score can use (no visitor or limit figure). Shown on the page, never scored.
SPECS["Pangkor"]["reported"] = [
    {"t": "2023 survey of 815 people (international and domestic tourists, residents): crowding on public holidays judged acceptable and social carrying capacity 'still good'. It is a perception survey with no visitor or capacity figures.",
     "src": "Planning Malaysia journal, 2023", "url": "https://mail.planningmalaysia.org/index.php/pmj/article/view/1329"},
    {"t": "February 2024: water supply to the island was disrupted during the Chinese New Year rush. Reports blame the surge in visitors and leaking seabed pipes; the Perak Water Board said it would upgrade pumps and build tanks. No volumes were published.",
     "src": "Malay Mail, 12 Feb 2024", "url": "https://www.malaymail.com/news/malaysia/2024/02/12/perak-water-board-to-upgrade-water-pumps-build-water-tanks-in-pulau-pangkor/117679"},
]
SPECS["Langkawi"]["reported"] = [
    {"t": "Water supply has been a recurring problem: in early 2024 supply was disrupted at nine locations, including tourist spots, during a dry spell and pipeline leaks. Reports also cite a need for 20 to 25 million litres a day of extra treated water; the source and year of that estimate were not confirmed.",
     "src": "The Star, 7 Feb 2024; Malay Mail, 2018", "url": "https://thestar.com.my/news/nation/2024/02/07/water-woes-deepen-ahead-of-cny"},
]


# Atlas MPAs already on the map under another name (pin name -> Atlas NAME); everything else in the Atlas list is added as tracked.
ATLAS_COVERED = {"Pulau Perhentian Besar Marine Park", "Pulau Perhentian Kecil Marine Park", "Pulau Redang Marine Park", "Pulau Lang Tengah Marine Park",
                 "Pulau Kapas Marine Park", "Pulau Tioman", "Pulau Tulai Marine Park", "Pulau Sembilang Marine Park", "Pulau Payar Marine Park",
                 "Pulau Lembu Marine Park", "Pulau Kacha Marine Park", "Pulau Sibu Marine Park", "Pulau Tinggi Marine Park", "Pulau Babi Besar Marine Park",
                 "Pulau Rawa Marine Park", "Sipadan Island (Proposed Boundary) Marine Park", "Tunku Abdul Rahman State Park", "Miri-Sibuti Coral Reefs National Park"}
FEDERAL = {"Terengganu", "Pahang", "Kedah", "Johor", "W.P Labuan"}  # run by the federal Marine Park Department (42 parks)


# pin name -> key in the DOSM CSVs (gazetted district, see DESTINATIONS in fetch_open_data.py)
PARK_DISTRICT = {"Susu Dara": "Besut parks", "Pulau Nyireh": "Dungun parks", "Tenggol": "Dungun parks",
                 **{n: "Rompin parks" for n in ("Pulau Labas", "Pulau Sepoi", "Pulau Jahat", "Tokong Bahara", "Pulau Cebeh", "Seri Buat")},
                 **{n: "Mersing parks" for n in ("Babi Tengah", "Babi Hujong", "Pulau Gual", "Mensirip", "Harimau", "Pulau Aur", "Pemanggil", "Mentigi", "Sibu Hujong")},
                 "Segantang": "Kota Setar parks"}


def atlas_parks(pop, inc, am):
    """Tracked pins for every Coral Triangle Atlas MPA not already on the map. Atlas facts only; no score, nothing filled in."""
    df = pd.read_csv(DATA / "atlas_raw" / "mpalist_mys.csv", encoding="utf-8-sig")
    coral = pd.read_csv(DATA / "coral_cover.csv").set_index("destination")
    shared = {"Kuraman", "Rusukan Kecil", "Rusukan Besar"}  # one Reef Check location covers all three Labuan parks
    single = {"Yu Besar", "Yu Kecil", "Pulau Pinang", "Pulau Lima"}  # one Reef Check survey site only
    out = {}
    for _, r in df.iterrows():
        if r.NAME in ATLAS_COVERED:
            continue
        name = re.sub(r"^Pulau ", "", re.sub(r"( Marine Park| Marine Conservation Area| State Park| National Park| Park)+$", "", r.NAME)).strip()
        name = f"Pulau {name}" if len(name) <= 6 else name
        st = "Labuan" if r.STATE_PROV == "W.P Labuan" else r.STATE_PROV
        fed = r.STATE_PROV in FEDERAL
        real = [{"n": "Designation", "v": f"{r.DESIG}, IUCN category {r.IUCN_CAT}", "yr": int(str(r.DATE_ESTAB)[:4]),
                 "src": "Coral Triangle Atlas MPA list", "scope": "This park only"}]
        if name in coral.index:
            c = coral.loc[name]
            note = (" Shared across the three Labuan parks." if name in shared else " One survey site only." if name in single else "")
            real.append({"n": "Live coral cover", "v": f"{c.live_coral_cover_pct:.1f}%", "yr": int(c.year), "src": "Reef Check Malaysia" + note,
                         "scope": "Reef Check location, wider than this park" if name in shared else "This park only"})
        key = PARK_DISTRICT.get(name)
        if key:
            dist = key.replace(" parks", "")
            p = pop[(pop.destination == key) & (pop.sex == "both") & (pop.age == "overall") & (pop.ethnicity == "overall")].sort_values("date").iloc[-1]
            i = inc[inc.destination == key].sort_values("date").iloc[-1]
            a = am[am.destination == key].sort_values("date").iloc[-1]
            scope = f"{dist} district (gazetted district of the park); far larger than the island"
            real += [{"n": f"Resident population, {dist} district", "v": f"{p.population * 1000:,.0f}", "yr": int(p.date[:4]), "src": "DOSM population_district", "scope": scope},
                     {"n": f"Median household income, {dist}", "v": f"RM {i.income_median:,.0f} / month", "yr": int(i.date[:4]), "src": "DOSM hh_income_district (HIES)", "scope": scope},
                     {"n": f"Households with piped water / sanitation, {dist}", "v": f"{a.piped_water:.0f}% / {a.sanitation:.0f}%", "yr": int(a.date[:4]),
                      "src": "DOSM hh_access_amenities (HIES)", "scope": scope + "; residents only, not visitors"}]
        if r.STATE_PROV == "W.P Labuan":
            lb = pd.read_csv(DATA / "labuan_marine_park_2017.csv")
            real.append({"n": "Marine park visitors, all three Labuan parks", "v": f"{int(lb['count'].sum()):,} ({int(lb['count'][0]):,} domestic, {int(lb['count'][1]):,} foreign)", "yr": 2017,
                         "src": "Department of Marine Park Malaysia, 'Pelawat Taman Laut Malaysia 2017' (archive.data.gov.my)", "scope": "Labuan marine parks together; no later year found"})
        if r.AREA_R_HA > 0:
            real.append({"n": "Reported park area", "v": f"{r.AREA_R_HA:,.0f} ha", "yr": int(str(r.DATE_ESTAB)[:4]),
                         "src": "Coral Triangle Atlas MPA list (reported area, includes sea)", "scope": "This park only"})
        gaps = [("Run by the federal Marine Park Department (one of the 42 federal marine parks)." if fed else
                 f"Not one of the 42 federal marine parks; managed by {'Sabah Parks or the Sabah Wildlife Department' if st == 'Sabah' else 'Sarawak Forestry Corporation'}."),
                "Management effectiveness, zoning and management plan: the Atlas records them as Unknown or Unrated for this park.",
                NO_VISITORS if fed else "Visitor counts: not found for this park on the open portals checked.",
                NO_HOTEL, ("Waste and water supply: no figure for the park; the district figures above cover the whole district." if key else
                           "Water, waste, population and income: not matched, because the park has no district that clearly represents it."),
                "The Atlas boundary data is a 2014 snapshot; the point list is more recent."]
        if r.AREA_R_HA == 0:
            gaps.append("Park area is recorded as 0 in the Atlas, so it is left out rather than shown as zero.")
        vis = visitors_block(name)
        if vis or r.STATE_PROV == "W.P Labuan":
            gaps = [g for g in gaps if not g.startswith("Visitor counts")]
        if r.STATE_PROV == "W.P Labuan":
            gaps.append("Visitor counts: only 2017 (all three parks together) was found; later years are not on the open portal.")
        out[name] = {"state": st, "district": "", "kind": "Marine", "lat": round(float(r.LAT), 4), "lon": round(float(r.LON), 4),
                     "real": real, "gaps": gaps, "season": None, "visitors": vis, "prov": prov_block(name)}
    return out


# Scored island -> state (for state-level occupancy and seasonality) and -> OSM box key (accommodation count).
ISLAND_STATE = {"Perhentian": "Terengganu", "Redang": "Terengganu", "Lang Tengah": "Terengganu", "Kapas": "Terengganu",
                "Tioman": "Pahang", "Tulai": "Pahang", "Sembilang": "Pahang", "Cameron Highlands": "Pahang",
                "Payar": "Kedah", "Lembu": "Kedah", "Kaca": "Kedah", "Sibu": "Johor", "Tinggi": "Johor", "Besar": "Johor", "Rawa": "Johor"}
OSM_KEY = {"Lembu": "Payar", "Kaca": "Payar"}  # the Payar box covers all three islands


def real_indicators():
    """Real values for the Seasonality, Occupancy and Accommodation density bars of the scored islands, written to data/real_indicators.json
    and embedded in the HTML. Only places with data get a value; the rest keep their illustrative bar.
    Seasonality: how concentrated real marine park visits were across the months of 2017 (state level). v = 1 - (effective months - 1) / 11,
      effective months = 1 / sum(share^2), so 0 is an even spread over 12 months and 1 is all in one month.
    Occupancy: Tourism Malaysia state hotel occupancy, 2015 to 2019 average (2020 to 2022 are COVID years), as a fraction.
    Accommodation density: OpenStreetMap tourist accommodation features near the island, log-scaled to the largest count among the islands.
    """
    mon = pd.read_csv(DATA / "marine_park_monthly_2017.csv")
    occ = pd.read_csv(DATA / "occupancy_state.csv")
    occ.columns = [c.strip() for c in occ.columns]
    occ = occ[occ.YEAR.between(2015, 2019)].mean(numeric_only=True)
    osm = pd.read_csv(DATA / "osm_accommodation.csv").set_index("destination")
    isl_keys = [k for k in osm.index if k in ISLAND_STATE and k != "Cameron Highlands" or k in OSM_KEY.values()]
    mx = max(osm.loc[k, "accommodation_features"] for k in isl_keys) or 1  # Cameron is left out: its box is a highland district, not an island
    out = {}
    for isl, st in ISLAND_STATE.items():
        d = {}
        if st in set(mon.state) and isl != "Cameron Highlands":
            m = mon[mon.state == st].sort_values("month")
            tot = (m.domestic + m.foreign).to_numpy(float)
            eff = 1 / ((tot / tot.sum()) ** 2).sum()
            d["season"] = {"v": round(float(1 - (eff - 1) / 11), 3),
                           "src": f"Department of Marine Park Malaysia monthly visitors, {st}, 2017 (spread over {eff:.1f} effective months of 12; state level, one year)"}
        o = occ.get(st.upper())
        if o is not None:
            d["occ"] = {"v": round(float(o) / 100, 3), "src": f"Tourism Malaysia hotel occupancy, {st}, 2015 to 2019 average {o:.1f}% (state level)"}
        key = OSM_KEY.get(isl, isl)
        n = int(osm.loc[key, "accommodation_features"]) if key in osm.index else 0
        if n > 0 and isl != "Cameron Highlands":  # a zero is not trusted: Rawa has a resort that OSM does not tag, so zero may only mean untagged
            d["accom"] = {"v": round(float(np.log1p(n) / np.log1p(mx)), 3),
                          "src": f"OpenStreetMap: {n} tourist accommodation features in a box around {key} (log-scaled to the busiest island; OSM undercounts, small resorts are often untagged)"}
        if d:
            out[isl] = d
    for d in out.values():  # the score is a geometric mean, so a true 0 would zero the whole pressure side; same 0.03 floor as the visitor indicator
        for x in d.values():
            x["v"] = max(0.03, x["v"])
    (DATA / "real_indicators.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    return out


def util_score(avg_per_day, cap):
    u = avg_per_day / cap
    return round(100 * u / (u + 1))


def band(sc):
    return "green" if sc < 45 else "amber" if sc < 60 else "red" if sc < 75 else "crit"


def visitors_block(name):
    """Real annual visitor series for the destination, from the dashboard's own sources (partial current year dropped)."""
    if name in ("Sipadan / Mabul", "Tunku Abdul Rahman Park", "Kinabalu / Kundasang", "Pulau Tiga", "Tun Sakaran", "Turtle Islands"):
        d = pd.read_csv(DATA / "sabah_parks_visitors.csv")
        d = d[(d.destination == name) & (d.year <= 2025)]
        what = {"Sipadan / Mabul": "Sipadan Island Park visitors (Mabul is outside the park, so not counted)",
                "Tunku Abdul Rahman Park": "Tunku Abdul Rahman Park visitors (all five islands)",
                "Kinabalu / Kundasang": "Kinabalu Park visitors (all visitors, not only climbers)",
                "Pulau Tiga": "Pulau Tiga Park visitors", "Tun Sakaran": "Tun Sakaran Marine Park visitors (Semporna islands)",
                "Turtle Islands": "Turtle Islands Park visitors"}[name]
        return {"title": what, "source": "Sabah Parks public dashboard", "years": [int(y) for y in d.year], "values": [int(v) for v in d.visitors],
                "note": "2026 is partial (to August) and left out. 2020 to 2022 are depressed by COVID closures and caps."}
    if name == "Langkawi":
        d = pd.read_csv(DATA / "lada_visitors.csv")
        d = d[d.note == "full year"]
        return {"title": "Visitor arrivals to Langkawi, all touchpoints (jetty, airport, port, cruise, yacht)", "source": "Langkawi Development Authority (LADA) statistics page",
                "years": [int(y) for y in d.year], "values": [int(v) for v in d.arrivals],
                "note": "Counts everyone arriving on the island, not marine park visitors, so it is not comparable with the park visitor series used for the scored islands. 2026 (year to date) left out."}
    return None


def prov_block(name):
    if name == "Sipadan / Mabul":
        d = pd.read_csv(DATA / "sabah_parks_visitors.csv")
        d = d[(d.destination == name) & d.year.between(2022, 2025)]
        rows = [{"label": f"{int(y)}: {int(v):,} visitors", "per_day": round(v / 365, 1), "score": util_score(v / 365, 176), "score_alt": util_score(v / 365, 120)}
                for y, v in zip(d.year, d.visitors)]
        last = rows[-1]
        return {"basis": "Average visitors per day (visitors divided by 365) against the daily dive-permit limit for Sipadan.",
                "caps": [{"label": "Central: 176 a day", "per_day": 176, "src": "Reported increase from 120 (xray-mag, DIVE)", "url": "https://www.xray-mag.com/content/tighter-restrictions-visiting-sipadan"},
                         {"label": "Original: 120 a day, in place since 2006", "per_day": 120, "src": "divernet, 2019", "url": "https://divernet.com/scuba-news/malaysia-looks-to-ease-sipadan-quotas/"},
                         {"label": "From 1 Jan 2026: 252 a day (dive-resort notice, not an official source)", "per_day": 252, "src": "southeastasiadiving.com guide",
                          "url": "https://www.southeastasiadiving.com/blog/sipadan-diving-guide-permits-best-season-and-what-to-expect"}],
                "rows": rows, "score": last["score"], "lo": last["score"], "hi": last["score_alt"], "band": band(last["score"]),
                "caveats": ["The limit in force for each past year is not confirmed; 176 is used as the central case and 120 as the stricter case (higher score).",
                            "An annual average understates pressure on peak days, when permits are fully used.",
                            "2022 is a re-opening year after closures."]}
    if name == "Tunku Abdul Rahman Park":
        # Maidin (2022), UMS: effective carrying capacity of the three busiest islands (about 96% of visits), land-based and ocean-based.
        land, ocean = 1464 + 990 + 997, 822 + 587 + 458
        d = pd.read_csv(DATA / "sabah_parks_visitors.csv")
        d = d[(d.destination == name) & d.year.between(2023, 2025)]
        rows = [{"label": f"{int(y)}: {int(v):,} visitors", "per_day": round(v / 365), "score": util_score(v / 365, ocean), "score_alt": util_score(v / 365, land)}
                for y, v in zip(d.year, d.visitors)]
        rows.append({"label": "Festive peak day: about 2,000 visitors (press report)", "per_day": 2000, "score": util_score(2000, ocean), "score_alt": util_score(2000, land)})
        last = rows[len(rows) - 2]
        url = "https://eprints.ums.edu.my/id/eprint/41212"
        return {"basis": "Average visitors per day (visitors divided by 365) against the effective carrying capacity of the park's three busiest islands (Manukan, Mamutik, Sapi), which take about 96% of visits.",
                "caps": [{"label": f"Central: {ocean:,} (ocean-based, the tighter of the two limits)", "per_day": ocean, "src": "Maidin 2022, Universiti Malaysia Sabah", "url": url},
                         {"label": f"Looser case: {land:,} (land-based)", "per_day": land, "src": "Maidin 2022, Universiti Malaysia Sabah", "url": url}],
                "rows": rows, "score": last["score"], "lo": last["score_alt"], "hi": last["score"], "band": band(last["score"]),
                "caveats": ["This is an academic estimate, not an official Sabah Parks limit (Sabah Parks said it would set one but no figure was found).",
                            "The abstract does not state the time unit; it is taken to be visitors per day, as is usual for this method. Check the full thesis before relying on it.",
                            "Visitor counts cover all five islands; the capacity figures cover three. The study also defines separate regular, high and festive season values that are not broken out in the abstract.",
                            "The tighter ocean-based limit is used as central because both land and sea limits must hold at once."]}
    if name == "Kinabalu / Kundasang":
        k = pd.read_csv(DATA / "kinabalu_climbers_monthly.csv")
        annual = int(k.climbers_avg.sum())
        avg = annual / 365
        peak = k.sort_values("climbers_avg").iloc[-1]
        days = {1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}
        pk = peak.climbers_avg / days[int(peak.month)]
        rows = [{"label": f"Annual average, {k.benchmark[0]}: {annual:,} climbers", "per_day": round(avg, 1),
                 "score": util_score(avg, 165), "score_alt": util_score(avg, 135), "score_low": util_score(avg, 194)},
                {"label": f"Peak month ({peak['name']}): {int(peak.climbers_avg):,} climbers", "per_day": round(pk, 1),
                 "score": util_score(pk, 165), "score_alt": util_score(pk, 135), "score_low": util_score(pk, 194)}]
        return {"basis": "Average climbers per day against the daily summit-trail climber quota. The quota applies to climbers, so the climber counts (not all Kinabalu Park visitors) are used.",
                "caps": [{"label": "Central: 165 a day", "per_day": 165, "src": "Sabah Parks director, as reported by the Borneo Post (date not confirmed)", "url": "https://www.theborneopost.com/?p=378044"},
                         {"label": "Strict case: 135 a day (post-2015 earthquake quota)", "per_day": 135, "src": "same article", "url": "https://www.theborneopost.com/?p=378044"},
                         {"label": "Loose case: about 194 a day (pre-2015 quota)", "per_day": 194, "src": "same article", "url": "https://www.theborneopost.com/?p=378044"}],
                "rows": rows, "score": rows[0]["score"], "lo": rows[0]["score_low"], "hi": rows[0]["score_alt"], "band": band(rows[0]["score"]),
                "caveats": ["The official quota is not stated on the Sabah Parks pages I could read; the numbers come from news reports and disagree by year.",
                            "In the peak month the score is higher than the annual average, and that month is the one that matters for crowding."]}
    if name == "Turtle Islands":
        d = pd.read_csv(DATA / "sabah_parks_visitors.csv")
        d = d[(d.destination == name) & d.year.between(2023, 2025)]
        rows = [{"label": f"{int(y)}: {int(v):,} visitors", "per_day": round(v / 365, 1), "score": util_score(v / 365, 50), "score_alt": util_score(v / 365, 40), "score_low": util_score(v / 365, 60)}
                for y, v in zip(d.year, d.visitors)]
        last = rows[-1]
        url = "https://kepkas.sabah.gov.my/panel-to-study-need-to-limit-visitors-to-islands-masidi"
        return {"basis": "Average visitors per day (visitors divided by 365) against the overnight guest limit at Selingan Island, the park's only overnight stay.",
                "caps": [{"label": "Central: 50 a night", "per_day": 50, "src": "Sabah minister's statement as reported by the Sabah tourism ministry (KePKAS)", "url": url},
                         {"label": "Strict case: 40 a night", "per_day": 40, "src": "visitor guides, not an official source", "url": "https://www.wonderfulmalaysia.com/selingan-turtle-island-malaysia.htm"},
                         {"label": "Loose case: 60 a night", "per_day": 60, "src": "visitor guides, not an official source", "url": "https://en.wikipedia.org/wiki/Turtle_Islands_National_Park"}],
                "rows": rows, "score": last["score"], "lo": last["score_low"], "hi": last["score_alt"], "band": band(last["score"]),
                "caveats": ["The limit is for overnight guests at one island, while the visitor count is for the whole park, so the score is only a rough indication.",
                            "Sources disagree on the limit (40, 50 or 60 a night); none is a Sabah Parks page.",
                            "An annual average understates pressure in the main turtle-landing season."]}
    return None


def waste_item(df, key, state):
    sub = df[df.destination == key]
    short = {"SANITARI": "sanitary landfill", "DUMPSITE": "dumpsite", "INSINERATOR": "incinerator", "TRANSFER": "transfer station", "LEACHATE": "leachate plant"}
    parts = []
    for _, r in sub.iterrows():
        for k, v in short.items():
            if k in r.facility_type.upper() and r["count"]:
                parts.append(f"{int(r['count'])} {v}")
    return {"n": f"Managed waste facilities, {state}", "v": f"{int(sub['count'].sum())} ({', '.join(parts) or 'none'})", "yr": 2020,
            "src": "SWCorp facility directory (archive.data.gov.my)", "scope": f"{state} state level, shared by every {state} destination"}


def main():
    coral = pd.read_csv(DATA / "coral_cover.csv").set_index("destination")
    pop = pd.read_csv(DATA / "population_district.csv")
    inc = pd.read_csv(DATA / "hh_income_district.csv")
    wp = pd.read_csv(DATA / "water_production.csv")
    wc = pd.read_csv(DATA / "water_consumption.csv")
    wf = pd.read_csv(DATA / "waste_facilities.csv")
    am = pd.read_csv(DATA / "hh_access_amenities.csv")
    # Seasonality: Google Trends (Malaysia) where fetched, else Wikipedia pageviews (keyless API, no rate limit).
    season = {}
    for fname in ("seasonality_wiki.json", "seasonality_trends_MY.json"):  # later file wins
        sp_ = DATA / fname
        if sp_.exists():
            season.update({k: v for k, v in json.loads(sp_.read_text()).items() if v.get("month_share")})
    # Mount Kinabalu: real monthly climber counts from Sabah Parks beat Wikipedia interest, so they replace it.
    kp = DATA / "kinabalu_climbers_monthly.csv"
    if kp.exists():
        k = pd.read_csv(kp)
        share = (k.climbers_avg / k.climbers_avg.sum()).tolist()
        season["Kinabalu / Kundasang"] = {
            "term": "Mount Kinabalu climbers", "source": f"Sabah Parks climber counts, monthly average {k.benchmark[0]}", "reliable": True,
            "month_share": [round(v, 4) for v in share], "peak_month": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][share.index(max(share))],
            "peak_share": round(max(share), 3), "effective_months": round(1 / sum(v * v for v in share), 1), "measures": "visits"}
    out = {}
    for name, sp in SPECS.items():
        st, real = sp["state"], []
        if sp["coral"]:
            vals = {c: float(coral.loc[c, "live_coral_cover_pct"]) for c in sp["coral"]}
            detail = ", ".join(f"{c} {v:.1f}%" for c, v in vals.items())
            real.append({"n": "Live coral cover", "v": f"{sum(vals.values()) / len(vals):.1f}%", "yr": int(coral.loc[sp["coral"][0], "year"]),
                         "src": f"Reef Check Malaysia ({detail})", "scope": "This destination only"})
        p = pop[(pop.destination == name) & (pop.sex == "both") & (pop.age == "overall") & (pop.ethnicity == "overall")].sort_values("date").iloc[-1]
        real.append({"n": f"Resident population, {sp['district']} district", "v": f"{p.population * 1000:,.0f}", "yr": int(p.date[:4]),
                     "src": "DOSM population_district", "scope": "District level"})
        i = inc[inc.destination == name].sort_values("date").iloc[-1]
        real.append({"n": f"Median household income, {sp['district']}", "v": f"RM {i.income_median:,.0f} / month", "yr": int(i.date[:4]),
                     "src": "DOSM hh_income_district (HIES)", "scope": "District level"})
        a = am[am.destination == name].sort_values("date")
        if len(a):
            a = a.iloc[-1]
            real.append({"n": f"Households with piped water / sanitation, {sp['district']}", "v": f"{a.piped_water:.0f}% / {a.sanitation:.0f}%", "yr": int(a.date[:4]),
                         "src": "DOSM hh_access_amenities (HIES)", "scope": "District level, resident households only (not visitors)"})
        prod = wp[(wp.destination == name) & wp.date.str.startswith("2022")].value.sum()
        cons = wc[(wc.destination == name) & wc.date.str.startswith("2022")].value.sum()
        real.append({"n": f"Water headroom, {st} (production minus consumption)", "v": f"{prod - cons:,.0f} MLD ({(prod - cons) / prod:.0%} of production)", "yr": 2022,
                     "src": "data.gov.my water_production / water_consumption (SPAN)", "scope": f"{st} state level, shared by every {st} destination"})
        if sp["waste"]:
            real.append(waste_item(wf, sp["waste"], st))
        out[name] = {"state": st, "district": sp["district"], "kind": sp["kind"], "lat": sp["lat"], "lon": sp["lon"],
                     "real": real, "gaps": sp["gaps"], "reported": sp.get("reported", []), "season": season.get(name),
                     "visitors": visitors_block(name), "prov": prov_block(name)}
    out.update(atlas_parks(pop, inc, am))
    real_ind = real_indicators()
    season_slim = {n: {k: v[k] for k in ("month_share", "reliable", "source", "term", "peak_month", "effective_months", "median_monthly_views", "measures", "ms_share", "term_share") if k in v}
                   for n, v in season.items() if v.get("month_share")}
    blob = json.dumps(out, indent=1, ensure_ascii=False)
    html = HTML.read_text(encoding="utf-8")
    assert 'id="pendingData"' in html, "pendingData block not found in HTML"
    new = re.sub(r'(<script type="application/json" id="pendingData">).*?(</script>)', lambda m: m.group(1) + "\n" + blob + "\n" + m.group(2), html, flags=re.S)
    assert 'id="seasonData"' in new, "seasonData block not found in HTML"
    new = re.sub(r'(<script type="application/json" id="seasonData">).*?(</script>)', lambda m: m.group(1) + json.dumps(season_slim) + m.group(2), new, flags=re.S)
    assert 'id="realIndicators"' in new, "realIndicators block not found in HTML"
    new = re.sub(r'(<script type="application/json" id="realIndicators">).*?(</script>)', lambda m: m.group(1) + json.dumps(real_ind, ensure_ascii=False) + m.group(2), new, flags=re.S)
    HTML.write_text(new, encoding="utf-8")
    print(f"Embedded {len(out)} pending destinations ({sum(1 for v in out.values() if v['season'])} with search seasonality, "
          f"{sum(1 for v in out.values() if v['prov'])} with provisional scores, {sum(1 for v in out.values() if v['visitors'])} with real visitor series).")


if __name__ == "__main__":
    main()
