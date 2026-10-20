# Malaysia tourism capacity indicators

Prepared 2026-10-07 for the AMBANG dashboard. Question: which factors and datasets should make up the capacity side (C) of the score, how should they be weighted, and what Malaysian data exists?

## How this was researched, and what is not covered

The five planned research subagents could not use web tools (every call failed with a classifier "no verdict" error), so none of their notes are usable. This report was done directly in the main session from search results and fetched pages. Limits:

- Claims below come from search-result summaries or fetched pages. Where I only saw a search summary and could not open the document, it says so.
- Not opened or read: the Reef Check solid waste and sewage PDF (search summary only, the file returned 404 when fetched), the DOE Environmental Quality Report 2023 PDF, the Kapas study PDF (fetched, but the text extract had no usable content), Greco et al. 2019 (existence and title confirmed, content not read).
- Items marked **Suggestion** are my own judgement, not published findings.

## Bottom line

1. The current capacity set (waste handling, water headroom, resident base, coral cover) is too thin and too state-level. Three of four indicators are identical for every island in a state.
2. The most binding capacity constraint on the islands is **sewage and waste infrastructure**, not water headroom or population. Sources below say so for Perhentian, Redang and Tioman.
3. There is **no open island-level dataset** for waste, sewage, energy or island water. Those need a small hand-built island scorecard built from published reports, labelled as such.
4. Real, published Malaysian weights exist for **Perhentian and Tioman** (an AHP study). They are the best available anchor for domain weights.
5. Do not train capacity weights with entropy (EWM): see the weighting section.

## Evidence by factor

### Ecological

| Factor | What exists | Source |
|---|---|---|
| Live coral cover | Reef Check Malaysia annual survey reports, 315 sites in 2024. National average live coral cover fell from 45.9% (2023) to 44.7% (2024); 63% of surveyed islands/areas declined; causes cited include unsustainable tourism, pollution, fishing and the global bleaching event. Reports exist for 2023, 2024, 2025. | [Reef Check 2024 summary](https://reefcheck.org.my/?p=138), [GCRMN](https://gcrmn.net/2025/02/06/reef-check-2024-malaysia/), [2025 report PDF](https://reefcheck.org.my/wp-content/uploads/2026/01/2025-Annual-Survey-Report.pdf) |
| Marine water quality | DOE Marine Water Quality Index. DOSM Environment Statistics 2025 reports island-area stations rated Excellent in 2024: Kedah 14, Pahang 9. DOE said Perhentian scored 96/100 ("excellent") in 2020 from three sites sampled six times a year. Per-island index values need the DOE Environmental Quality Report tables (not read). | [DOSM Environment Statistics](https://www.dosm.gov.my/uploads/release-content/file_20251231132611.pdf), [DOE EQR 2023](https://storage.data.gov.my/environment/eqr_2023.pdf), [FMT on Perhentian](https://www.freemalaysiatoday.com/category/nation/2022/06/12/perhentian-water-quality-one-of-the-best-says-doe) |

A caution: marine water quality is good on paper even where sewage is known to be poor (Perhentian scored 96 while only 2 of 13 resorts had adequate sewage treatment). It measures the sea, not the pressure behind it, so it should not be treated as proof that sewage capacity is fine.

### Infrastructure

| Factor | What is known | Source |
|---|---|---|
| Water | State-level only in open data. Water production and consumption by state are on OpenDOSM (CC BY 4.0, CSV and API), but the page says data are as of 31 Dec 2022 and no further updates are planned. Tioman reportedly has frequent water shortages. | [OpenDOSM water production](https://open.dosm.gov.my/data-catalogue/water_production), [OpenDOSM water consumption](https://open.dosm.gov.my/data-catalogue/water_consumption) |
| Solid waste | Redang and Perhentian together generate about 4 tonnes a day at peak, 70 to 80% food and organic waste. Redang spends about MYR 400,000 a year on municipal waste fees and Perhentian about MYR 870,000, with all waste shipped to the mainland. Tioman's incinerator is reported unable to cope with large volumes or e-waste. (Search summary of a Reef Check report; the PDF itself did not open.) | [Reef Check summary](https://reefcheck.org.my/s/Summary-Solid-Waste-and-Sewage-Management-on-Small-Inhabited-Islands-of-Malaysia.pdf) |
| Sewage | Perhentian: of 13 resorts surveyed, only 2 had adequate treatment. Tioman: two resorts over 20 years old had never desludged septic tanks; 2009 sampling found several sites highly contaminated with coliform bacteria. Redang: a resort-area stream regularly smells of sewage. On 31 July 2026 Utusan reported that all Terengganu tourism islands lack integrated sewage and solid waste systems, with a pilot sewage plant at Perhentian due by 2030. | [Reef Check summary](https://reefcheck.org.my/s/Summary-Solid-Waste-and-Sewage-Management-on-Small-Inhabited-Islands-of-Malaysia.pdf), [Utusan, 2026-07](https://www.utusan.com.my/berita/2026/07/pulau-pelancongan-terengganu-tiada-sistem-kumbahan-bersepadu/) |
| Energy | Perhentian and Redang rely on diesel generation; a projected 2027 mix is 22% renewable and 78% LNG. Tioman has about 676 kWp of solar plus two mini-hydro units totalling 500 kW. Programme: Pulau Tenaga Hijau. | [Suruhanjaya Tenaga PTH](https://www.st.gov.my/en/web/faqs/listing/24), [PV Tech](https://pv-tech.org/tnb-to-install-solar-and-mini-hydro-on-tioman-island) |
| Accommodation | Tourism Malaysia publishes hotel supply by state (2023: Pahang 33,387 rooms). No district-level breakdown found for Besut, Mersing or Rompin. | [Hotel supply 2023](https://data.tourism.gov.my/frontend/pdf/Malaysia-Hotel-2023-Supply-Statistics.pdf) |

SWCorp coverage (checked 2026-10-07 against the facility CSV the dashboard uses): the directory has columns for Perlis, Kedah, Negeri Sembilan, Kuala Lumpur, Melaka, Johor, Pahang, Perak and Terengganu. Selangor, Penang, Kelantan, Sabah and Sarawak have no column, so "waste facilities" cannot be compared for those states. (An earlier version of this report said Terengganu was outside SWCorp's remit, based on a search-result summary; the CSV shows it is covered.)

### Cameron Highlands

Research exists linking land-use change to river water quality in the highlands, and a GIS water quality model for the Bertam River for tourism planning. A 2017 news headline reported three Cameron rivers declared "dead". Land clearing, soil erosion and landslides are the documented pressures on river water. These support using **river water quality** as Cameron's ecological capacity indicator, but the dashboard currently holds a placeholder (0.35). Replace it with a real DOE river water quality index value for the Bertam and Telom basins. I did not find those values.

Sources: [UKM Bertam study](https://repoemc.ukm.my/handle/123456789/1598), [Springer review](https://link.springer.com/article/10.1186/s13717-018-0126-8), [land-use review](https://repoemc.ukm.my/handle/123456789/756), [NST 2017](https://www.nst.com.my/amp/news/exclusive/2017/04/231620/three-camerons-rivers-declared-dead).

### Social and resident factors

I found no source that makes resident population a capacity measure. Population is closer to a pressure measure (competition for water and waste services) or a labour supply proxy. I found no Malaysian host-community attitude data for these destinations. Treat "resident base" as weak until a sourced reason is found.

## Published Malaysian carrying capacity studies

- **Perhentian and Tioman, AHP weights (2022).** Management-indicator priorities from an Analytic Hierarchy Process study, by Nadia Mohd Nasir (IIUM). Perhentian: biophysical environment 0.291, planning control law 0.250, tourism facilities management 0.229, economic development 0.149, social-cultural 0.081. Tioman: tourism facilities management 0.344, planning control law 0.189, social-cultural 0.183, biophysical environment 0.148, economic development 0.136. Source: [IIUM repository](https://irep.iium.edu.my/74120/) (weights from search summary of the abstract). These are management indicator categories, not capacity indicators as such.
- **Pulau Payar (Lim, 1998, FAO/BOBP).** Combined a coral reef survey of dive sites with interviews of tourists, operators and divers. Criteria: physical, ecological, social, economic, availability of facilities and infrastructure, and human threats to reef. Concluded further tourism expansion was not desirable. I did not get the numeric capacity figures. [FAO](http://www.fao.org/4/X5626E/x5626e00.htm)
- **Pulau Kapas.** A study reports capacities of 22 visitors a day for hiking, 1,368 for snorkelling and 450 for beach picnic (from a search summary; I could not confirm it in the PDF). [HRMARS paper](https://hrmars.com/papers_submitted/18129/assessment-of-marine-tourism-carrying-capacity-a-case-study-at-kapas-island-marine-park-malaysia.pdf)
- **Pulau Redang.** A 2011 carrying capacity study exists ([UNISZA record](https://cendekia.unisza.edu.my/neuseal/Record/0000099939)); contents not read. Terengganu's government said in July 2026 that visitor numbers remain within the recommended capacity from studies of major islands including Redang.
- **Perhentian institutional framework (2017).** Found poor implementation of the carrying capacity guideline, with environmental quality degrading. No numbers. [Planning Malaysia](https://planningmalaysia.org/index.php/pmj/article/view/231)

## Weighting

What I could confirm from sources:
- The OECD/JRC composite indicator handbook treats equal weights as common practice when each pillar is seen as equally important, and describes the geometric mean as a "less-compensatory" aggregation where unbalanced performance is penalised. [JRC handbook](https://knowledge4policy.ec.europa.eu/sites/default/files/jrc47008_handbook_final.pdf)
- The Mazziotta-Pareto family penalises unbalanced indicator values and is described as non-compensatory. [Wikipedia](https://en.wikipedia.org/wiki/Mazziotta%E2%80%93Pareto_index), [arXiv on penalised power means](https://arxiv.org/abs/2206.11216)
- Greco et al. (2019) is the standard review of weighting, aggregation and robustness in composite indices. [Record](https://ideas.repec.org/a/spr/soinre/v141y2019i1d10.1007_s11205-017-1832-9.html) I did not read its conclusions.

**Suggestions (my judgement, not published findings):**

1. **Do not use entropy weights for capacity.** With 15 destinations and state-level values repeated across islands, entropy would give near-zero weight to those indicators and reward only coral cover. That is the wrong direction for a design meant to catch the weakest link.
2. **Anchor domain weights to the Perhentian and Tioman AHP.** Averaging the two islands gives ecological about 0.22, facilities about 0.29, social about 0.13. Dropping the planning-control and economic categories (governance and pressure, not capacity) and renormalising gives roughly **ecological 0.35, infrastructure 0.45, social/resident 0.20**. Split within domains: ecological = coral cover 0.25 and marine water quality 0.10; infrastructure = sewage 0.15, waste 0.12, water 0.10, energy 0.08.
3. **Keep the geometric mean and add a weakest-link flag.** Show each destination's single lowest capacity indicator (already done) and consider a cap or penalty when it falls below a floor.
4. **Test sensitivity.** Perturb the weights randomly and report how often a destination's band changes. Flag destinations whose band is unstable.
5. **Label the weights as the team's assumptions.** No published Malaysian capacity weights were found beyond the single Perhentian/Tioman AHP study.

## Recommended capacity indicator set

| Indicator | Per island? | Data | Status |
|---|---|---|---|
| Live coral cover | Yes | Reef Check annual reports | Already in the dashboard |
| Marine water quality index | By station area | DOE EQR tables, DOSM Environment Statistics | Needs extraction |
| Sewage treatment adequacy | Island | Reef Check summary, Utusan 2026, resort surveys | Hand-built scorecard, no open dataset |
| Solid waste handling | Island | Reef Check summary (tonnes/day, costs, shipping to mainland); SWCorp state facility counts | Island scorecard plus current state count |
| Water supply | Island | Island reports only; state data stale (2022, no further updates) | Scorecard; keep state figure as a fallback |
| Energy supply | Island | Pulau Tenaga Hijau, TNB (Tioman hybrid, Perhentian and Redang diesel) | Scorecard |
| River water quality (Cameron) | Basin | DOE river WQI, Bertam and Telom | Replace placeholder |
| Resident base | District | DOSM | Weak as a capacity measure; consider dropping or moving to pressure |

## Open gaps (not found or not read)

- Per-island marine water quality values from the DOE Environmental Quality Report.
- Actual figures from the Reef Check solid waste and sewage PDF and from the Kapas, Redang and Payar studies.
- Any Department of Marine Park Malaysia official visitor limits.
- District-level accommodation (rooms or beds) for Besut, Setiu, Mersing, Rompin and Cameron Highlands.
- Real DOE river water quality values for the Cameron basins; Cameron road traffic and landslide data.
- Any other published Malaysian weights beyond the Perhentian/Tioman AHP.
- Host community attitude data.

## Suggested next steps

1. Decide whether to build the island scorecard (sewage, waste, water, energy) as a small JSON file with a source URL and year per value, scored 0 to 1 by explicit rules.
2. Extract marine water quality and Cameron river values from the DOE EQR 2023 PDF.
3. Rerun the weakest-link and sensitivity checks once weights are set.
