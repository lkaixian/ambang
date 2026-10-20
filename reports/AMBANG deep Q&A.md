# AMBANG deep Q&A: technical, ML/AI, ecological, economic, business, political

Prepared 2026-10-18 as a companion to `AMBANG pitch Q&A.md` (which covers the pitch itself). This file is for the hard follow-up questions.

**How to read the tags.** Every answer says what kind of claim it is, so you never present a guess as a fact.

- **[Project]** checked against our own code, data or a computation run on 2026-10-18.
- **[Source]** taken from an outside source, linked in the Sources list at the end. These were read through search summaries, not full documents, so open the link before quoting a number on stage.
- **[Judgement]** our reasoning or recommendation.
- **[Unverified]** background knowledge we have not checked. Do not quote.

---

## Part 1. Technical

**What is the architecture, in one breath?**
[Project] A static front end (pages plus JSON data files) behind nginx, with a small Node server that holds the AI key and answers `/api/ai`, Redis for a shared answer cache and shared limits, and a Cloudflare tunnel in front. All four run as Docker containers on one Oracle Cloud server. Scores are computed in the browser from the data files, so the score itself needs no database and no server call.

**How is the score computed?**
[Project] Score = 100 × P / (P + C). P is a weighted geometric mean of six pressure indicators, C a weighted geometric mean of the capacity indicators, each scaled 0 to 1. A score of 50 means pressure equals capacity. Bands: Normal below 45, Warning 45 to 60, Alert 60 to 75, Critical 75 and up. Values are floored at 0.03 so a single zero cannot collapse a geometric mean.

**Why compute in the browser?**
[Project] The same code serves the new and classic views, the what-if sliders react instantly, and the page works even if the AI server is down. [Judgement] The cost is that the whole data set is public in the page, which is acceptable here because everything in it is open data or labelled illustrative.

**How is the API key protected?**
[Project] The key lives only in the server's environment file. The browser never sees it, and the server scrubs keys out of its own error messages. The server only accepts prompts that start and end with our fixed text, caps request size at 120 KB, and rate-limits per visitor, per site per day, and at nginx. [Judgement] This does not make abuse impossible, it makes it cheap to contain.

**What stops someone running up the AI bill?**
[Project] Three layers: nginx limits (300 requests a minute per visitor), the app's per-visitor limit for uncached calls (`RATE_PER_MIN`, 15 by default), and a site-wide daily cap (`DAILY_CAP`). Identical questions are answered once and shared for 24 hours, and the suggested questions were pre-warmed on 2026-10-18 (98 questions, 0 failures), so the commonest clicks cost nothing. We saw no throttling at all when firing 300 test calls and then the 98 real ones.

**Is the system redundant?**
[Project] Partly. Containers restart on failure, nginx can serve cached pages if the app is down, and the AI call has three rotating keys plus a backup model. [Project] It is still one server, one nginx, one Redis and one tunnel connector, so a server outage is a site outage. [Judgement] For a prize-demo and pilot this is proportionate. A second node behind a Cloudflare load balancer is the next step if it becomes a real service.

**How does key rotation work, and was it tested?**
[Project] Key 1 is used until ILMU answers 429 (rate-limited) or 402 (out of quota). That key is then parked (at least 5 seconds, an hour if out of quota) and the call moves to key 2, then 3. We tested the logic against a mock provider that limited key 1 and then key 2, and it behaved as designed. [Project] We have not yet seen ILMU limit a key in production, because 300 small calls and 98 real ones were never limited. A wrong key gives 401 and goes to the backup model, not the next key. The "which key is cooling down" memory is per container, which matters only if several app replicas run.

**What broke during testing, and what did you learn?**
[Project] Two real faults, both fixed or fixable. First, the "who needs attention" brief was refused with "I can only answer questions about this dashboard" because its prompt (744 characters) exceeded the 600-character limit that identifies a page brief, so it was treated as a chat message and rejected by the topic filter. Second, that refusal was then cached for 24 hours, so pressing Regenerate kept returning it. The limit is now 900 characters with a fixed prefix check; the cached refusal is purged by deleting its one Redis key. [Judgement] The deeper lesson is that refusals should never be cached, which is a one-line change we recommend.

**Is it tested?**
[Project] No automated test suite. We have scripted checks (a mock-provider rotation test, a headless-browser run of every suggested question that records each answer to a file) and manual review. [Judgement] Say "scripted checks and review", not "fully tested".

**How do you update the data?**
[Project] Python scripts in `scripts/` fetch open data (data.gov.my, DOSM, SPAN, SWCorp, Reef Check, OpenStreetMap, Wikipedia, Google Trends exports) into `data/`, and a build step writes the JSON the page reads. Deploying is: rebuild the archive, upload, rebuild the container. [Judgement] It is repeatable by one person, not yet automated.

**Why not a database?**
[Judgement] The data is small (the largest file is about 135 KB) and changes a few times a year. A static JSON file is faster, cheaper and easier to audit than a database for this.

---

## Part 2. ML and AI (the part most likely to be probed)

**Is this machine learning?**
[Project] Honestly, only loosely. The weights use the Entropy Weight Method, a statistical method that is unsupervised, with no train/test split and no prediction. The AI assistant is a large language model used for writing explanations from the numbers on the page. Everything that produces the score is a closed-form formula. [Judgement] Say "a transparent statistical score, with an LLM for explanations", not "an ML model". A judge who finds the gap between the label and the method will discount the rest.

**What does the Entropy Weight Method do?**
[Project] For each indicator it measures how unevenly the 15 places are spread: an indicator where all places look alike has high entropy and gets little weight, one that separates places gets more. [Source] The OECD/JRC composite-indicator handbook treats weighting as a value judgement and recommends testing it, and describes statistical methods like this as describing data structure, not importance.

**Why not a supervised model?**
[Project] There is no independent label. The historical "score" is derived from the same indicators, so fitting a model to it would fit the formula back onto itself. A real label would be an observed outcome (a closure, a reef decline, a sewage incident). We do not have a series of those at island level.

**Are the weights in the dashboard trustworthy?**
[Project] This is the weakest point, and you should say so first. On 2026-10-18 we recomputed the entropy weights on the dashboard's current data and they do not match the stored ones:

| Indicator | Stored in dashboard | Recomputed on current data |
|---|---|---|
| Visitors | 45.3% | 36.2% |
| Accommodation | 20.2% | 23.9% |
| Hotel arrivals | 12.4% | 10.0% |
| Seasonality | 7.3% | 18.8% |
| Cost of living | 10.1% | 8.1% |
| Occupancy | 4.6% | 3.1% |

[Project] The stored weights were produced when more of the matrix was placeholder; real seasonality, occupancy and accommodation values were swapped in afterwards and the weights were not refreshed. Seasonality moves most (7% to 19%). [Judgement] The honest line is "the weights are a working pipeline that must be re-run on real data, and here is how much they would change". Re-running `scripts/train_weights.py` and updating the stored weights is a small job we recommend before any final submission, but it will shift scores.

**How stable are the weights?**
[Project] We bootstrapped the 15 places 2,000 times. The 5th to 95th percentile ranges are wide: visitors 22% to 51%, accommodation 14% to 35%, seasonality 12% to 25%. Dropping any single place moves a weight by up to 4.9 percentage points. [Judgement] With 15 places and six indicators, the weights are estimates with large error bars. Report them as ranges.

**Do the rankings survive different weights?**
[Project] Mostly. Ranking the places by pressure alone, equal weights and entropy weights agree closely (Spearman rank correlation 0.97). Across 2,000 random weightings the median correlation with the entropy ranking is 0.93, but the 5th percentile is 0.75, and the same top three places appear in only 55% of draws. The top-ranked places on pressure are Perhentian, Cameron Highlands, Redang and Tioman. This is pressure alone, not the final score, which also involves capacity. [Judgement] So "which places are highest" is fairly robust. The exact order near the top is not.

**Why does hotel arrivals carry 10 to 12% weight when it is entirely a placeholder?**
[Project] That is a flaw we cannot hide. Entropy measures spread, and the placeholder spread is itself a made-up number. Real data exists at state level (Tourism Malaysia's hotel survey, yearly, 2015 to 2022) but a state total does not describe an island: Pahang's figure is dominated by Genting Highlands (about 11.0M guests in 2017 against 1.8M for Terengganu). [Judgement] Options are to keep it as a labelled placeholder (current), or drop it and re-weight. We chose the first for honesty and a stable structure. Say so plainly.

**Why a geometric mean?**
[Source] The OECD handbook describes geometric aggregation as less compensatory: weakness in one indicator is not fully offset by strength in another. [Project] That fits carrying capacity, where one binding constraint (island sewage) is not rescued by abundant water. It is only partly non-compensatory, so a weak indicator drags the score but cannot hold it at zero.

**What is the 0.03 floor, and does it matter?**
[Project] A geometric mean with a true zero collapses to zero. We floor every indicator at 0.03. [Judgement] The value is a judgement; it matters most for places with a near-zero indicator (for example Payar and Lembu on visitor volume, which sit at 0.05 and 0.03). We have not published a sensitivity test of the floor.

**Has the score been validated?**
[Project] No. It has face validity (the places that rank highest are the well-known pressure cases), but no independent check. [Judgement] Never say "accurate" or "validated". A credible validation design: compare scores against observed outcomes such as the 2024 bleaching survey results by island, closure or sewage incidents, and visitor-complaint records, with the caveat that bleaching is climate-driven and not caused by visitors.

**What is the uncertainty on a score?**
[Project] Not yet quantified at score level. What we can say today: weights vary widely (above), many inputs are state-level and shared across islands, and some are illustrative. [Judgement] The right next step is Monte Carlo: resample weights, perturb placeholders within plausible ranges, and report each place's band as a probability (for example "72% Alert, 28% Warning"). This is the OECD-recommended uncertainty analysis.

**What are the biggest sources of bias?**
[Project] (1) State-level values shared by every island in a state, so islands cannot differ on those indicators. (2) OpenStreetMap undercounts small resorts, so remote islands look emptier than they are. (3) Search-interest data reflects who searches in which language; Malay and English terms differ in size and season. (4) A single 2017 year of marine park visits drives seasonality. (5) Visitor counts stop at 2017. [Judgement] None is fatal for a relative early-warning view, but together they mean "relative and transparent, not precise".

**What would real ML add, and when?**
[Judgement] In order of value: (1) **Partial pooling (hierarchical model)** to estimate island-level values from state-level data without inventing them, with honest uncertainty. (2) **Seasonal forecasting** on monthly visits once 2018 to 2023 counts are obtained, for early warning ahead of peaks. (3) **Anomaly detection** on weekly search and weather logs. (4) **A supervised model** only after event labels exist (closures, bleaching surveys, incidents) so there is something real to predict. Not before.

**How does the AI assistant work?**
[Project] The page assembles the current numbers (scores, indicators, weights, real-versus-illustrative flags) into the prompt each time, so the model answers from the live data, not from memory. The server then adds a fixed rules block that tells it to answer only from that data, say when something is illustrative, quote only numbers present, and refuse anything off-topic. Temperature is 0.2 for consistent wording. There are no tools, no web access and no stored conversations.

**How do you stop it hallucinating?**
[Project] You reduce the risk, you do not remove it. Controls: the answer is grounded in supplied data, a rules block forbids inventing numbers, answers are short, and the page says "Written by a language model from the data in this dashboard. Check it against the numbers on the page." [Project] We have no automated factuality evaluation. We spot-checked the first cached answer against the dashboard (Terengganu averaging 74, Perhentian 79, Redang 78 all matched) but did not read all 98. [Judgement] The right claim is "grounded and labelled", not "always correct".

**How do you stop prompt injection and misuse?**
[Project] The server only accepts prompts built from our fixed head and tail text, and rejects any extra rules block hidden in the data. Chat questions pass a topic filter (suggested questions and questions naming a tracked place skip the model check; others are classified by a second model call that answers YES or NO), and the answering prompt repeats a scope rule last. Page briefs skip the filter because they are fixed text. [Project] That shortcut caused the false refusal described in Part 1. [Judgement] The filter is a layered defence, not a guarantee. A determined user can probably find an edge case.

**Does user data go to the AI provider?**
[Project] The prompt sent to ILMU contains the dashboard data plus the user's question. The log lines we saw show a short hash prefix, not the question text; the visitor's IP is used for rate limiting. [Unverified] Whether ILMU retains prompts is governed by their terms, which we have not reviewed.

**Why use ILMU?**
[Project] It is the sponsor's model and the project is built for that ecosystem. [Judgement] The server calls a standard chat-completions endpoint, so swapping provider is a configuration change, not a rewrite.

**Is the system explainable?**
[Project] Yes, which is its main ML-adjacent strength. Every score is a closed formula, each indicator's value, weight and source is on the detail page with a "real" or "placeholder" tag, and the what-if sliders show how the score moves. No black box sits between the data and the number.

---

## Part 3. Ecological

**Why is carrying capacity the right frame?**
[Source] The idea is contested. Reviews note that the factors behind capacity are often treated as fixed but change, that experience quality is subjective, and that enforcing capacity limits is hard. Frameworks such as Limits of Acceptable Change and VERP respond by monitoring conditions against agreed thresholds instead of fixing a number. Butler argues the opposite risk, that such approaches allow creeping development, and favours identifying maximum appropriate numbers. [Judgement] AMBANG is closer to the monitoring side: it gives a relative, updatable early-warning score, not a legal visitor cap.

**What ecological evidence does the score actually use?**
[Project] Live coral cover per island (Reef Check Malaysia, 2025/26) is the one direct ecological measurement and is labelled as such. Water headroom and waste handling are state-level infrastructure proxies. Cameron Highlands uses a river water quality placeholder. [Judgement] Ecological coverage is real for coral and thin everywhere else.

**What does the 2024 bleaching event mean for the score?**
[Source] Malaysia's Department of Fisheries reported mass bleaching in June 2024 affecting more than half of surveyed marine-park reefs, naming Pulau Payar, Perhentian, Redang, Tenggol, Tioman and Pemanggil, mostly in shallow water. The department said bleaching above 80% would trigger further measures, including temporary access restrictions. I found no report of 2024 island closures, though closures were used in earlier events such as 2010. [Judgement] Bleaching is driven by warm water, not visitors, so it is not what AMBANG measures. But a reef already stressed by heat has less margin for visitor pressure, which supports tracking coral cover as the capacity indicator and re-surveying after events.

**Is sewage really the binding constraint on the islands?**
[Source] Terengganu's government acknowledged in July 2026, per Utusan, that its tourism islands lack an integrated sewage system, while a treatment plant on Perhentian is under construction. A May 2026 viral video alleged sewage pumped near a Perhentian resort jetty; the resort said the arrangement was temporary during modification works. [Project] Our capacity indicators do not include sewage yet because there is no open island-level data. This is the largest known gap between what matters and what the score measures, and the next-steps list says so.

**What about Cameron Highlands?**
[Source] Reports in 2026 describe forest and slope clearing with silt washing into the Sultan Abu Bakar dam, and earlier reports describe landslide, flood and river-pollution risks, with a federally led restoration effort (Ops Gading, reported at RM2.2 billion). [Project] Cameron's AMBANG score is built partly on placeholders (seasonality, accommodation, river water quality), so treat it as the least certain of the scored places. [Judgement] Its pressure is as much about land use and agriculture as visitor numbers, so a visitor-based score understates the ecological risk there.

**Does a flat year-round pattern mean low pressure?**
[Judgement] No. Seasonality in the score means how bunched visits are across months. A place busy all year (like Cameron appears to be) scores low on that indicator, but has no quiet season for the environment to recover. Volume is carried by the visitor and accommodation indicators, not seasonality. This is a known limit of the indicator, not a data error.

---

## Part 4. Economic

**Why does the economy matter to this project?**
[Source] DOSM's Tourism Satellite Account shows tourism value added of RM323.0 billion in 2025, 15.9% of GDP, 3.7 million jobs (22.1% of employment), and inbound tourism expenditure of RM124.8 billion, up 16.5%. For 2024 the figures were 15.1% of GDP and 21.6% of employment. [Judgement] A sector this large cannot simply be capped, so the argument is about protecting the asset that earns the revenue, not restricting the sector.

**Is there a conflict between the growth target and capacity?**
[Source] Visit Malaysia 2026 was set at 35.6 million arrivals and RM147.1 billion, and the minister said in January 2026 the targets might be revised upward because arrivals were running ahead (38 million were reported for 2024). The National Tourism Policy 2020 to 2030 lists a commitment to sustainable tourism among its six thrusts. I found nothing in these sources on carrying-capacity limits. [Judgement] National targets count arrivals; none of them is a place-level load limit. AMBANG fills that gap with a place-level view, and we should say that, not claim the policy ignores sustainability.

**Why include cost-of-living pressure?**
[Project] It uses DOSM's median household income by district to capture the squeeze on residents. [Judgement] It treats the host community as part of capacity, in line with social-capacity thinking, but the value is a district figure apportioned to islands, so it is a rough signal.

**What are the economic costs of over-tourism that a score could help avoid?**
[Judgement] Reef degradation lowers the dive and snorkel product itself; sewage incidents harm reputation (a viral video alone drew a public response); infrastructure under-built for peak loads costs more to retrofit; and a closure after damage costs more than a managed quota before it. These are reasoned arguments; we have no Malaysian cost figures to cite.

**Is there a revenue angle?**
[Judgement] A score that locates pressure first lets agencies target conservation charges, jetty or sewage spending, and quotas where they bind. [Unverified] We have not researched current marine-park entry or conservation charges, so do not quote amounts.

---

## Part 5. Business impact and use

**Who would use it and for what decision?**
[Judgement] Marine park and fisheries managers deciding where to apply quotas first, state tourism bodies deciding where to put sewage and jetty money, and operators or planners reading a place's weakest indicator as a to-do list. The dashboard names each place's lowest capacity indicator as its binding constraint.

**What does it cost to run?**
[Project] One small server, an open-source stack, and an AI bill capped by rate limits and a 24-hour answer cache. Pre-warming the suggested questions means the commonest clicks cost nothing. [Judgement] The cost is far below a consultancy study, and the data pipeline is reusable.

**What is the business model?**
[Judgement] This is a public-good tool, so likely funded by a grant, an agency contract or a university partnership, not subscriptions. We have not built a business case, so do not present one as a plan.

**What is the real risk of publishing a "Critical" label?**
[Judgement] A place labelled Critical on partly placeholder data can harm operators' bookings and invite a dispute about the numbers. That is why the dashboard marks placeholders, shows provisional scores only as ranges and "not comparable", and the Q&A tells presenters never to call scores accurate. An early-warning label should prompt a check, not a penalty.

**What would make this adoptable by an agency?**
[Judgement] Current visitor data (2018 onward from the Department of Marine Park Malaysia), real sewage and waste data for the islands, an agreed weighting from their own experts (the weights are currently ours), and score uncertainty ranges. The first two depend on agency data we cannot get alone.

---

## Part 6. Political and governance

**Who owns the decisions this score would inform?**
[Unverified] In Malaysia, land is generally a state matter, marine parks are gazetted under federal fisheries law, and tourism spans both levels, so a place's carrying capacity can involve a state government, the federal Department of Marine Park and local councils at once. [Judgement] This is why a neutral, public, sourced score is useful: it gives agencies a shared reference. It also means a score alone changes nothing; enforcement sits with agencies we do not control.

**Is weak enforcement a risk to the whole idea?**
[Source] Environmental groups and commentators describe weak enforcement and governance problems in Cameron Highlands, with federal intervention described as a sign of doubts about local administration. These are allegations from advocacy sources, not findings. [Judgement] A score can show where pressure is high, but it cannot fix enforcement. We should say AMBANG informs prioritisation, not compliance.

**Could the score be politically misused?**
[Judgement] Yes, both ways: a high score could be used to blame a state or operator, a low score to justify growth. Mitigations built in: every indicator shows its source and status, weights are visible, and what-if tools let users test assumptions. We recommend publishing the weight uncertainty and letting agencies set their own weights.

**What is the open-data position?**
[Project] Inputs come from open portals (data.gov.my and its archive, DOSM, SPAN, SWCorp, OpenStreetMap, Reef Check's public map data), and each indicator shows its source. The state hotel-guest datasets are published by Tourism Malaysia under a Creative Commons Attribution licence. [Unverified] Licence terms for each remaining source should be checked before a public release.

**Is personal data involved?**
[Project] The site stores no accounts or questions. The server uses the visitor's IP address for rate limiting (we did not check exactly where or how long it is held). [Unverified] Whether this triggers obligations under Malaysia's Personal Data Protection Act 2010 should be confirmed with someone qualified before a public launch.

**How does this relate to national policy?**
[Source] The National Tourism Policy 2020 to 2030 is described as part of Malaysia's commitment to sustainable and responsible tourism under the UN Sustainable Development Goals, and our own reef indicator is framed against Goal 14. [Judgement] AMBANG is complementary: the policy sets direction, and place-level early warning is a tool for carrying it out.

---

## Part 7. The hard questions, short

**"Is this real data?"** Partly, and the page tags every indicator. Real: coral cover, marine park visitors (to 2017), occupancy, waste, water, district income and population, seasonality for 14 places. Still placeholder: hotel arrivals, Cameron's seasonality and accommodation, river water quality, some accommodation counts.

**"Can I trust the weights?"** They are a reproducible method run on 15 places and currently out of date; recomputed on today's data they differ noticeably (seasonality 7% versus 19%), and their uncertainty is wide.

**"Is it validated?"** No. It is face-valid, transparent and relative. A validation plan exists (bleaching surveys, incident and closure records).

**"Why should I believe the AI?"** You shouldn't without checking. It is grounded in the page's data, refuses off-topic requests, and is labelled as machine-written.

**"What is the single biggest gap?"** Island-level sewage and waste data, and visitor counts after 2017.

## Three answers to avoid

- "The score is accurate" or "validated". Say relative, transparent, with every proxy named.
- "We trained a machine-learning model". Say Entropy Weight Method, an unsupervised statistical weighting.
- Quoting any 2018 to 2023 park visitor number, or any marine-park charge, closure or limit we have not sourced.

---

## Sources

All read through search summaries on 2026-10-18; open the link before quoting a number.

- DOSM Tourism Satellite Account 2025: https://www.dosm.gov.my/portal-main/release-content/tourism-satellite-account-2025
- DOSM Tourism Satellite Account 2024: https://www.dosm.gov.my/portal-main/release-content/tourism-satellite-account-2024
- Visit Malaysia 2026 targets (Business Today): https://www.businesstoday.com.my/2024/03/14/malaysia-targets-35-6-million-tourist-with-rm147-1-billion-revenue-for-vmy2026/
- National Tourism Policy 2020 to 2030 (MIDA): https://www.mida.gov.my/revitalising-tourism-and-hospitality-under-the-national-tourism-policy-2020-2030/
- 2024 coral bleaching (Free Malaysia Today): https://www.freemalaysiatoday.com/category/nation/2024/06/23/50-of-marine-park-coral-reefs-suffering-from-warmer-seas
- 2024 coral bleaching (NST): https://www.nst.com.my/amp/news/nation/2024/06/1067333/fisheries-dept-confirms-mass-coral-reef-bleaching
- Terengganu island sewage (Utusan, July 2026): https://www.utusan.com.my/berita/2026/07/pulau-pelancongan-terengganu-tiada-sistem-kumbahan-bersepadu/
- Perhentian sewage allegation (Rakyat Post, May 2026): https://www.therakyatpost.com/news/malaysia/2026/05/31/watch-diver-claims-sewage-pumped-directly-into-sea-perhentian-resort-defends-itself/
- Cameron Highlands dam silt (The Star, July 2026): https://www.thestar.com.my/news/nation/2026/07/31/silt-in-cameron-dam-a-rising-threat
- Cameron Highlands land clearing (REACH): https://reach.org.my/forest-hill-slope-clearing-worries-cameron-folk/
- Carrying capacity critique (Massiani and Santoro 2012): https://iris.unive.it/retrieve/e4239ddb-357e-7180-e053-3705fe0a3322/Massiani%20Santoro%20%282012%29%20notion%20of%20capacity%20in%20tourism%20LXVI_N2_10.pdf
- Tourism Malaysia hotel guests by state, domestic: https://archive.data.gov.my/data/dataset/malaysia-hotel-guest-domestic-by-state
- Tourism Malaysia hotel guests by state, international: https://archive.data.gov.my/data/dataset/malaysia-hotel-guest-international-by-state
- OECD/JRC Handbook on Constructing Composite Indicators (2008): background reference, not re-opened for this document, check before quoting.

## Computation note

The weight comparison, bootstrap, leave-one-out and random-weight results above came from a computation on 2026-10-18 using the dashboard's current pressure indicator values for the 15 scored places (2,000 bootstrap resamples and 2,000 Dirichlet weight draws, fixed random seed). The script was run ad hoc and is not saved in the project. Ask for it to be added to `scripts/` if you want these numbers to be reproducible.
