# Weighting and combining capacity indicators in the AMBANG composite (thin data, heterogeneous indicators)

**VERIFICATION STATUS (read first):** WebSearch, WebFetch and Bash all failed in this session (server-side classifier error, retried). Nothing below was checked against a live source. Everything is from background knowledge. Citations are given by title/DOI from memory and must be verified before use in a report. No Malaysian published weights were found, so none are given. Anything labelled "own suggestion" is not a published weight.

## 1. What do composite-indicator guides recommend for weighting, and when is entropy inappropriate?

### Takeaway
No method is "correct". The guides treat weights as value judgements and as trade-offs, and recommend transparency plus sensitivity analysis. Equal weights are the common default when evidence is thin; expert or participatory weights are preferred when defensible. Statistical weights (PCA, entropy, CRITIC) describe data structure, not importance, and break down with small n or indicators that barely vary across units.

### Cited Findings (from memory, unverified)
- OECD/JRC Handbook (2008) covers equal weighting, statistical weighting (PCA/factor analysis, DEA/benefit-of-the-doubt, regression) and participatory weighting (budget allocation, AHP, conjoint analysis). Weights are essentially value judgements; any choice should be tested with uncertainty and sensitivity analysis. Equal weights implicitly over-weight dimensions that have more indicators. — OECD/JRC, *Handbook on Constructing Composite Indicators*, 2008, doi:10.1787/9789264043466-en
- Saisana, Saltelli & Tarantola (2005): standard source for Monte Carlo uncertainty and sensitivity analysis of composite indicators (varying weights, normalisation, aggregation together). — J. R. Stat. Soc. A 168(2):307-323, doi:10.1111/j.1467-985X.2005.00350.x
- Greco, Ishizaka, Tasiou & Torrisi (2019) review of weighting and aggregation: under linear aggregation weights act as trade-off rates, not "importance"; geometric aggregation is only partially compensatory; strict non-compensation needs multi-criteria approaches. — Soc. Indic. Res. 141:61-94, doi:10.1007/s11205-017-1832-9
- Entropy weighting gives more weight to more dispersed indicators; an indicator with identical values across units has zero information and gets weight about 0 (a property of the formula). Min-max scaling on tiny samples makes weights depend on extremes and be unstable.
- PCA/CRITIC/entropy drawbacks: correlated indicators are down-weighted, which can contradict policy importance; weights change when units are added or removed; statistical structure is not importance (OECD Handbook makes the general point).
- Environmental Performance Index (Yale/Columbia): expert-set weights within categories, with later editions adjusting partly for indicator quality/coverage; a hybrid example. — epi.yale.edu methodology. Unverified, check exact scheme.
- Ocean Health Index: ten goals combined by arithmetic mean with equal goal weights, authors stating there is no consensus on relative importance. — Halpern et al. 2012, Nature 488:615-620, doi:10.1038/nature11397. Unverified recollection.
- UN SDG Index (SDSN): equal weights across goals and indicators within goals, with sensitivity tests. Recollection only.
- UNWTO indicator guidebook (2004) is an indicator menu, not a weighted composite.

### Inferences
- Entropy is inappropriate for the AMBANG capacity side. State-level indicators repeat across islands in a state (effective n is a handful of states, with ties), so entropy weights would be near-zero or arbitrary for waste, water and resident base and would reward the one varying indicator (coral cover), which is backwards for a Liebig-style design.
- Entropy on the pressure side is also fragile at n=15: bootstrap the 15 units and inspect weight spread.
- Set capacity weights by judgement (equal, or expert/AHP/BWM), not by learning from the 15-point panel.

### Gaps
- No live access: no page-level quotes and no verified EPI/OHI/SDG weights.
- Coral Reef Health Index (Healthy Reefs Initiative): I recall equal-weighted averaging of four indicators (coral cover, fleshy macroalgae, herbivorous fish, commercial fish) on 1-5 scales; not verified.

## 2. Liebig's law, non-compensatory aggregation, and hybrids

### Takeaway
A weighted geometric mean is only partially compensatory: a near-zero indicator drags the score down but cannot hold it at zero unless exactly zero, and weights set the trade-off rate. Stricter options are the minimum operator, Cifuentes-style multiplicative correction factors, and non-compensatory MCDA. A geometric mean plus cap/penalty is a sensible hybrid, but I could not verify published precedent.

### Cited Findings (from memory, unverified)
- Cifuentes (1992) carrying capacity method: physical capacity reduced by a series of 0-1 correction factors (erosion, flooding, access, biological, social, etc.) to real capacity, then by management capacity to effective capacity; factors multiply, so it is non-compensatory in effect. — Cifuentes, M. (1992), *Determinación de capacidad de carga turística en áreas protegidas*, CATIE. Verify.
- Greco et al. 2019 (above): geometric aggregation is less compensatory than arithmetic; minimum/MCDA outranking is the non-compensatory end.
- Mazziotta & Pareto's Adjusted Mazziotta-Pareto Index penalises unbalanced indicator profiles (mean minus a variability penalty): closest published penalty hybrid I recall. Verify citation.
- UNDP HDI moved from arithmetic to geometric aggregation in 2010 to reduce perfect substitutability (HDR 2010 technical notes). Recollection.

### Inferences
- In a weighted geometric mean, a weight is the elasticity: a 10% fall in an indicator with weight w lowers C by about w x 10%. Equal weights mean every constraint bites proportionally; a low weight makes a constraint partly offsettable.
- For strict Liebig, make it explicit (own suggestion, not published): C_final = GM x min(1, m / t), where m is the minimum normalised indicator and t about 0.25.
- Floor normalised values at a small epsilon (e.g. 0.05) so a min-max zero does not collapse C to 0.

### Gaps
- No verified published example of "weighted geometric mean plus explicit binding-constraint cap" in tourism or ecological indices.

## 3. Malaysian studies and agencies

### Takeaway
No verified published weights found. I cannot honestly give numbers.

### Cited Findings
- None verified. I recall Malaysian AHP/Delphi studies on ecotourism and homestay sustainability criteria, MOTAC/Tourism Malaysia sustainability indicators, Langkawi UNESCO Global Geopark monitoring and Marine Park management-effectiveness evaluations, but cannot name papers or weights with confidence.

### Inferences
- State the absence as a finding: AMBANG's weights are the team's own and should be labelled assumptions.

### Gaps
- All of it. Suggested searches: "AHP ecotourism Malaysia criteria weights", "Delphi sustainable tourism indicators Malaysia", "Malaysia Marine Park management effectiveness", "Langkawi geopark sustainability indicators", MOTAC/NRES documents.

## 4. Practical guidance for 15 destinations and 4-6 capacity indicators; proposed schemes

### Takeaway
Use judgement-based weights (equal as baseline), not data-learned ones. Run Monte Carlo weight perturbation and leave-one-out, and show score bands and rank intervals. The schemes below are own suggestions, not published weights.

### Cited Findings (from memory, unverified)
- Sensitivity approach: Saisana et al. 2005 and OECD/JRC 2008 (above) vary weights, normalisation and aggregation and report rank intervals.

### Inferences (own suggestions)
**Method.** (1) Fix a baseline weight scheme by judgement. (2) Draw about 5,000 weight vectors from a Dirichlet centred on baseline (concentration roughly 20-50), or multiply each weight by U(0.5,1.5) and renormalise; recompute scores and ranks. (3) Leave-one-indicator-out for capacity and pressure indicators. (4) Report per destination: median score, 5th-95th percentile band, rank interval, share of draws where alert tier changes; flag destinations with tier flips in more than about 20% of draws as "uncertain". (5) The Cameron-only river indicator: exclude from the core score or use as a binding-constraint flag; a missing value should not default to high or zero.

**Scheme A, equal weights (baseline).** 1/5 each across the 5 current indicators (equals the current weights of 3). Justification: OHI/SDG precedent, no consensus on importance, geometric mean already limits compensation. Weakness: the single-destination river indicator and state-level values get influence out of proportion to their cross-island information.

**Scheme B, domain-balanced.** Ecological 0.30 (coral 0.30; or coral 0.20 + river 0.10 where available), water 0.25, waste 0.20, resident/social 0.15, sewage/energy 0.05, accommodation/jetty 0.05 (only where data exist; renormalise when absent). Justification: freshwater and waste are first physical limits on islands, and reef condition is the asset at risk. Weakness: numbers are judgement; validate with a small AHP/BWM elicitation (5-8 raters; BWM needs 2n-3 comparisons).

**Scheme C, hybrid binding-constraint.** Scheme A or B weights inside the geometric mean, then multiply by min(1, m/0.25). Encodes Liebig explicitly, in the spirit of Cifuentes factors. Weakness: threshold to defend; test 0.2-0.3.

**Shared state-level values.** Do not use entropy/CRITIC on them. Consider an exposure ratio (tourist or resident load per unit capacity) so island-level variation enters through the ratio. Say on the dashboard that several indicators are state-level.

**Presentation.** Show scores with bands, tier-stability percentage, the binding indicator per destination, and a small Scheme A/B/C comparison with the note "weights are assumptions".

### Gaps
- No published weights for water/waste/sewage/jetty types, so Scheme B values are unvalidated.
- Dirichlet concentration and cap threshold are rules of thumb, not sourced.
