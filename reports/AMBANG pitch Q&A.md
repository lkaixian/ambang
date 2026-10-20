# AMBANG pitch Q&A

Prepared 2026-10-07. Short answers first, evidence behind each. Everything below matches what the dashboard actually does today. Where something is not done, the answer says so, because a judge who finds an overclaim will doubt the rest.

## The idea

**What is AMBANG?**
An early-warning score for Malaysian marine and highland tourism sites. Score = 100 x P / (P + C): visitor pressure (P) against what the place can absorb (C). 50 is the threshold where the two are equal. Bands: Green below 45, Amber 45 to 60, Red 60 to 75, Critical above 75.

**Why a ratio, and why a geometric mean?**
The ratio makes the threshold meaningful (50 = pressure equals capacity). P and C are weighted geometric means so one binding constraint, such as no sewage treatment on a small island, cannot be hidden by abundance elsewhere. The OECD/JRC composite-indicator handbook describes the geometric mean as a less-compensatory aggregation where unbalanced performance is penalised.

**Who is it for?**
Park managers and planners deciding where to apply quotas, pricing or infrastructure first. The page tells each destination's single lowest capacity indicator ("binding constraint") so the response is specific.

## The data, honestly

**Is the data real?**
Partly, and the dashboard marks which parts. Real, fetched from Malaysian sources: marine park visitor counts by state (Department of Marine Park Malaysia, 2000 to 2017), live coral cover per island (Reef Check Malaysia, 2025/26), waste facilities by state (SWCorp, 2020), water production and consumption by state (SPAN via data.gov.my, 2022), district population and household income (DOSM). Still illustrative: hotel arrivals, accommodation density where OpenStreetMap found nothing, Cameron Highlands seasonality, and the apportioning of state figures down to each island. The dashboard says this on screen and in the AI assistant's instructions.

**Which pressure values are real now?**
Three of six pressure indicators have real inputs for the scored islands: marine park visitors (state level, largest weight, 45.3%), cost of living (district income), and, since October 2026, seasonality (how concentrated real marine park visits were across the months of 2017, state level) and occupancy (Tourism Malaysia state hotel occupancy, 2015 to 2019 average). Accommodation density uses an OpenStreetMap count where it found any accommodation, which undercounts, so it is a rough ranking. Hotel guest arrivals have no machine-readable open source and stay illustrative. Cameron Highlands keeps a placeholder for seasonality and accommodation. Each bar on a destination page says whether it is real.

**The visitor counts stop at 2017. Is that a problem?**
Yes. The portal that holds them has no 2018 to 2023 series. The next step is to request those years from the Department of Marine Park Malaysia. Until then the score describes relative pressure, not today.

**Where do the weights come from?**
Pressure weights are trained with the Entropy Weight Method: an indicator that varies a lot across destinations gets more weight. We did not train a supervised model because the score is derived from the same indicators, so there is no independent target. Important caveat: the training matrix is mostly illustrative values, so treat the weights as a working pipeline, not a finding. Capacity indicators are equal-weighted today.

**Why not weight capacity with entropy too?**
Most capacity indicators are state-level, so every island in a state shares the same value. Entropy would give those near-zero weight and reward only coral cover, which is backwards for a weakest-link design.

## The destinations

**Why these places?**
The 14 marine islands are Peninsular Malaysia's gazetted marine parks that Reef Check actually surveys (Terengganu, Pahang, Kedah, Johor), plus Cameron Highlands as the highland comparison. Johor's park has about 20 islands but only four have a coral series, so we track those four.

**Why are Sabah, Sarawak, Langkawi, Pangkor and Fraser's Hill on the map but unscored?**
They are the next-best-documented sites, but none has a real visitor-count series like the scored islands. Scoring them on invented numbers would make them look comparable when they are not. Each page shows the real data we have (coral cover, district population and income, state water, state waste where covered) and lists what is missing. It doubles as our data roadmap.

**Why those specifically?**
Langkawi is the gateway to the Payar marine park we already score. Pangkor adds a west-coast island. Fraser's Hill is a second highland next to Cameron. Miri is the only Sarawak reef with data. Sipadan/Mabul and Tunku Abdul Rahman Park are Sabah's best-documented reefs; Kinabalu/Kundasang is a Sabah highland.

**Do any of the unscored places have a score now?**
Three have a provisional one. Sipadan / Mabul, Kinabalu / Kundasang and Tunku Abdul Rahman Park score from real Sabah Parks numbers set against a daily limit (dive permits, climber quota, and for Tunku Abdul Rahman Park a 2022 University Malaysia Sabah carrying-capacity study): average daily visitors divided by the limit, scored 100 x U / (U + 1), so exactly at the limit scores 50, our threshold. Sipadan comes out at about 35 (range 35 to 44) and Kinabalu at about 45 (range 41 to 50), higher in its peak month. They are shown as ranges because the limits have changed and sources disagree (Sipadan 120, then 176, then 252 from January 2026), and they are not comparable with the six-indicator scores. Tunku Abdul Rahman Park comes out at about 44 (range 30 to 44; about 52 on a festive peak day), an academic estimate rather than an official limit. Langkawi has real arrivals (LADA) but no limit or capacity study with a number, so it stays unscored, as do Pangkor, Fraser's Hill and Miri.

**Why not just score Langkawi from LADA's arrivals?**
Arrivals alone are a volume, not a pressure. LADA counts everyone landing on the island (3.2M in 2025), against the Peninsula marine-park series of 116k to 293k a year. On that scale Langkawi, Tunku Abdul Rahman Park and Kinabalu all saturate at the top and Sipadan sits at the bottom, so the numbers would say nothing. We tested it and chose not to publish it.

**Why not Selangor or Penang?**
No gazetted marine park, no Reef Check reef, and SWCorp's facility directory has no column for either. There would be almost nothing real to show.

**You said Fraser's Hill was set aside. Why is it here?**
It was set aside for very low tourism volume and unverified data. It is now tracked but unscored, to see whether real data supports scoring it.

## The method choices a judge may probe

**How did you decide what counts as "capacity"?**
We researched Malaysian carrying-capacity work. Published Malaysian weights exist for Perhentian and Tioman (an AHP study by Nasir, IIUM, 2022). Island sewage and waste handling emerge as the binding constraints: only 2 of 13 resorts on Perhentian had adequate sewage treatment, and Terengganu's government acknowledged in July 2026 that its tourism islands lack integrated sewage systems. Our current capacity indicators do not yet include sewage, island waste or energy because there is no open island-level data. The report lists the proposed fix: a small island scorecard built from published reports, with sources.

**Are your capacity weights decided?**
No. Today they are equal. The research report proposes domain weights (ecological 0.35, infrastructure 0.45, resident 0.20) anchored to the Perhentian/Tioman AHP study. They are labelled as our assumptions and have not been applied.

**Why does the score barely change between EWM and equal weights for some islands?**
The score is a geometric mean of six indicators. Where an island's indicators sit close together, reweighting cannot move it much (Rawa: 54 either way). Where one indicator is far from the rest it matters (Payar: 25 under EWM, 40 under equal). The detail page shows both side by side.

**Does the language of the search matter?**
Yes, a lot. Malaysians search in Malay ("Pulau Redang", "Bukit Fraser"), while English terms mostly capture foreign travellers, and the two can differ in size and in season. For Wikipedia we sum English and Malay pageviews (Malay adds roughly a quarter to a half on top of English for Tioman, Redang and Perhentian). For Google Trends we ask for Malay and English terms in one chart so they share a scale and can be added. An English-only curve would understate local interest.

**Is there official hotel guest data?**
Yes, at state level: Tourism Malaysia's hotel survey, on archive.data.gov.my, domestic and international guests by state, yearly 2015 to 2022. We do not use it in the island score because a state total does not describe an island. Pahang's total is mostly Genting Highlands (about 11.0M guests in 2017 against 1.8M for Terengganu), which has nothing to do with Tioman or Cameron, while Terengganu and Johor city hotels hide how busy Perhentian, Redang or Sibu are. Correcting it for Genting would need an invented share. So hotel arrivals stays a labelled placeholder and the state series is context only.

**What about seasonality and weather?**
Google Trends weekly search interest (5 years) is collected as a proxy for seasonality, with a low-volume flag: destinations with over 30% empty weeks are marked unreliable and not scored. The worldwide run showed only mild seasonality for popular islands, because it mostly reflects trip planning; a Malaysia-only run is in progress. Weather: the Malaysian Meteorological Department's open API keeps no history, so we log its daily forecast ourselves. The weather-versus-interest correlation needs 26 paired weeks and will not print a number before then.

**Does the AI summary send our data anywhere?**
The AI summary and chat run through a small Node server that holds the ILMU key, so no key is ever in the page or the browser. Identical questions are answered once and shared across visitors (24 hour cache), and each visitor and the whole site are rate-limited, which caps cost.

## What is next (use as your close)

1. Obtain 2018 to 2023 park visitor counts from the Department of Marine Park Malaysia.
2. Build the island sewage, waste and energy scorecard from published sources, then retrain the weights on real values.
3. Add real river water quality for Cameron Highlands and the other highlands.
4. Finish the Google Trends and weather logging so seasonality and weather correlation are measured, not assumed.
5. Score the unscored places as soon as each has a real pressure series.

## Three answers to avoid

- Do not say the scores are "accurate" or "validated". Say they are relative and transparent, with every proxy named.
- Do not quote visitor numbers for 2018 to 2023. We do not have them.
- Do not say the Trends or weather work shows seasonality yet. Say the pipeline is built and the domestic run is in progress.
