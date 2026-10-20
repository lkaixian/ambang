(function () {
  "use strict";
  const root = document.getElementById("dqRoot");
  if (!root || typeof PANEL === "undefined") return;
  const reduce = () => matchMedia("(prefers-reduced-motion:reduce)").matches;
  const PEND = typeof PENDING !== "undefined" ? PENDING : (APPDATA.pendingData || {});
  const GE = APPDATA.geoData;

  // coverage rows (logic from classic buildCoverage); cell = [kind, text]
  const own = t => ["own", t || "Own"], sh = t => ["sh", t], no = ["no", "none"];
  const rows = []; let nVis = 0, nCoral = 0, nScored = 0, nProv = 0, real = 0, slots = 0;
  for (const n of Object.keys(PANEL)) {
    const d = PANEL[n], cb = k => d.cbar.find(i => i.n === k), pb = k => d.pbar.find(i => i.n === k);
    const reef = cb("Live coral cover");
    for (const b of d.pbar.concat(d.cbar)) { slots++; if (b.real) real++; }
    rows.push([n, pb("Marine park visitors")?.real ? sh("State") : no, reef?.real ? own() : no, cb("Water headroom")?.real ? sh("State") : no, cb("Waste handling")?.real ? sh("State") : no,
      pb("Cost-of-living pressure")?.real ? sh("District") : no, no, ["sh", "Scored*"]]);
    nScored++; if (reef?.real) nCoral++;
  }
  for (const [n, d] of Object.entries(PEND)) {
    const has = k => d.real.find(r => r.n.startsWith(k)), reef = has("Live coral cover");
    const vis = d.visitors ? own() : has("Marine park visitors") ? own("Own, 2017") : no;
    const water = has("Water headroom") && has("Households with piped") ? sh("State, district") : has("Water headroom") ? sh("State") : has("Households with piped") ? sh("District") : no;
    rows.push([n, vis, reef ? (/Shared/.test(reef.src) ? sh("Shared") : own()) : no, water, has("Managed waste") ? sh("State") : no,
      has("Resident population") || has("Median household") ? sh("District") : no, d.prov ? ["pv", "Found"] : no, d.prov ? ["pv", "Provisional"] : no]);
    if (d.visitors || has("Marine park visitors")) nVis++; if (reef) nCoral++; if (d.prov) nProv++;
  }
  const stOf = n => PANEL[n] ? GE.pins[n].state : PEND[n].state;
  const summary = `${rows.length} places: ${nScored} scored, ${nProv} provisional, ${rows.length - nScored - nProv} with no score. ${nCoral} have coral cover measured at or near the place, ${nVis} of the tracked places have a visitor series of their own, and ${nProv} have a daily limit. *Scored places are partly built from illustrative values; see Method.`;
  const heads = ["Destination", "Visitors", "Coral cover", "Water", "Waste", "Income, population", "Daily limit", "Score"];
  const body = rows.map((r, ri) => `<tr data-q="${esc((r[0] + " " + stOf(r[0])).toLowerCase())}"><th scope="row">${PANEL[r[0]] ? `<button type="button" class="dqNm" data-n="${esc(r[0])}">${esc(r[0])}</button>` : esc(r[0])}</th>${r.slice(1).map((c, ci) => `<td><span class="dqCell k-${c[0]}" style="--i:${Math.min(ri * 3 + ci, 40)}">${esc(c[1])}</span></td>`).join("")}</tr>`).join("");

  // destination lists (classic renderMethodDyn)
  const pq = Object.entries(PEND), uns = pq.filter(([n, d]) => !d.prov).map(([n]) => n), noted = ["Langkawi", "Pangkor", "Fraser's Hill", "Miri"], more = uns.filter(n => !noted.includes(n)).length;
  const provLi = pq.filter(([n, d]) => d.prov).map(([n, d]) => `<li><b>${esc(n)}: ${esc(d.prov.score)}</b> (range ${esc(d.prov.lo)} to ${esc(d.prov.hi)}), limit used: ${esc(d.prov.caps[0].label.replace(/^Central: /, ""))}</li>`).join("");
  const scoredLi = Object.entries(CLUSTERS).map(([st, c]) => `<li>${esc(st)}: ${Object.keys(c.islands).map(esc).join(", ")}</li>`).join("") + "<li>Highland: Cameron Highlands</li>";
  const moreLi = more ? `<li><b>${more} more places</b> added from the Atlas: tracked, no usable data yet. They are listed in the Coverage table.</li>` : "";

  const SRC_ROWS = `          <tr class="grp"><td colspan="7">Pressure (six indicators)</td></tr>
          <tr><td>Marine park visitors</td><td><span class="pill st-real">Real</span></td><td><span class="pill st-real">A, official</span></td><td>Department of Marine Park Malaysia, via archive.data.gov.my</td><td>State, 2000 to 2017 (2015 to 2017 average used)</td><td>Totals recomputed from the monthly file; the park list matched to the Atlas by name</td><td>Domestic plus foreign counts. 2018 to 2023 are not published on this portal. The per-island split is apportioned, not measured.</td></tr>
          <tr><td>Cost-of-living pressure</td><td><span class="pill st-real">Real</span></td><td><span class="pill st-real">A, official</span></td><td>DOSM household income survey (<code>hh_income_district</code>)</td><td>District, 2019 to 2024</td><td>All 297 catalogue entries listed and screened; datasets opened and districts matched by name</td><td>Per-island values are apportioned from the district figure. Cannot tell you visitors or anything below district level.</td></tr>
          <tr><td>Hotel guest arrivals</td><td><span class="pill st-ill">Illustrative</span></td><td>&ndash;</td><td>Tourism Malaysia hotel survey (state series exists)</td><td>State, yearly 2015 to 2022</td><td>&ndash;</td><td>A state-level series exists on archive.data.gov.my, but it does not describe islands, so every island keeps a placeholder. Pahang is dominated by Genting Highlands (about 11.0M guests in 2017 against 1.8M for Terengganu), which has nothing to do with Tioman or Cameron; Terengganu and Johor city hotels hide the busy islands. Shown as context only.</td></tr>
          <tr><td>Accommodation density</td><td><span class="pill st-ill">Partly real</span></td><td><span class="pill st-ill">C, crowd-sourced</span></td><td>OpenStreetMap, via Overpass</td><td>Box around the island, October 2026</td><td>Not independently verified</td><td>Count of tagged hotels, resorts and chalets, log-scaled to the busiest island. OpenStreetMap undercounts, so read it as a rough ranking. Islands without a successful fetch keep a placeholder. Rooms and beds are rarely tagged.</td></tr>
          <tr><td>Occupancy</td><td><span class="pill st-real">Real</span></td><td><span class="pill st-real">A, official</span></td><td>Tourism Malaysia paid accommodation survey, via archive.data.gov.my</td><td>State, 2015 to 2019 average</td><td>&ndash;</td><td>Hotels in the whole state, not the island. 2020 to 2022 are left out as COVID years.</td></tr>
          <tr><td>Seasonality</td><td><span class="pill st-ill">Partly real</span></td><td><span class="pill st-real">A, official</span></td><td>Department of Marine Park Malaysia monthly visitors, 2017</td><td>State, one year</td><td>Same monthly file as the visitors row</td><td>How concentrated real marine park visits were across the months (monsoon closures show up). Cameron Highlands keeps a placeholder. The search-interest curves on the Early warning page are a separate, descriptive view.</td></tr>
          <tr class="grp"><td colspan="7">Capacity (four indicators, plus river water quality for Cameron Highlands)</td></tr>
          <tr><td>Live coral cover</td><td><span class="pill st-real">Real</span></td><td><span class="pill st-real">B, survey</span></td><td>Reef Check Malaysia, interactive-map data file</td><td>Island or site, 2025 to 2026</td><td>Each location matched to the Atlas point by distance (all within 7 km); single-site values (Pulau Lima 88.8%, Pulau Pinang, Yu Besar, Yu Kecil) rest on one survey site and are flagged on their pages</td><td>The one real per-island measurement. 13 of 14 islands; Tulai has no matching site and stays a placeholder. Reef health beyond hard and soft coral cover is not measured.</td></tr>
          <tr><td>Waste handling</td><td><span class="pill st-real">Real</span></td><td><span class="pill st-real">A, official</span></td><td>SWCorp facility directory, via archive.data.gov.my</td><td>State, 2020</td><td>Counts matched to the state</td><td>Count of managed facilities, identical for every island in a state. The directory has no column for Sabah, Sarawak, Selangor, Penang or Kelantan. Says nothing about the capacity or sewage of any island.</td></tr>
          <tr><td>Water headroom</td><td><span class="pill st-real">Real</span></td><td><span class="pill st-real">A, official</span></td><td>SPAN, via data.gov.my</td><td>State, 2022</td><td>Datasets opened and districts matched by name</td><td>Production minus consumption. The dataset says no further updates are planned.</td></tr>
          <tr><td>Resident base</td><td><span class="pill st-real">Real</span></td><td><span class="pill st-real">A, official</span></td><td>DOSM <code>population_district</code></td><td>District or state, 2025</td><td>Datasets opened and districts matched by name</td><td>A weak capacity measure: see Method, Limits.</td></tr>
          <tr><td>River water quality (Cameron only)</td><td><span class="pill st-ill">Illustrative</span></td><td>&ndash;</td><td>Department of Environment</td><td>River basin</td><td>&ndash;</td><td>Placeholder; the real DOE index is not extracted yet.</td></tr>
          <tr class="grp"><td colspan="7">Used for charts, the calendar and provisional scores</td></tr>
          <tr><td>Park visitors in Sabah</td><td><span class="pill st-ext">Outside the score</span></td><td><span class="pill st-real">A, official</span></td><td>Sabah Parks public dashboard</td><td>Park, 2020 to 2025</td><td>Read directly from the dashboard's own data feed</td><td>Tunku Abdul Rahman Park, Sipadan and Kinabalu. Daily limits are not in it; COVID years are depressed.</td></tr>
          <tr><td>Mount Kinabalu climbers</td><td><span class="pill st-ext">Outside the score</span></td><td><span class="pill st-real">A, official</span></td><td>Sabah Parks</td><td>Month, 2023 to 2025 average</td><td>&ndash;</td><td>Provisional score and the calendar.</td></tr>
          <tr><td>Langkawi arrivals</td><td><span class="pill st-ext">Outside the score</span></td><td>&ndash;</td><td>Langkawi Development Authority statistics page</td><td>Island, 2021 to 2025</td><td>&ndash;</td><td>Counts every arrival, not park visitors; chart only.</td></tr>
          <tr><td>Interest curves</td><td><span class="pill st-ext">Outside the score</span></td><td>&ndash;</td><td>Wikipedia pageviews in English and Malay (Wikimedia API); Google Trends exports with Malay and English terms</td><td>Article or search term, 2016 to 2025</td><td>&ndash;</td><td>When people look a place up, not when they visit. Malay and English are summed because Malaysians search in Malay.</td></tr>
          <tr><td>Daily visitor limits</td><td><span class="pill st-ext">Outside the score</span></td><td><span class="pill st-ext">D, report</span> <span class="pill st-real">B, academic</span></td><td>News and an academic study (Maidin, 2022)</td><td>Sipadan, Kinabalu, Tunku Abdul Rahman Park</td><td>Cross-read between articles; disagreements shown as a range</td><td>Reported limits that disagree and have changed; shown as ranges. Maidin 2022 and Nasir 2022 are abstracts only (the full thesis was not read) and the time unit of the capacity figures is assumed to be per day. Nasir also supplies the reference weights for Perhentian and Tioman.</td></tr>
          <tr><td>Weather forecast log</td><td><span class="pill st-ext">Outside the score</span></td><td>&ndash;</td><td>MET Malaysia, via data.gov.my</td><td>Daily, from October 2026</td><td>&ndash;</td><td>Recorded by us because the open API keeps no history; correlation needs 26 weeks.</td></tr>
          <tr class="grp"><td colspan="7">Reference data (which parks exist and where)</td></tr>
          <tr><td>Park list and locations</td><td><span class="pill st-ext">Reference</span></td><td><span class="pill st-ill">C, registry</span></td><td>Coral Triangle Atlas, MPA list</td><td>Park; list refreshed May 2026, boundaries 2014</td><td>Counts reconciled to the 42 federal parks; points compared with the polygon file</td><td>Says nothing about management, zoning or effectiveness (unrated for 49 of 51) or visitors.</td></tr>`;
  const SRC_LINKS = `        <a href="https://reefcheck.org.my/reports" target="_blank" rel="noopener"><b>Reef Check Malaysia</b><span>Annual survey reports and coral cover</span></a>
        <a href="https://open.dosm.gov.my/data-catalogue" target="_blank" rel="noopener"><b>OpenDOSM</b><span>Population, household income, water</span></a>
        <a href="https://archive.data.gov.my" target="_blank" rel="noopener"><b>data.gov.my archive</b><span>Marine park visitors, SWCorp facilities, hotel occupancy</span></a>
        <a href="https://dashboard.sabahparks.org.my/" target="_blank" rel="noopener"><b>Sabah Parks dashboard</b><span>Park visitors and Kinabalu climbers</span></a>
        <a href="https://www.lada.gov.my/en/statistics" target="_blank" rel="noopener"><b>LADA statistics</b><span>Langkawi visitor arrivals</span></a>
        <a href="https://eprints.ums.edu.my/id/eprint/41212" target="_blank" rel="noopener"><b>Maidin, 2022 (UMS)</b><span>Carrying capacity, Tunku Abdul Rahman Park</span></a>
        <a href="https://irep.iium.edu.my/74120/" target="_blank" rel="noopener"><b>Nasir, 2022 (IIUM)</b><span>AHP weights, Perhentian and Tioman</span></a>
        <a href="https://api.data.gov.my/weather/forecast" target="_blank" rel="noopener"><b>MET Malaysia forecast API</b><span>Daily forecast, logged by us</span></a>
        <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener"><b>geoBoundaries</b><span>Map outlines (OpenStreetMap contributors, ODbL)</span></a>
        <a href="https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews" target="_blank" rel="noopener"><b>Wikimedia pageviews API</b><span>Monthly article views</span></a>`;
  const CORR = `      <li><b>Payar, Lembu and Kaca map pins</b> were about 1 degree of longitude too far west (99.0 instead of 100.04), in the sea beyond Langkawi. Moved to the Atlas coordinates, which agree with the 2014 polygon file.</li>
      <li><b>"Besar"</b> is Pulau Babi Besar, not another Pulau Besar: the Reef Check "Pulau Besar" location sits within 1 km of the Atlas point for Babi Besar.</li>
      <li><b>"42 marine parks"</b> is the federal count: 39 in Terengganu, Pahang, Kedah and Johor plus 3 in Labuan. The Atlas lists 51 protected areas, 46 of them designated Marine Park, so use 42 only for the federal Marine Park Department.</li>
      <li><b>Atlas page counts for Sabah and Sarawak</b> (5 and 3) differ from its own list (7 and 2). Neither is quoted.</li>
      <li><b>Kuala Terengganu district</b> was left out for Redang and its neighbours: the 1994 gazette names a district that has since been split, so its figures would describe the wrong place.</li>
      <li><b>"Only 100 visitors a day" (May 2020)</b> was a COVID rule for all Sabah parks, not a carrying capacity, so it is not used for any score.</li>
      <li><b>548,598 visitors to 56 islands</b> (Kosmo, June 2026) has no stated year and no per-island split. It is context only.</li>
      <li><b>State constituency data</b> (DOSM publishes it) was checked and rejected: the Pangkor and Tioman constituencies include mainland towns, so they would overstate the islands.</li>
      <li><b>Sembilang map pin</b> was about 22 km east of the gazetted Pulau Sembilang (104.10 instead of 103.89); moved to the Atlas point.</li>
      <li><b>OpenStreetMap accommodation zeros</b> are not trusted: Rawa has a resort that OSM does not tag, so a zero may only mean untagged. Islands with a zero keep their placeholder bar instead of scoring as having no accommodation.</li>
      <li><b>Google Trends seasonality</b> was tested as the Seasonality bar and rejected: search interest is flat across months (about 10 to 12 effective months everywhere) and misses the monsoon closures, so real monthly visits from the Marine Park Department are used instead.</li>`;
  const GAPS = `      <li><b>Department of Marine Park Malaysia:</b> per-island visitor counts for 2018 to 2025 and any daily limits. Would replace the state-level series and the 2017 cut-off.</li>
      <li><b>Sabah Parks:</b> the carrying-capacity study behind the 2019 visitor-limit panel. Would let Tun Sakaran and Pulau Tiga be scored (their visitor counts are already real).</li>
      <li><b>Sarawak Forestry Corporation:</b> visitor counts for Miri-Sibuti and Talang-Satang, none of which is public.</li>
      <li><b>Island sewage and waste:</b> published only as news and one resort survey (Perhentian), never as data. Needs a request to the state governments.</li>`;

  root.innerHTML = `
<div class="dqHead card"><div class="dqBig"><span class="dqNum" id="dqNum">0</span><span class="dqOf"> of ${slots}</span></div>
<div><p class="dqLead">indicator slots are real data</p><p class="dqSub">Counted across the pressure and capacity bars of the ${nScored} scored places (${real} real, ${slots - real} placeholder). What each number rests on and how far to trust it, which places are covered, what was corrected, and what is still missing. Nothing here is estimated to fill a gap.</p></div>
<div class="dqBar" aria-hidden="true"><i id="dqFill"></i></div></div>
<div class="dqTabs" role="tablist" aria-label="Data quality views" id="dqTabs">
<button type="button" role="tab" id="dqT1" aria-selected="true" aria-controls="dqP1" data-dq="dqP1">Coverage</button>
<button type="button" role="tab" id="dqT5" aria-selected="false" aria-controls="dqP5" data-dq="dqP5" tabindex="-1">Indicators and sources</button>
<button type="button" role="tab" id="dqT3" aria-selected="false" aria-controls="dqP3" data-dq="dqP3" tabindex="-1">Corrections</button>
<button type="button" role="tab" id="dqT4" aria-selected="false" aria-controls="dqP4" data-dq="dqP4" tabindex="-1">Gaps and places</button></div>
<div class="dqPanels">
<div id="dqP1" class="dqPanel" role="tabpanel" aria-labelledby="dqT1" tabindex="0"><div class="card dqCard">
<h3>Coverage by destination</h3>
<p class="dqLeg"><span class="dqCell k-own">Own</span> measured for this place. <span class="dqCell k-sh">Shared</span> a state or district figure, the same for every place in it, and larger than the place. <span class="dqCell k-pv">Provisional</span> a limit was found. <span class="dqCell k-no">none</span> nothing found.</p>
<input type="search" id="dqSearch" class="dqSearch" placeholder="Search the table by place or state" autocomplete="off" aria-label="Search coverage table">
<p class="dqNote">${esc(summary)}</p><p class="dqNote" id="dqCount" aria-live="polite"></p>
<div class="dqScroll dqTall" tabindex="0" role="region" aria-label="Coverage table, scrolls sideways on small screens"><table class="dqCov"><thead><tr>${heads.map(h => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody id="dqBody">${body}</tbody></table></div>
<p class="dqNote">Scored islands also use seasonality, occupancy and accommodation bars; their level, years and grade are on the Indicators and sources tab. Open an island on the Destination detail page to see which of its bars are real. Tracked places that are hidden on the maps (see the toggle on the overview) are listed here too.</p>
</div></div>
<div id="dqP5" class="dqPanel" role="tabpanel" aria-labelledby="dqT5" tabindex="0" hidden><div class="card dqCard">
<h3>What each indicator is built from, and how far to trust it</h3>
<p class="dqLeg"><span class="pill st-real">Real</span> fetched from a Malaysian open source. <span class="pill st-ill">Illustrative</span> a placeholder value, labelled on screen. <span class="pill st-ext">Outside the score</span> real data used for charts and provisional scores only. Grade: <b>A</b> official, <b>B</b> survey or academic, <b>C</b> registry or crowd-sourced, <b>D</b> news report.</p>
<div class="dqSL" id="dqSL" aria-label="Indicators and sources"></div></div>
<div class="card dqCard dqGap"><details><summary>Source links</summary><div class="dqLinks">${SRC_LINKS}</div></details></div></div>
<div id="dqP3" class="dqPanel" role="tabpanel" aria-labelledby="dqT3" tabindex="0" hidden><div class="card dqCard"><h3>Corrections and rejected data</h3><ul class="dqList">${CORR}</ul></div></div>
<div id="dqP4" class="dqPanel" role="tabpanel" aria-labelledby="dqT4" tabindex="0" hidden>
<div class="card dqCard"><h3>What would raise data quality most</h3><ul class="dqList">${GAPS}</ul></div>
<div class="card dqCard dqGap"><h3>Which places are covered</h3><div class="dqGrid">
<div class="dqMini"><b>Scored (${nScored})</b><p>The marine parks of Peninsular Malaysia that Reef Check actually surveys, in four clusters, plus Cameron Highlands as the highland comparison.</p><ul class="dqList">${scoredLi}</ul><p class="dqNote">Going island-level is limited by ecological data, not by choice: Johor's park has roughly 20 islands but only four have a coral-cover series.</p></div>
<div class="dqMini"><b>Provisional score (${nProv})</b><p>Real visitor numbers compared with a daily limit. Different method; not comparable with the scored islands.</p><ul class="dqList">${provLi}</ul></div>
<div class="dqMini"><b>Tracked, not scored (${uns.length})</b><p>On the map with the real data we have and what is missing, but no score.</p><ul class="dqList"><li><b>Langkawi:</b> real arrivals (LADA), no limit or capacity figure found</li><li><b>Pangkor:</b> no usable visitor series</li><li><b>Fraser's Hill:</b> no usable visitor series; first set aside for low volume, now tracked as a second highland</li><li><b>Miri:</b> Sarawak data sit behind a manual download</li>${moreLi}</ul></div>
<div class="dqMini"><b>Not tracked</b><ul class="dqList"><li><b>Selangor, Penang:</b> no marine park, no Reef Check reef, no SWCorp waste column</li><li><b>Genting Highlands:</b> casino and resort-led; set aside</li></ul></div>
</div></div></div></div>`;

  // indicators and sources: one row per indicator (name, source, status, grade); level, check and notes slide open
  const CH = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const tpl = document.createElement("table"); tpl.innerHTML = "<tbody>" + SRC_ROWS + "</tbody>";
  const pills = td => [...td.querySelectorAll(".pill")].map(p => ({ t: p.textContent.trim(), k: (p.className.match(/st-(\w+)/) || [])[1] || "ill" }));
  let sl = "", k = 0, openG = false;
  for (const tr of tpl.querySelectorAll("tr")) {
    const c = [...tr.children];
    if (tr.classList.contains("grp")) { if (openG) sl += "</div>"; sl += `<div class="dqG"><h4>${esc(c[0].textContent)}</h4>`; openG = true; continue; }
    const st = pills(c[1])[0] || { t: "", k: "ill" }, gr = pills(c[2]), id = "dqX" + (k++);
    const grade = gr.length ? gr.map(g => g.t.split(",")[0]).join(", ") : "";
    const gFull = gr.length ? gr.map(g => g.t).join("; ") : "Not graded";
    sl += `<div class="dqI"><button type="button" class="dqIH" aria-expanded="false" aria-controls="${id}"><span class="dqIn"><b>${c[0].innerHTML}</b><small>${c[3].innerHTML.replace(/<[^>]+>/g, "")}</small></span><span class="dqBd"><span class="dqSt s-${st.k}">${esc(st.t)}</span>${grade ? `<span class="dqGr" title="${esc(gFull)}">${esc(grade)}</span>` : ""}</span><span class="dqCh" aria-hidden="true">${CH}</span></button>
<div class="more" id="${id}"><div class="mi"><dl class="dd"><div><dt>Grade</dt><dd>${esc(gFull)}</dd></div><div><dt>Level and years</dt><dd>${c[4].innerHTML}</dd></div><div><dt>How it was checked</dt><dd>${c[5].innerHTML}</dd></div><div><dt>Notes</dt><dd>${c[6].innerHTML}</dd></div></dl></div></div></div>`;
  }
  root.querySelector("#dqSL").innerHTML = sl + (openG ? "</div>" : "");
  root.querySelector("#dqSL").addEventListener("click", e => {
    const h = e.target.closest(".dqIH"); if (!h) return;
    const row = h.closest(".dqI"), on = !row.classList.contains("open");
    row.classList.toggle("open", on); h.setAttribute("aria-expanded", String(on));
  });

  // count-up headline
  const num = root.querySelector("#dqNum"), fill = root.querySelector("#dqFill");
  let counted = false;
  function countUp() {
    if (counted) return; counted = true;
    fill.style.width = (real / slots * 100).toFixed(1) + "%";
    if (reduce()) { num.textContent = real; return; }
    const t0 = performance.now();
    (function step(t) { const f = Math.min(1, (t - t0) / 1100); num.textContent = Math.round(real * (1 - Math.pow(1 - f, 3))); if (f < 1) requestAnimationFrame(step); })(t0);
  }
  if (reduce()) countUp();
  else if ("IntersectionObserver" in window) { const io = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { io.disconnect(); countUp(); } }); io.observe(num); }
  else countUp();

  // tabs
  const tabs = [...root.querySelectorAll("#dqTabs button")];
  function show(id, focus) {
    tabs.forEach(b => { const on = b.dataset.dq === id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    root.querySelectorAll(".dqPanel").forEach(p => { p.hidden = p.id !== id; });
  }
  root.querySelector("#dqTabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) show(b.dataset.dq); });
  root.querySelector("#dqTabs").addEventListener("keydown", e => {
    const k = e.key, i = tabs.findIndex(b => b.getAttribute("aria-selected") === "true");
    const j = k === "ArrowRight" ? (i + 1) % tabs.length : k === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : k === "Home" ? 0 : k === "End" ? tabs.length - 1 : -1;
    if (j < 0) return; e.preventDefault(); show(tabs[j].dataset.dq, true);
  });

  // search + open destination
  root.querySelector("#dqSearch").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase(); let n = 0; const trs = root.querySelectorAll("#dqBody tr");
    trs.forEach(r => { const on = !q || r.dataset.q.includes(q); r.hidden = !on; if (on) n++; });
    root.querySelector("#dqCount").textContent = q ? `Showing ${n} of ${trs.length} places.` : "";
  });
  root.querySelector("#dqBody").addEventListener("click", e => { const b = e.target.closest(".dqNm"); if (b && window.AMBANG_NEW) AMBANG_NEW.open(b.dataset.n); });
})();
