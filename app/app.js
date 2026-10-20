const GRID={get color(){return TH("--grid")}}, TICK={get color(){return TH("--ink-2")},font:{family:"IBM Plex Sans",size:11}};
const applyChartTheme=()=>{ Chart.defaults.color=TH("--ink-2"); Chart.defaults.borderColor=TH("--grid"); }; applyChartTheme();
Chart.defaults.font.family="IBM Plex Sans";
Object.assign(Chart.defaults.animation,{duration:900,easing:"easeOutQuart"}); // every chart eases in and between values. Change the existing defaults in place: replacing the object (Chart.defaults.animation={...}) breaks Chart.js hover/tooltip animations (tooltips never appeared, hovering the seasonality chart blanked it)
const base=(extra={})=>({responsive:true,maintainAspectRatio:false,
  plugins:{legend:{labels:{boxWidth:10,boxHeight:10,font:{size:12},color:TH("--ink")}}},
  scales:{x:{grid:{display:false},ticks:TICK},y:{grid:GRID,ticks:TICK,border:{display:false}}},...extra});

// Rotating a phone: make every chart re-measure its box (some browsers skip the container resize event).
addEventListener("orientationchange",()=>setTimeout(()=>Object.values(Chart.instances).forEach(c=>c.resize()),250));
addEventListener("resize",()=>Object.values(Chart.instances).forEach(c=>c.resize()));
// National overview (map, KPIs, list, trend) is built after the map data loads: see "National overview" below.

let c3,c4,c3Dest,c4Dest;
const sel=document.getElementById("dsel");
Object.keys(PANEL).forEach(k=>{const o=document.createElement("option");o.value=k;o.textContent=k;sel.appendChild(o)});

// What years each indicator's value covers, shown only in the expanded row.
const INDICATOR_YEARS={
  "Marine park visitors":"2015 to 2017 average (the series runs 2000 to 2017)",
  "Cost-of-living pressure":"2019 to 2024, latest 2024 (HIES)",
  "Waste handling":"2020 (SWCorp directory, current through 2020)",
  "Water headroom":"2022 (SPAN, no further updates planned)",
  "Resident base":"2025",
  "Live coral cover":"Latest Reef Check survey, 2025/26",
  "River water quality":"No year: placeholder",
  "Occupancy":"2015 to 2019 average (2020 to 2022 left out as COVID years)",
  "Seasonality":"2017, monthly visits",
  "Accommodation density":"OpenStreetMap snapshot, October 2026"
};
function growBars(){ // bars drawn while their page was hidden slide to their value the moment it is shown
  document.querySelectorAll(".bt i[data-w]").forEach(i=>{ if(i.offsetParent&&i.style.width!==i.dataset.w)i.style.width=i.dataset.w; });
}
function bars(el,items,color,showWeight=false){
  const prevW={}, wasOpen=new Set(); // widths and open rows from the last draw, so bars slide to new values and an open row stays open
  el.querySelectorAll(".bar").forEach(b=>{ const n=b.dataset.n; prevW[n]=b.querySelector(".bt i").style.width; if(b.classList.contains("expanded"))wasOpen.add(n); });
  el.innerHTML="";
  items.forEach(it=>{
    const d=document.createElement("div"); d.className="bar";
    const wtag=(showWeight&&it.w)?`<span class="wtag">${Math.round(it.w*100)}%</span>`:"";
    const yrs=it.src?((it.real&&INDICATOR_YEARS[it.n])||"Not dated: illustrative placeholder values"):null;
    const status=it.src?(it.real?`<span class="prov ok">✓ Confirmed real dataset, fetched into data/</span>`:`<span class="prov">Illustrative placeholder, apportioned from state or national figures</span>`):null;
    const rows=[["Value",`${it.v.toFixed(2)} (0 to 1)${it.w?(showWeight?`, weight ${Math.round(it.w*100)}%`:", equal weight"):""}`]];
    if(it.src)rows.push(["Source",esc(it.src)]);
    if(it.scope)rows.push(["Level",it.scope.t]);
    if(yrs)rows.push(["Years",yrs]);
    if(status)rows.push(["Status",status]);
    const detail=`<div class="dl">${rows.map(([k,v])=>`<b>${k}</b><span>${v}</span>`).join("")}</div>`;
    d.dataset.n=it.n;
    d.innerHTML=`<button type="button" class="barH" aria-expanded="false"><span>${esc(it.n)}<span class="chev" aria-hidden="true"></span></span></button><span class="bt"><i style="width:${Math.round(it.v*100)}%;background:${color}"></i></span><span class="num" style="text-align:right">${wtag}${it.v.toFixed(2)}</span><div class="bar-detail">${detail}</div>`;
    if(wasOpen.has(it.n)){ d.classList.add("expanded"); d.querySelector(".barH").setAttribute("aria-expanded","true"); }
    el.appendChild(d);
    const fill=d.querySelector(".bt i"), target=fill.style.width;
    fill.dataset.w=target; fill.style.width=prevW[it.n]||"0%";
    if(el.offsetParent){ void fill.offsetWidth; fill.style.width=target; } // visible: CSS transition does the slide; hidden page: growBars() runs when it is shown
  });
  if(!el.dataset.expandBound){
    const toggle=row=>{ if(row._busy)return; const on=!row.classList.contains("expanded"); row.querySelector(".barH").setAttribute("aria-expanded",String(on)); row._busy=true; setTimeout(()=>row._busy=false,260);
      slide([row.querySelector(".bar-detail")],on,()=>row.classList.toggle("expanded",on)); };
    el.addEventListener("click",e=>{
      if(e.target.closest(".bar-detail"))return; // reading the box should not close it
      const row=e.target.closest(".bar"); if(row)toggle(row);
    });
    el.dataset.expandBound="1";
  }
}
// Data-integrity anomaly flag -- deliberately a plain statistical check, not
// an LLM call: cheap, deterministic, and doesn't depend on the AI settings
// being configured. Flags a destination whose latest score move is both
// (a) well above its own historical month-to-month volatility and (b) above
// a small absolute floor, so a naturally flat series doesn't trip on noise.
// This does not claim to know WHY a jump happened (real spike vs a bad feed
// vs a re-apportionment artifact) -- it only flags "this one step looks
// unusual, go check the source" before it's read as a genuine signal.
function integrityCheck(scoreArr){
  if(!scoreArr||scoreArr.length<3)return null;
  const deltas=[];
  for(let i=1;i<scoreArr.length;i++)deltas.push(Math.abs(scoreArr[i]-scoreArr[i-1]));
  const last=deltas[deltas.length-1];
  const prior=deltas.slice(0,-1);
  if(!prior.length)return null;
  const sorted=prior.slice().sort((a,b)=>a-b);
  const median=sorted[Math.floor(sorted.length/2)]||0.01;
  const FLOOR=6; // points -- ignore small jumps even if large relative to a very flat history
  if(last>FLOOR&&last>median*2.5)return{last:last.toFixed(1),median:median.toFixed(1)};
  return null;
}
function render(k){
  const d=PANEL[k];
  document.getElementById("detailTitle").textContent=`${k}, ${GEO.pins[k].state}`;
  updatePicked(k);
  updateMap();
  const st=GEO.pins[k].state, cam=k==="Cameron Highlands";
  const scopeC=it=>it.n==="Live coral cover"?{t:"This island only (surveyed on site)",own:1}
    :it.n==="River water quality"?{t:"River basin level"}
    :{t:cam&&it.n==="Resident base"?"District level":`${st} state level, same for every destination in ${st}`};
  d.cbar.forEach(it=>it.scope=scopeC(it));
  bars(document.getElementById("pbars"),d.pbar,CLR.red,true);
  bars(document.getElementById("cbars"),d.cbar,CLR.green);
  const schemeLbl=document.getElementById("wscheme").value==="ewm"?"EWM (trained)":"Equal weight";
  document.getElementById("trajWhat").textContent=
    `This is the AMBANG composite score, 100 × P / (P + C): pressure against capacity in one number, under the ${schemeLbl} weights. 50 is the threshold. Only the latest point is computed from the indicators shown here; earlier years rescale the state-level series to it, so read the shape, not the exact historical values.`;
  document.getElementById("p2note").textContent=d.note;
  document.getElementById("reeftitle").textContent=d.reef.title;
  document.getElementById("reefnote").textContent=d.reef.note;
  const P=wgm(d.pbar);
  document.getElementById("pweighted").textContent=
    `Weighted current-period P: ${P.toFixed(2)}. This drives the score chart (right): the whole historical trend is rescaled to this weighted snapshot, same as capacity.`;
  const worst=d.cbar.reduce((min,it)=>it.v<min.v?it:min,d.cbar[0]);
  const C=wgm(d.cbar);
  document.getElementById("cweighted").textContent=
    `Weighted current-period C: ${C.toFixed(2)}. Binding constraint: ${worst.n} (${worst.v.toFixed(2)}), the lowest-scoring capacity indicator, named per the bottleneck principle regardless of the weighted average.`;
  if(c3&&c3Dest!==k){ c3.destroy(); c3=null; }
  if(!c3){ c3Dest=k; c3=new Chart(document.getElementById("c3"),{type:"bar",
    data:{labels:d.reef.lab,datasets:[{label:d.reef.metric,data:d.reef.v,backgroundColor:d.reef.lab.map(l=>l===k?TH("--ink"):TH("--bar")),maxBarThickness:34}]},
    options:base({plugins:{legend:{display:false},tooltip:{callbacks:{footer:it=>it[0].label!==k&&GEO.pins[it[0].label]?"Click to open this island":""}}},
      onHover:(e,els)=>{ e.native.target.style.cursor=els.length&&GEO.pins[c3.data.labels[els[0].index]]&&c3.data.labels[els[0].index]!==k?"pointer":""; },
      onClick:(e,els)=>{ if(!els.length)return; const n=c3.data.labels[els[0].index]; if(n!==k&&GEO.pins[n])setTimeout(()=>{ selectDest(n); detailEl.scrollIntoView({behavior:"smooth",block:"start"}); }); }, // click another island's bar to open its detail (deferred: selectDest rebuilds this chart, which must not happen mid-event)
      scales:{x:{grid:{display:false},ticks:TICK},y:{min:0,max:80,grid:GRID,ticks:TICK,border:{display:false}}}})}); }
  if(c4&&c4Dest===k){ // same destination (e.g. weights switched): morph the line instead of redrawing it
    const ax=scoreAxis(d.score); c4.data.datasets[0].data=d.score; c4.options.scales.y.min=ax.min; c4.options.scales.y.max=ax.max; c4.update();
  }else{ if(c4)c4.destroy(); c4Dest=k;
  c4=new Chart(document.getElementById("c4"),{type:"line",
    data:{labels:YR,datasets:[
      {label:"AMBANG composite score",data:d.score,borderColor:TH("--ink"),backgroundColor:TH("--ink"),cubicInterpolationMode:"monotone",pointRadius:3,borderWidth:2},
      {label:"Threshold (50)",data:YR.map(()=>50),borderColor:TH("--ink-3"),borderDash:[5,4],pointRadius:0,borderWidth:1.5}]},
    options:base({plugins:{legend:{labels:{boxWidth:10,boxHeight:10,font:{size:12},color:TH("--ink")}}},scales:{x:{grid:{display:false},ticks:TICK},
      y:{...scoreAxis(d.score),title:{display:true,text:"AMBANG composite score (0–100)",color:TH("--ink-2"),font:{size:11}},grid:GRID,border:{display:false}}}})}); }
  const flagEl=document.getElementById("integrityFlag");
  const flag=integrityCheck(d.score);
  if(flag){
    flagEl.hidden=false;
    flagEl.textContent=`⚠ Data-integrity flag: the latest reading moved ${flag.last} pts in one step, vs a typical month-to-month move of ${flag.median} pts for ${k}. Could be a genuine spike, a feed error, or a re-apportionment artifact; worth checking the source before acting on it.`;
  }else{
    flagEl.hidden=true;
  }
}
// Latest-year score under a named scheme, without touching PANEL state --
// lets the picker show EWM vs Equal side by side. Equals d.score's last
// entry for the active scheme (buildSeries pins the last point to wgm()).

// ---- Destination chooser: map pins (positions from #geoData JSON) or list ----
const GEO=APPDATA.geoData;
const PENDING=APPDATA.pendingData;
// Tracked parks with no score of any kind are hidden unless the viewer opts in (the Atlas added many, which crowds the maps).
let SHOW_UNSCORED=false; try{ SHOW_UNSCORED=localStorage.getItem("ambangShowUnscored")==="1"; }catch(e){}
const isHid=n=>!!PENDING[n]&&!PENDING[n].prov&&!SHOW_UNSCORED;
for(const [n,d] of Object.entries(PENDING)){
  GEO.pins[n]={state:d.state,lat:d.lat,lon:d.lon,pending:true};
  const o=document.createElement("option"); o.value=n; o.textContent=`${n} (no score yet)`; if(!d.prov)o.dataset.uns="1"; sel.appendChild(o);
}
const SVGNS="http://www.w3.org/2000/svg";
function svgEl(tag,attrs){ const e=document.createElementNS(SVGNS,tag); for(const k in attrs)e.setAttribute(k,attrs[k]); return e; }
const proj=(lon,lat)=>[(lon-GEO.view.lon0)*GEO.view.scale,(GEO.view.lat1-lat)*GEO.view.scale];
const PIN={}; // name -> [x,y] in viewBox units
for(const [n,g] of Object.entries(GEO.pins))PIN[n]=proj(g.lon,g.lat);
// The maps are SVGs scaled to their box, so on a narrow window a 7px pin shrinks to 2px. k = SVG units per screen pixel;
// u = how much to enlarge pins and labels (about 0.9 of full compensation, capped) so they stay readable and tappable.
function mapUnits(svg){ const w=svg.getBoundingClientRect().width||1040, vb=svg.viewBox.baseVal, k=(vb&&vb.width||1040)/w; return {k,u:Math.min(3.2,Math.max(.1,k*.9))}; }
const isUns=n=>!!PENDING[n]&&!PENDING[n].prov;
function spreadPins(){ // push apart scored pins closer than MIN so neighbouring islands stay clickable; unscored pins stay on their true spot (zoom in to separate them)
  for(const n in PIN)PIN[n]=proj(GEO.pins[n].lon,GEO.pins[n].lat);
  const ks=Object.keys(PIN).filter(n=>!isHid(n)&&!isUns(n)),MIN=Math.max(16*mapUnits(document.getElementById("geoMap")).u,24*mapUnits(document.getElementById("geoMap")).k); // never closer than 24 screen pixels
  for(let it=0;it<60;it++)for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){
    const a=PIN[ks[i]],b=PIN[ks[j]];
    let dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);
    if(d>=MIN)continue;
    if(d<.01){dx=1;dy=0;d=1;}
    const m=(MIN-d)/2/d;
    a[0]-=dx*m;a[1]-=dy*m;b[0]+=dx*m;b[1]+=dy*m;
  }
}
spreadPins();
const geoMap=document.getElementById("geoMap"), pinEls={}, pinScore={};
let peekPin=null; // touch screens have no hover: the first tap on a pin previews it, a second tap (or the button) opens it
const coarse=()=>matchMedia("(pointer:coarse)").matches;
let mapLab;
function setPeek(n){ // preview bar under the map (touch): name, state, score and an Open button
  peekPin=n; const bar=document.getElementById("peekBar"); bar.hidden=!n;
  if(n){ bar.innerHTML=`<span>${pinEls[n].getAttribute("aria-label")}</span><button type="button" class="btn">Open detail</button>`; bar.querySelector("button").onclick=()=>{ setPeek(null); selectDest(n); }; }
  showLab(n||sel.value);
}
function showLab(n){
  if(!n){ mapLab.textContent=""; return; }
  const {u}=mapUnits(geoMap), vb=geoMap.viewBox.baseVal, [x,y]=PIN[n], right=x>vb.x+vb.width-200*u;
  mapLab.textContent=PENDING[n]?(PENDING[n].prov?`${n} · ${PENDING[n].prov.score} (provisional)`:`${n} · no score yet`):`${n} · ${pinScore[n]}`;
  mapLab.setAttribute("x",right?x-14*u:x+14*u);
  mapLab.setAttribute("y",y+4*u);
  mapLab.setAttribute("text-anchor",right?"end":"start");
}
function buildMap(){
  const tracked=new Set(Object.values(GEO.pins).map(p=>p.state));
  for(const [st,d] of Object.entries(GEO.land))geoMap.appendChild(svgEl("path",{class:"land"+(tracked.has(st)?" tracked":""),d}));
  for(const n of Object.keys(PIN)){
    const [x,y]=PIN[n];
    const g=svgEl("g",{class:"pin-g",tabindex:"0",role:"button"});
    g.append(svgEl("circle",{cx:x,cy:y,r:16,fill:"transparent"}),svgEl("circle",{class:"ring",cx:x,cy:y,r:10}),svgEl("circle",{class:"dot",cx:x,cy:y,r:6}));
    if(PENDING[n]){
      const pv=PENDING[n].prov;
      g.querySelector(".dot").setAttribute("fill",pv?CLR[pv.band]:TH("--ink-3"));
      g.classList.toggle("prov",!!pv);
      if(!pv){ g.classList.add("uns"); g.querySelector(".dot").setAttribute("r",4.5); g.querySelector(".ring").setAttribute("r",8); }
      g.setAttribute("aria-label",pv?`${n}, ${PENDING[n].state}, provisional score ${pv.score}, not comparable with scored islands`:`${n}, ${PENDING[n].state}, tracked, no score yet`);
    }
    g.addEventListener("click",()=>{ if(coarse()&&peekPin!==n){ setPeek(n); return; } setPeek(null); selectDest(n); });
    g.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); setPeek(null); selectDest(n); } });
    g.addEventListener("mouseenter",()=>showLab(n));
    g.addEventListener("focus",()=>showLab(n));
    g.addEventListener("mouseleave",()=>showLab(sel.value));
    g.addEventListener("blur",()=>showLab(sel.value));
    geoMap.appendChild(g);
    pinEls[n]=g;
  }
  mapLab=svgEl("text",{class:"pin-lab"});
  geoMap.appendChild(mapLab);
}
function renderDList(){
  const q=document.getElementById("dsrch").value.trim().toLowerCase(), out=[]; let hiddenMatch=0;
  const match=(n,st)=>!q||`${n} ${st}`.toLowerCase().includes(q);
  for(const d of computeDest().sort((a,b)=>b.s-a.s)){ const st=GEO.pins[d.n].state; if(match(d.n,st))out.push({n:d.n,st,tag:`<span class="s num">${d.s}</span> <span class="pill ${PILL[d.band]}">${LBL[d.band]}</span>`}); }
  for(const [n,d] of Object.entries(PENDING)){
    if(!match(n,d.state))continue;
    if(isHid(n)){ hiddenMatch++; continue; }
    out.push({n,st:d.state,tag:d.prov?`<span class="s num">${d.prov.score}</span> <span class="pill prov">Provisional</span>`:`<span class="pill" style="background:var(--paper);color:var(--ink-2)">No score yet</span>`});
  }
  document.getElementById("dlist").innerHTML=out.map(r=>`<button type="button" data-dest="${esc(r.n)}"><span>${esc(r.n)}<small>${esc(r.st)}</small></span><span>${r.tag}</span></button>`).join("")
    +(hiddenMatch?`<div class="more">${hiddenMatch} more match${hiddenMatch>1?"es":""} but ${hiddenMatch>1?"have":"has"} no score and ${hiddenMatch>1?"are":"is"} hidden. <button type="button" id="dShowUns" style="all:unset;cursor:pointer;text-decoration:underline">Show them</button></div>`:"")
    +(!out.length&&!hiddenMatch?`<div class="more">Nothing matches "${q.replace(/</g,"&lt;")}".</div>`:"");
}
const dOpen=on=>{ document.getElementById("dlist").hidden=!on; };
document.getElementById("dsrch").addEventListener("input",()=>{ renderDList(); dOpen(true); });
document.getElementById("dsrch").addEventListener("focus",()=>{ renderDList(); dOpen(true); });
document.addEventListener("click",e=>{ if(!e.target.closest(".dbox"))dOpen(false); });
document.getElementById("dsrch").addEventListener("keydown",e=>{ if(e.key==="Escape")dOpen(false); if(e.key==="Enter"){ const b=document.querySelector("#dlist button[data-dest]"); if(b){ e.preventDefault(); selectDest(b.dataset.dest); } } });
document.getElementById("dlist").addEventListener("click",e=>{
  if(e.target.id==="dShowUns"){ setShowUnscored(true); return; }
  const b=e.target.closest("button[data-dest]"); if(b)selectDest(b.dataset.dest);
});
function placeMapPins(){
  spreadPins();
  if(!placeMapPins.ordered){ placeMapPins.ordered=1; const top=Object.keys(pinEls).filter(n=>!isUns(n)).map(n=>pinEls[n])[0]; if(top)for(const n in pinEls)if(isUns(n))geoMap.insertBefore(pinEls[n],top); } // scored pins drawn on top
  const {k,u}=mapUnits(geoMap), pf=innerWidth<=620?.85:1; // slightly smaller dots on phones
  for(const n in pinEls){ const g=pinEls[n], uns=g.classList.contains("uns"); g.style.display=isHid(n)?"none":"";
    g.querySelectorAll("circle").forEach(c=>{ c.setAttribute("cx",PIN[n][0]); c.setAttribute("cy",PIN[n][1]); });
    const [hit,ring,dot]=g.querySelectorAll("circle");
    let near=1e9; for(const m in pinEls){ if(m===n||isHid(m))continue; near=Math.min(near,Math.hypot(PIN[m][0]-PIN[n][0],PIN[m][1]-PIN[n][1])); }
    hit.setAttribute("r",k*Math.min(22,Math.max(uns?4:11,near/k/2))); // tap area: up to 22px radius, never overlapping the nearest neighbour; unscored pins get a small one so they never cover a scored pin
    ring.setAttribute("r",(uns?8:10)*u*pf); dot.setAttribute("r",(uns?4.5:6)*u*pf); // dots keep one screen size at any zoom
    ring.style.strokeWidth=dot.style.strokeWidth=2*u; }
  mapLab.style.fontSize=13*u+"px"; mapLab.style.strokeWidth=4*u+"px";
  showLab(peekPin||sel.value);
}
function setShowUnscored(on){
  SHOW_UNSCORED=!!on; try{ localStorage.setItem("ambangShowUnscored",on?"1":"0"); }catch(e){}
  const nU=Object.values(PENDING).filter(d=>!d.prov).length;
  document.querySelectorAll(".unsChk").forEach(c=>c.checked=SHOW_UNSCORED);
  document.querySelectorAll(".unsN").forEach(c=>c.textContent=nU);
  for(const o of sel.options)if(o.dataset.uns){ o.hidden=o.disabled=!SHOW_UNSCORED; }
  placeMapPins(); renderOverview(); renderDList(); if(ovState)ovPlacePins();
}
document.querySelectorAll(".unsChk").forEach(c=>c.addEventListener("change",e=>setShowUnscored(e.target.checked)));
// Recolours pins + aria-labels from the live PANEL, so a weight-scheme change shows up on the map too.
function updateMap(){
  for(const d of computeDest()){
    pinScore[d.n]=d.s;
    const g=pinEls[d.n];
    g.querySelector(".dot").setAttribute("fill",CLR[d.band]);
    g.setAttribute("aria-label",`${d.n}, ${GEO.pins[d.n].state}, score ${d.s}, ${LBL[d.band]}`);
    g.classList.toggle("sel",d.n===sel.value);
  }
  showLab(sel.value);
}
function updatePicked(k){
  const d=PANEL[k], s=d.score[d.score.length-1], b=bandFor(s);
  const e=latestScore(d,"ewm"), q=latestScore(d,"equal");
  const cur=document.getElementById("wscheme").value==="ewm"?"EWM (trained)":"Equal weight";
  const same=e===q?" Same under both schemes: this destination's six pressure indicators sit close together, so reweighting can't move it.":"";
  document.getElementById("picked").innerHTML=
    `<div class="stat"><div><div class="l">AMBANG composite score (0–100)</div><span class="big num">${s}</span> <span class="pill ${PILL[b]}">${LBL[b]}</span></div>`
    +`<div><div class="l">Pressure P (weighted, 0–1)</div><span class="mid num">${wgm(d.pbar).toFixed(2)}</span></div>`
    +`<div><div class="l">Capacity C (weighted, 0–1)</div><span class="mid num">${wgm(d.cbar).toFixed(2)}</span></div></div>`
    +`<p class="note" style="margin:10px 0 0">Score = 100 × P / (P + C), latest year, under ${cur}. EWM ${e} · Equal weight ${q}.${same} Switch the scheme with the Weights toggle at the top of the page.</p>`;
}
const chooser=document.getElementById("chooser"), detailEl=document.getElementById("detail");
let mode="map";
function selectDest(n){
  requestAnimationFrame(()=>requestAnimationFrame(growBars)); // bars slide in once the detail view is visible
  if(isHid(n))setShowUnscored(true);
  sel.value=n;
  chooser.hidden=true; detailEl.hidden=false;
  document.getElementById("backLabel").textContent=mode==="map"?"Back to map":"Back to list";
  document.getElementById("scoredView").hidden=!!PENDING[n];
  document.getElementById("pendingView").hidden=!PENDING[n];
  if(PENDING[n])renderPending(n); else render(n);
  window.scrollTo({top:0});
  document.getElementById("backBtn").focus({preventScroll:true});
  if(typeof chatRefreshChips==="function")chatRefreshChips();
  if(typeof aiBriefRefresh==="function")aiBriefRefresh();
}
let c6,c7;
function renderPending(n){
  const d=PENDING[n];
  document.getElementById("pvTitle").textContent=`${n}, ${d.state} (${d.kind.toLowerCase()})`;
  const pv=d.prov;
  document.getElementById("pvBanner").textContent=pv
    ?"Provisional score only. It compares real visitor numbers with an official daily limit, which is a different and simpler measure than the six-indicator AMBANG score, so do not compare it with the scored islands."
    :d.visitors?"No AMBANG score. We have a real visitor series (below) but found no official daily limit to compare it against, and the other indicators are missing. Filling the gaps with made-up values would give a number that looks comparable to the scored islands but isn't."
    :"No AMBANG score yet. Only the indicators below have real data; the rest are missing, and filling them with made-up values would produce a score that looks comparable to the other destinations but isn't.";
  const provEl=document.getElementById("pvProv");
  provEl.hidden=!pv;
  if(pv){
    const rg=r=>{ const a=r.score_low!=null?r.score_low:r.score, b=r.score_alt; return a===b?`${a}`:`${Math.min(a,b)} to ${Math.max(a,b)}`; };
    provEl.innerHTML=`<h3>Provisional score <span class="pill prov">provisional</span></h3>
      <div class="stat"><div><div class="l">Utilisation score (0–100), latest</div><span class="big num">${pv.score}</span> <span class="pill ${PILL[pv.band]}">${LBL[pv.band]}</span></div>
      <div><div class="l">Range across plausible limits</div><span class="mid num">${pv.lo} to ${pv.hi}</span></div></div>
      <p class="note">${pv.basis} Score = 100 × U / (U + 1), where U is average daily visitors divided by the daily limit. This is AMBANG's own P / (P + C) with the limit as capacity, so exactly at the limit (U = 1) the score is 50, the threshold.</p>
      <div class="table-wrap"><table class="provTbl"><thead><tr><th>Period</th><th>Per day</th><th>Score at central limit</th><th>Range</th></tr></thead><tbody>${pv.rows.map(r=>`<tr><td>${r.label}</td><td class="num">${r.per_day}</td><td class="num">${r.score}</td><td class="num">${rg(r)}</td></tr>`).join("")}</tbody></table></div>
      <p class="note" style="margin-bottom:0"><strong>Daily limits found (they disagree and have changed):</strong></p>
      <ul class="capList">${pv.caps.map(c=>`<li>${c.label}. <a href="${c.url}" target="_blank" rel="noopener">${c.src}</a></li>`).join("")}</ul>
      <p class="note" style="margin-bottom:0"><strong>Caveats:</strong> ${pv.caveats.join(" ")}</p>`;
  }
  const visCard=document.getElementById("pvVisCard"), vs=d.visitors;
  if(c7){ c7.destroy(); c7=null; }
  visCard.hidden=!vs;
  if(vs){
    document.getElementById("pvVisTitle").textContent=vs.title;
    c7=new Chart(document.getElementById("c7"),{type:"bar",
      data:{labels:vs.years,datasets:[{label:"Visitors",data:vs.values,backgroundColor:TH("--bar"),maxBarThickness:34}]},
      options:base({plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:TICK},y:{min:0,grid:GRID,ticks:{...TICK,callback:v=>v>=1e6?(v/1e6)+"M":v>=1e3?(v/1e3)+"k":v},border:{display:false}}}})});
    document.getElementById("pvVisNote").textContent=`Source: ${vs.source}. ${vs.note}`;
  }
  document.getElementById("pvReal").innerHTML=d.real.map(r=>`<tr><td>${esc(r.n)}<span class="src" style="display:block;font-size:11px;color:var(--ink-3)">${esc(r.src)}</span><span class="scope${r.scope.startsWith("This")?" own":""}">${esc(r.scope)}</span></td><td class="num">${esc(r.v)}</td><td class="num">${esc(r.yr)}</td></tr>`).join("");
  document.getElementById("pvGaps").innerHTML=d.gaps.map(g=>`<li style="margin-bottom:6px">${esc(g)}</li>`).join("");
  const rep=d.reported||[];
  document.getElementById("pvRepCard").hidden=!rep.length;
  document.getElementById("pvRep").innerHTML=rep.map(r=>`<li style="margin-bottom:6px">${esc(r.t)} <a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">${esc(r.src)}</a></li>`).join("");
  const card=document.getElementById("pvSeasonCard"), s=d.season;
  if(c6){ c6.destroy(); c6=null; }
  card.hidden=!s;
  if(s){
    const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    c6=new Chart(document.getElementById("c6"),{type:"bar",
      data:{labels:M,datasets:[{label:"Share of a year's search interest",data:s.month_share.map(v=>+(v*100).toFixed(1)),backgroundColor:s.reliable?TH("--bar"):TH("--line-2"),maxBarThickness:22}]},
      options:base({plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:TICK},y:{min:0,grid:GRID,ticks:{...TICK,callback:v=>v+"%"},border:{display:false}}}})});
    document.getElementById("pvSeasonNote").textContent=
      `${s.source||"Google Trends searches in Malaysia"}, "${s.term}". Peak month ${s.peak_month} (${(s.peak_share*100).toFixed(1)}% of the year; a perfectly even year is 8.3%). This is when people look the place up, not when they visit, so it shows the shape of the season only.`
      +(s.effective_months>=11?" Interest is spread almost evenly across the year, so it says little about a visiting season.":"")
      +(s.reliable?"":s.median_monthly_views!=null?` Only about ${s.median_monthly_views} views a month: too little to read a season from, so this is greyed out and should not be used.`:` Too little search volume (${Math.round(s.zero_weeks*100)}% of weeks are empty) to read a season from, so this is greyed out and should not be used.`);
  }
}
function backToChooser(){
  detailEl.hidden=true; chooser.hidden=false;
  (mode==="map"&&pinEls[sel.value]?pinEls[sel.value]:sel).focus({preventScroll:true});
}
document.getElementById("backBtn").addEventListener("click",backToChooser);
function setMode(m){
  mode=m;
  document.getElementById("mapMode").hidden=(m!=="map");
  document.getElementById("listMode").hidden=(m!=="list");
  document.getElementById("modeMap").setAttribute("aria-pressed",String(m==="map"));
  document.getElementById("modeList").setAttribute("aria-pressed",String(m==="list"));
  if(m==="map")mapFit();
}
document.getElementById("modeMap").addEventListener("click",()=>setMode("map"));
document.getElementById("modeList").addEventListener("click",()=>setMode("list"));
// Pins are small for a thumb, so phones start in the list.
setMode(matchMedia("(max-width:620px)").matches?"list":"map");
buildMap();
updateMap();

// Y axis for score line charts: fitted to the data (plus the 50 threshold), padded, in steps of 10, kept inside 0-100.
function scoreAxis(values){
  const lo=Math.min(...values,50), hi=Math.max(...values,50);
  return {min:Math.max(0,Math.floor((lo-6)/10)*10), max:Math.min(100,Math.ceil((hi+6)/10)*10), ticks:{...TICK,stepSize:10}};
}
// ---- National overview: regions coloured by average score; click a region to zoom to its islands ----
const OV={W:1040,H:420,PAD:44};
const stops=()=>[[30,TH("--teal")],[52,TH("--amber")],[68,TH("--coral")],[82,TH("--crit")]]; // same hues as the bands, blended continuously
function scoreColor(s){
  const STOPS=stops();
  s=Math.max(STOPS[0][0],Math.min(STOPS[STOPS.length-1][0],s));
  let i=0; while(i<STOPS.length-2&&s>STOPS[i+1][0])i++;
  const [s0,ca]=STOPS[i],[s1,cb]=STOPS[i+1], t=(s-s0)/(s1-s0);
  const rgb=x=>[1,3,5].map(j=>parseInt(x.slice(j,j+2),16)), A=rgb(ca), B=rgb(cb);
  return `rgb(${A.map((v,j)=>Math.round((v+(B[j]-v)*t)*.75+(document.documentElement.dataset.theme==="dark"?20:255)*.25)).join(",")})`; // tinted toward the page colour so big areas stay calm
}
const paintLegend=()=>{ document.getElementById("ovLegendBar").style.background="linear-gradient(90deg,"+[30,40,52,60,68,75,82].map(s=>`${scoreColor(s)} ${((s-30)/52*100).toFixed(1)}%`).join(",")+")"; }; paintLegend();

const STATE_BOX={}; // [x0,y0,x1,y1] of each state's land in map units
for(const [st,d] of Object.entries(GEO.land)){
  const pts=d.match(/-?\d+\.?\d*,-?\d+\.?\d*/g).map(q=>q.split(",").map(Number));
  STATE_BOX[st]=[Math.min(...pts.map(q=>q[0])),Math.min(...pts.map(q=>q[1])),Math.max(...pts.map(q=>q[0])),Math.max(...pts.map(q=>q[1]))];
}
const TRUE_PIN=Object.fromEntries(Object.entries(GEO.pins).map(([n,g])=>[n,proj(g.lon,g.lat)])); // unspread positions
function viewFor(st){
  let [x0,y0,x1,y1]=st?STATE_BOX[st]:[0,0,GEO.view.w,GEO.view.h], pad=st?OV.PAD:0;
  if(st)for(const n in GEO.pins)if(GEO.pins[n].state===st){const [x,y]=TRUE_PIN[n];x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  const bw=(x1-x0)||1, bh=(y1-y0)||1, k=Math.min((OV.W-2*pad)/bw,(OV.H-2*pad)/bh,9);
  return {k,tx:(OV.W-k*bw)/2-k*x0,ty:(OV.H-k*bh)/2-k*y0};
}
function stateStats(){
  const out={};
  for(const d of computeDest()){ const st=GEO.pins[d.n].state; (out[st]??={dests:[],pending:[]}).dests.push(d); }
  for(const [n,p] of Object.entries(PENDING))if(!isHid(n))(out[p.state]??={dests:[],pending:[]}).pending.push(n);
  for(const o of Object.values(out))if(o.dests.length){
    const arrs=o.dests.map(d=>PANEL[d.n].score);
    o.series=YR.map((_,i)=>Math.round(arrs.reduce((s,a)=>s+a[i],0)/arrs.length*10)/10);
    o.avg=Math.round(o.series[o.series.length-1]); o.band=bandFor(o.avg);
  }
  return out;
}

const ovMap=document.getElementById("ovMap"), ovLand=svgEl("g",{}), ovPinsG=svgEl("g",{}), stateEls={}, ovPinEls={};
ovMap.append(ovLand,ovPinsG);
let ovState=null, ovView=viewFor(null), ovAnim=0, ovChart=null, ovChartState=null;
const ovSize=()=>{ const H=innerWidth<=620?520:420; if(OV.H===H)return; OV.H=H; ovMap.setAttribute("viewBox",`0 0 ${OV.W} ${H}`); ovView=viewFor(ovState); ovApply(ovView); }; // phones get a taller frame so a region fills it
const ovApply=v=>ovLand.setAttribute("transform",`translate(${v.tx.toFixed(2)},${v.ty.toFixed(2)}) scale(${v.k.toFixed(4)})`);
ovSize();
ovApply(ovView);

for(const [st,d] of Object.entries(GEO.land)){
  const el=svgEl("path",{class:"ovState",d}); ovLand.appendChild(el); stateEls[st]=el;
  el.addEventListener("click",()=>{ if(el.classList.contains("tracked")&&st!==ovState)ovGo(st); });
  el.addEventListener("keydown",e=>{ if((e.key==="Enter"||e.key===" ")&&el.classList.contains("tracked")){ e.preventDefault(); if(st!==ovState)ovGo(st); } });
}
for(const n of Object.keys(GEO.pins)){
  const g=svgEl("g",{class:"ovPin",tabindex:"0",role:"button"});
  g.append(svgEl("circle",{r:18,fill:"transparent"}),svgEl("circle",{class:"ring",r:11}),svgEl("circle",{class:"dot",r:7}),svgEl("text",{class:"pin-lab",y:4}));
  const open=()=>{ selectDest(n); showPage("p2"); };
  g.addEventListener("click",()=>{ if(coarse()&&g.classList.contains("uns")&&!g.classList.contains("peek")){ ovPinsG.querySelectorAll(".peek").forEach(o=>o.classList.remove("peek")); g.classList.add("peek"); return; } open(); }); // touch: first tap on a no-score dot shows its name
  g.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); open(); } });
  if(PENDING[n]&&!PENDING[n].prov){ g.classList.add("uns"); g.querySelector(".dot").setAttribute("r",5); g.querySelector(".ring").setAttribute("r",8); }
  g.style.display="none"; if(g.classList.contains("uns"))ovPinsG.prepend(g); else ovPinsG.appendChild(g); ovPinEls[n]=g; // unscored dots underneath
}
function ovPlacePins(){
  const {k,u}=mapUnits(document.getElementById("ovMap"));
  const v=ovView, show=Object.keys(GEO.pins).filter(n=>ovState&&GEO.pins[n].state===ovState&&!isHid(n));
  for(const n in ovPinEls)ovPinEls[n].style.display=show.includes(n)?"":"none";
  const pts=show.map(n=>{const [x,y]=TRUE_PIN[n];return [x*v.k+v.tx,y*v.k+v.ty];});
  const mv=show.map((n,i)=>i).filter(i=>!isUns(show[i])); // scored pins are nudged apart; unscored pins stay on their true spot
  for(let it=0;it<60;it++)for(let a=0;a<mv.length;a++)for(let b=a+1;b<mv.length;b++){ // keep neighbouring islands clickable
    const i=mv[a],j=mv[b]; let dx=pts[j][0]-pts[i][0],dy=pts[j][1]-pts[i][1],d=Math.hypot(dx,dy);
    if(d>=26*u)continue; if(d<.01){dx=1;dy=0;d=1;}
    const m=(26*u-d)/2/d; pts[i][0]-=dx*m;pts[i][1]-=dy*m;pts[j][0]+=dx*m;pts[j][1]+=dy*m;
  }
  // labels are wide, so also stack pins vertically when they sit in roughly the same column band
  const order=mv.slice().sort((a,b)=>pts[a][1]-pts[b][1]);
  order.forEach((i,r)=>{ for(let q=0;q<r;q++){ const j=order[q]; if(Math.abs(pts[i][0]-pts[j][0])<180*u&&pts[i][1]<pts[j][1]+20*u)pts[i][1]=pts[j][1]+20*u; } });
  show.forEach((n,i)=>{
    const g=ovPinEls[n], [x,y]=pts[i], right=x>OV.W-230*u, lab=g.querySelector("text");
    const pu=u*(innerWidth<=620?.8:1); g.setAttribute("transform",`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${pu.toFixed(2)})`); lab.style.fontSize=(13*u/pu).toFixed(2)+"px"; lab.style.strokeWidth=(4*u/pu).toFixed(2)+"px"; // phones: smaller dot, same label size
    g.querySelector("circle").setAttribute("r",Math.max(18,22*k/u)); // invisible hit area: at least 22px radius on screen
    lab.setAttribute("x",right?-15:15); lab.setAttribute("text-anchor",right?"end":"start");
  });
}
function ovGo(st){
  ovState=st; cancelAnimationFrame(ovAnim);
  for(const n in ovPinEls)ovPinEls[n].style.display="none";
  const to=viewFor(st), from=ovView;
  const done=()=>{ ovView=to; ovApply(to); ovPlacePins(); };
  if(matchMedia("(prefers-reduced-motion:reduce)").matches)done();
  else{
    const t0=performance.now();
    const step=now=>{ const t=Math.min(1,(now-t0)/380), e=t*t*(3-2*t);
      ovView={k:from.k+(to.k-from.k)*e,tx:from.tx+(to.tx-from.tx)*e,ty:from.ty+(to.ty-from.ty)*e}; ovApply(ovView);
      if(t<1)ovAnim=requestAnimationFrame(step); else done(); };
    ovAnim=requestAnimationFrame(step);
  }
  renderOverview();
}
document.getElementById("ovBack").addEventListener("click",()=>ovGo(null));
(function(){ // zoom (+ / - buttons, pinch, Ctrl+wheel) and pan (drag) the overview map inside its fixed frame
  const wrap=document.createElement("div"); wrap.className="mapWrap"; ovMap.before(wrap); wrap.append(ovMap,
    Object.assign(document.createElement("div"),{className:"mapZoom",innerHTML:'<button type="button" data-f="1.6" aria-label="Zoom in">+</button><button type="button" data-f="0.625" aria-label="Zoom out">&minus;</button>'}));
  const pts=new Map(); let anchor=null, moved=0, raf=0;
  const mid=()=>{ const a=[...pts.values()]; return [a.reduce((t,p)=>t+p[0],0)/a.length, a.reduce((t,p)=>t+p[1],0)/a.length]; };
  const spread=()=>{ const a=[...pts.values()]; return a.length>1?Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]):0; };
  const svgPt=(cx,cy)=>{ const r=ovMap.getBoundingClientRect(); return [(cx-r.left)/r.width*OV.W,(cy-r.top)/r.height*OV.H]; };
  function grab(cx,cy){ const [sx,sy]=svgPt(cx,cy), v=ovView; anchor={mx:(sx-v.tx)/v.k,my:(sy-v.ty)/v.k,k:v.k,d:spread()}; }
  function show(k,cx,cy){ // keep the grabbed map point under (cx,cy) at zoom k; the whole country never leaves the frame
    const k0=viewFor(null).k; k=Math.min(k0*30,Math.max(k0,k)); const [sx,sy]=svgPt(cx,cy), cw=GEO.view.w*k, ch=GEO.view.h*k;
    const tx=Math.min(Math.max(0,OV.W-cw),Math.max(Math.min(0,OV.W-cw),sx-anchor.mx*k)), ty=Math.min(Math.max(0,OV.H-ch),Math.max(Math.min(0,OV.H-ch),sy-anchor.my*k));
    ovView=k<=k0*1.001?viewFor(null):{k,tx,ty}; ovApply(ovView); ovPlacePins(); // fully zoomed out = the default centred view
  }
  const regrab=()=>{ if(pts.size)grab(...mid()); else anchor=null; };
  function apply(){ raf=0; if(!anchor||!pts.size)return; const [cx,cy]=mid(); show(anchor.d?anchor.k*spread()/anchor.d:anchor.k,cx,cy); }
  ovMap.addEventListener("pointerdown",e=>{ if(e.pointerType==="mouse"&&e.button)return; cancelAnimationFrame(ovAnim); pts.set(e.pointerId,[e.clientX,e.clientY]); moved=0; regrab(); });
  addEventListener("pointermove",e=>{ const p=pts.get(e.pointerId); if(!p)return; moved+=Math.abs(e.clientX-p[0])+Math.abs(e.clientY-p[1]); p[0]=e.clientX; p[1]=e.clientY; if(moved>10&&!raf)raf=requestAnimationFrame(apply); });
  const up=e=>{ if(pts.delete(e.pointerId))regrab(); };
  addEventListener("pointerup",up); addEventListener("pointercancel",up);
  ovMap.addEventListener("click",e=>{ if(moved>10){ e.stopPropagation(); e.preventDefault(); moved=0; } },true); // a drag is not a tap on a region or pin
  function zoomBy(f,cx,cy){ cancelAnimationFrame(ovAnim); anchor=null; grab(cx,cy); anchor.d=0; show(ovView.k*f,cx,cy); }
  wrap.querySelector(".mapZoom").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b)return; const r=ovMap.getBoundingClientRect(); zoomBy(+b.dataset.f,r.left+r.width/2,r.top+r.height/2); });
  ovMap.addEventListener("wheel",e=>{ if(!e.ctrlKey&&!e.metaKey)return; e.preventDefault(); zoomBy(Math.exp(-e.deltaY*.01),e.clientX,e.clientY); },{passive:false});
})();

// Re-renders everything PANEL-derived on Page 1: KPIs, region colours, pins, list, trend. Runs at load and on weight-scheme change.
function renderOverview(){
  const DEST=computeDest(), SS=stateStats(), nPend=Object.keys(PENDING).filter(n=>!isHid(n)).length;
  countUp(document.getElementById("kpiCount"),DEST.length);
  document.getElementById("kpiCountL").textContent=nPend?`Destinations scored (+${nPend} tracked, not scored yet)`:"Destinations scored";
  countUp(document.getElementById("kpiAbove"),DEST.filter(d=>d.s>50).length);
  countUp(document.getElementById("kpiWatch"),DEST.filter(d=>d.band!=="green").length);
  const rank=b=>["green","amber","red","crit"].indexOf(b), i18=YR.indexOf(2018);
  countUp(document.getElementById("kpiRose"),DEST.filter(d=>rank(d.band)>rank(bandFor(PANEL[d.n].score[i18]))).length);
  for(const [st,el] of Object.entries(stateEls)){
    const s=SS[st], scored=s&&s.dests.length;
    el.classList.toggle("tracked",!!s);
    el.classList.toggle("dim",!!ovState&&st!==ovState);
    el.style.fill=scored?scoreColor(s.avg):s?TH("--land-no"):TH("--land");
    if(s){ el.setAttribute("tabindex","0"); el.setAttribute("role","button");
      el.setAttribute("aria-label",scored?`${st}, average score ${s.avg}, ${LBL[s.band]}, ${s.dests.length} destinations. Activate to zoom in.`:`${st}, ${s.pending.length} tracked destinations, no score yet. Activate to zoom in.`); }
    else{ el.removeAttribute("tabindex"); el.removeAttribute("role"); el.removeAttribute("aria-label"); }
  }
  for(const d of DEST){ const g=ovPinEls[d.n]; g.querySelector(".dot").setAttribute("fill",CLR[d.band]); g.querySelector("text").textContent=`${d.n} · ${d.s}`; g.setAttribute("aria-label",`${d.n}, score ${d.s}, ${LBL[d.band]}. Open detail.`); }
  for(const n in PENDING){ const g=ovPinEls[n], pv=PENDING[n].prov;
    g.querySelector(".dot").setAttribute("fill",pv?CLR[pv.band]:TH("--ink-3")); g.classList.toggle("prov",!!pv);
    g.querySelector("text").textContent=pv?`${n} · ${pv.score} (provisional)`:`${n} · no score yet`;
    g.setAttribute("aria-label",pv?`${n}, provisional score ${pv.score}, not comparable with scored islands. Open detail.`:`${n}, tracked, no score yet. Open detail.`); }
  document.getElementById("ovBack").hidden=!ovState;
  document.getElementById("ovTitle").textContent=ovState||"All regions";

  const list=document.getElementById("ovList"), row=(attr,name,sub,s,band,prov)=>
    `<button class="ovRow" type="button" ${attr}><span>${name}<small>${sub}</small></span><span class="tag">${s==null?`<span class="pill" style="background:var(--paper);color:var(--ink-2)">No score yet</span>`:prov?`<span class="s num">${s}</span><span class="pill prov">Provisional</span>`:`<span class="s num">${s}</span><span class="pill ${PILL[band]}">${LBL[band]}</span>`}</span></button>`;
  const trendCard=document.getElementById("ovTrendCard");
  if(ovChart&&(!ovState||ovChartState!==ovState)){ ovChart.destroy(); ovChart=null; }
  if(!ovState){
    document.getElementById("ovListTitle").textContent="Regions by average score";
    const rows=Object.entries(SS).sort((a,b)=>(b[1].avg??-1)-(a[1].avg??-1));
    list.innerHTML=rows.map(([st,s])=>row(`data-state="${st}"`,st,(s.dests.length?`${s.dests.length} destinations scored`:`${s.pending.length} tracked, not scored yet`)+(s.dests.length&&s.pending.length?`, +${s.pending.length} tracked, not scored`:"")+(s.pending.some(n=>PENDING[n].prov)?` (${s.pending.filter(n=>PENDING[n].prov).length} provisional)`:""),s.avg,s.band)).join("");
    trendCard.hidden=true;
  }else{
    const s=SS[ovState];
    document.getElementById("ovListTitle").textContent=`${ovState}: destinations`;
    const rows=s.dests.slice().sort((a,b)=>b.s-a.s).map(d=>row(`data-dest="${d.n}"`,d.n,"Open detail",d.s,d.band))
      .concat(s.pending.map(n=>{ const pv=PENDING[n].prov; return row(`data-dest="${n}"`,n,pv?"Provisional score, open detail":"Open detail",pv?pv.score:null,pv?pv.band:null,!!pv); }));
    list.innerHTML=(s.dests.length?`<p class="ovSum"><span class="num" style="font-size:30px;font-weight:500;margin-right:10px">${s.avg}</span><span class="pill ${PILL[s.band]}">${LBL[s.band]}</span><span class="note" style="display:block;margin:4px 0 0">Average of ${s.dests.length} destination score${s.dests.length>1?"s":""}, latest year.</span></p>`:"")+rows.join("");
    trendCard.hidden=!s.dests.length;
    if(s.dests.length){
      document.getElementById("ovTrendTitle").textContent=`${ovState}: average score over time`;
      document.getElementById("ovTrendNote").textContent="One line: the mean AMBANG composite score of this region's destinations. The dashed line is the threshold (50). Earlier years rescale state-level series to the latest reading, so read the direction, not exact past values.";
      if(ovChart){ const ax=scoreAxis(s.series); ovChart.data.datasets[0].data=s.series; ovChart.options.scales.y.min=ax.min; ovChart.options.scales.y.max=ax.max; ovChart.update(); }
      else{ ovChartState=ovState;
      ovChart=new Chart(document.getElementById("c1"),{type:"line",
        data:{labels:YR,datasets:[
          {label:"Average score",data:s.series,borderColor:TH("--ink"),backgroundColor:TH("--ink"),cubicInterpolationMode:"monotone",pointRadius:3,borderWidth:2},
          {label:"Threshold (50)",data:YR.map(()=>50),borderColor:TH("--ink-3"),borderDash:[5,4],pointRadius:0,borderWidth:1.5}]},
        options:base({plugins:{legend:{labels:{boxWidth:10,boxHeight:10,font:{size:12},color:TH("--ink")}}},
          scales:{x:{grid:{display:false},ticks:TICK},y:{...scoreAxis(s.series),title:{display:true,text:"AMBANG composite score (0–100)",color:TH("--ink-2"),font:{size:11}},grid:GRID,border:{display:false}}}})}); }
    }
  }
}
document.getElementById("ovList").addEventListener("click",e=>{
  const b=e.target.closest(".ovRow"); if(!b)return;
  if(b.dataset.state)ovGo(b.dataset.state);
  else if(b.dataset.dest){ selectDest(b.dataset.dest); showPage("p2"); }
});
renderOverview();
setShowUnscored(SHOW_UNSCORED);

sel.addEventListener("change",e=>selectDest(e.target.value));
document.getElementById("wseg").addEventListener("click",e=>{
  const b=e.target.closest("button[data-w]"), w=document.getElementById("wscheme"); if(!b||w.value===b.dataset.w)return;
  w.value=b.dataset.w; w.dispatchEvent(new Event("change"));
});
function repaintAll(){ renderOverview(); updateMap(); if(PANEL[sel.value])render(sel.value); renderEarlyWarning(); }
document.getElementById("wscheme").addEventListener("change",e=>{
  document.querySelectorAll("#wseg button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.w===e.target.value)));
  const snap=numSnap();
  applyWeightScheme(e.target.value);
  repaintAll();
  if(typeof aiBriefRefresh==="function")aiBriefRefresh();
  numTween(snap);
});

// Info toggles: descriptions (.sub, p.note) are hidden until Info is clicked; page-level button shows/hides the whole page, card-level just that card.
(function(){
  const mk=(t,on)=>{ const b=document.createElement("button"); b.type="button"; b.className="infoBtn"; b.setAttribute("aria-expanded","false");
    b.addEventListener("click",()=>{ if(t._busy)return; t._busy=true; setTimeout(()=>t._busy=false,260);
      const o=!t.classList.contains("info-on"), notes=[...t.querySelectorAll(".sub, p.note")].filter(el=>!el.matches("#chooseHint,#calChartNote,.aiHint,[aria-live]"));
      b.setAttribute("aria-expanded",String(o)); b.textContent=o?"Info ▴":"Info ▾";
      if(t.classList.contains("page"))t.querySelectorAll(".card>.infoBtn").forEach(x=>{ x.setAttribute("aria-expanded",String(o)); x.textContent=o?"Info ▴":"Info ▾"; });
      slide(notes,o,()=>t.classList.toggle("info-on",o)); });
    b.textContent="Info ▾"; return b; };
  document.querySelectorAll("section.page").forEach(pg=>{
    const h=pg.querySelector("h2"); if(h&&pg.querySelector(".sub"))h.appendChild(mk(pg));
    pg.querySelectorAll(".card").forEach(c=>{ if(c.querySelector("p.note"))c.insertBefore(mk(c),c.firstChild); });
  });
})();
function countUp(el,to){
  const from=parseFloat(el.textContent); // from the number already shown (e.g. when weights change), else from 0
  tweenText(el,isNaN(from)?0:from,to,0,700);
}
// Animates an element's number from -> to (rAF, ease-out). Respects reduced motion.
function tweenText(el,from,to,dp,dur,sign,suffix=""){
  const fmt=v=>(sign&&v>0?"+":"")+v.toFixed(dp)+suffix;
  if(el._tw)cancelAnimationFrame(el._tw);
  if(matchMedia("(prefers-reduced-motion: reduce)").matches||from===to){ el.textContent=fmt(to); return; }
  const t0=performance.now();
  (function step(t){ const f=Math.min(1,(t-t0)/dur); el.textContent=fmt(from+(to-from)*(1-Math.pow(1-f,3))); if(f<1)el._tw=requestAnimationFrame(step); else el._tw=0; })(t0);
}
// Weight switch: remember every visible plain number, re-render, then count each one from its old value to its new one.
// Elements are matched by destination/region name (so a re-sorted list still pairs up right), else by id + position.
const NUMSEL=".num,.wtag", NUMRE=/^-?\d+(\.\d+)?%?$/;
const numKey=el=>{
  const row=el.closest("[data-dest],[data-state]");
  if(row)return (row.dataset.dest||row.dataset.state)+"#"+[...row.querySelectorAll(NUMSEL)].indexOf(el);
  const a=el.closest("[id]"); return a?a.id+"#"+[...a.querySelectorAll(NUMSEL)].indexOf(el):null;
};
const plainNum=el=>el.offsetParent&&!el.closest("#wiResult")&&NUMRE.test(el.textContent.trim());
const numSnap=()=>{ const m=new Map(); document.querySelectorAll(NUMSEL).forEach(el=>{ if(!plainNum(el))return; const k=numKey(el); if(k)m.set(k,el.textContent.trim()); }); return m; };
function numTween(snap){ document.querySelectorAll(NUMSEL).forEach(el=>{
  if(!plainNum(el))return;
  const k=numKey(el), old=snap.get(k), to=el.textContent.trim(); if(old===undefined||old===to)return;
  tweenText(el,parseFloat(old),parseFloat(to),(to.replace("%","").split(".")[1]||"").length,800,false,to.endsWith("%")?"%":"");
  el.classList.remove("numChg"); void el.offsetWidth; el.classList.add("numChg"); setTimeout(()=>el.classList.remove("numChg"),1100);
}); }
function geoZoom(z){ // narrow screens: crop the map to one landmass so it is drawn bigger (the SVG gets taller to match)
  const land=[...geoMap.querySelectorAll(".land")], div=proj(105,0)[0], box={};
  land.forEach(l=>{ const b=l.getBBox(), g=b.x+b.width/2<div?"pen":"bor", o=box[g]; box[g]=o?[Math.min(o[0],b.x),Math.min(o[1],b.y),Math.max(o[2],b.x+b.width),Math.max(o[3],b.y+b.height)]:[b.x,b.y,b.x+b.width,b.y+b.height]; });
  const r=z==="all"||!box[z]?[0,0,GEO.view.w,GEO.view.h]:box[z].map((v,i)=>v+(i<2?-16:16)); // 16 units of margin so edge pins and labels fit
  geoMap.setAttribute("viewBox",`${r[0]} ${r[1]} ${r[2]-r[0]} ${r[3]-r[1]}`);
  document.querySelectorAll(".geoZoom .triF").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.z===z)));
  geoMap.base=r; geoMap.dataset.z=z; placeMapPins();
}
function slide(els,open,apply){ // ease elements open/shut; apply() flips the class that shows them (run first when opening, last when closing)
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){ apply(); return; }
  if(open)apply();
  const as=els.filter(el=>el.offsetParent).map(el=>{
    const cs=getComputedStyle(el), full={height:el.getBoundingClientRect().height+"px",opacity:1,marginTop:cs.marginTop,marginBottom:cs.marginBottom,paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom};
    const zero={height:"0px",opacity:0,marginTop:"0px",marginBottom:"0px",paddingTop:"0px",paddingBottom:"0px"};
    el.style.overflow="hidden"; const a=el.animate(open?[zero,full]:[full,zero],{duration:240,easing:"ease"}); a.onfinish=()=>{ el.style.overflow=""; }; return a.finished; });
  if(open)return;
  if(!as.length){ apply(); return; }
  // keep the elements visible until the close animation ends, then hide for real
  Promise.all(as).then(apply,apply); setTimeout(apply,400); // the timer is a safety net if the animation never reports back (hidden tab)
}
document.addEventListener("click",e=>{ // design-choice <details>: ease the height open and shut (instant if the viewer prefers reduced motion)
  const sm=e.target.closest("details.dtl>summary"); if(!sm)return;
  const d=sm.parentElement; e.preventDefault();
  const h0=d.getBoundingClientRect().height; d._a?.cancel();
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){ d.open=!d.open; return; }
  const opening=!d.open; let h1;
  if(opening){ d.open=true; h1=d.getBoundingClientRect().height; }
  else { d.open=false; h1=d.getBoundingClientRect().height; d.open=true; }
  d.style.overflow="hidden";
  d._a=d.animate({height:[h0+"px",h1+"px"]},{duration:260,easing:"ease"});
  d._a.onfinish=()=>{ d.style.overflow=""; d._a=null; d.open=opening; };
});
(function(){ // zoom and pan the pin map: pinch, drag, Ctrl+wheel, or the + / - buttons (aspect ratio stays that of the base view; the area buttons reset it)
  const wrap=document.createElement("div"); wrap.className="mapWrap geo"; geoMap.before(wrap); wrap.append(geoMap,
    Object.assign(document.createElement("div"),{className:"mapZoom",innerHTML:'<button type="button" data-f="2" aria-label="Zoom in">+</button><button type="button" data-f="0.5" aria-label="Zoom out">&minus;</button>'}));
  const pts=new Map(); let anchor=null, moved=0, raf=0;
  const base=()=>{ const [x,y,r,b]=geoMap.base||[0,0,GEO.view.w,GEO.view.h]; return {x,y,w:r-x||GEO.view.w,h:b-y||GEO.view.h}; };
  const mid=()=>{ const a=[...pts.values()]; return [a.reduce((t,p)=>t+p[0],0)/a.length, a.reduce((t,p)=>t+p[1],0)/a.length]; };
  const spread=()=>{ const a=[...pts.values()]; return a.length>1?Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]):0; };
  function grab(px,py){ // remember which map point sits under (px,py) and the zoom at that moment
    const vb=geoMap.viewBox.baseVal, r=geoMap.getBoundingClientRect();
    anchor={cx:vb.x+(px-r.left)/r.width*vb.width, cy:vb.y+(py-r.top)/r.height*vb.height, w:vb.width, d:spread()};
  }
  function show(w,px,py){
    if(!geoMap.getBoundingClientRect().width)return; // map not on screen // put the anchored map point back under (px,py) at view width w
    const B=base(), r=geoMap.getBoundingClientRect(); w=Math.min(B.w,Math.max(B.w/24,w)); const h=w*B.h/B.w;
    const x=Math.min(B.x+B.w-w,Math.max(B.x,anchor.cx-(px-r.left)/r.width*w)), y=Math.min(B.y+B.h-h,Math.max(B.y,anchor.cy-(py-r.top)/r.height*h));
    geoMap.setAttribute("viewBox",`${x} ${y} ${w} ${h}`); placeMapPins();
  }
  const regrab=()=>{ if(pts.size)grab(...mid()); else anchor=null; };
  function apply(){ raf=0; if(!anchor||!pts.size)return; const [px,py]=mid(); show(anchor.d?anchor.w*anchor.d/spread():anchor.w,px,py); }
  geoMap.addEventListener("pointerdown",e=>{ if(e.pointerType==="mouse"&&e.button)return; pts.set(e.pointerId,[e.clientX,e.clientY]); moved=0; regrab(); });
  addEventListener("pointermove",e=>{ const p=pts.get(e.pointerId); if(!p)return;
    moved+=Math.abs(e.clientX-p[0])+Math.abs(e.clientY-p[1]); p[0]=e.clientX; p[1]=e.clientY;
    if(moved>10&&!raf)raf=requestAnimationFrame(apply); });
  const up=e=>{ if(pts.delete(e.pointerId))regrab(); };
  addEventListener("pointerup",up); addEventListener("pointercancel",up);
  geoMap.addEventListener("click",e=>{ if(moved>10){ e.stopPropagation(); e.preventDefault(); moved=0; } },true); // a drag is not a pin tap
  geoMap.addEventListener("click",e=>{ if(peekPin&&!e.target.closest(".pin-g"))setPeek(null); }); // tap the map itself to dismiss the preview
  function zoomBy(f,px,py){ grab(px,py); anchor.d=0; show(geoMap.viewBox.baseVal.width/f,px,py); }
  wrap.querySelector(".mapZoom").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b)return; const r=geoMap.getBoundingClientRect(); zoomBy(+b.dataset.f,r.left+r.width/2,r.top+r.height/2); });
  geoMap.addEventListener("wheel",e=>{ if(!e.ctrlKey&&!e.metaKey)return; e.preventDefault(); zoomBy(Math.exp(-e.deltaY*.01),e.clientX,e.clientY); },{passive:false}); // trackpad pinch arrives as Ctrl+wheel
})();
document.querySelector(".geoZoom").addEventListener("click",e=>{ const b=e.target.closest("[data-z]"); if(b)geoZoom(b.dataset.z); });
function mapFit(){ // desktop shows the whole country; phones only the Peninsular or the Sabah and Sarawak crop. True if it changed the view
  if(!geoMap.getBoundingClientRect().width)return false; // not on screen yet: the outlines have no size to crop to
  const wide=innerWidth>620, z=geoMap.dataset.z; if(wide?z==="all":(z==="pen"||z==="bor"))return false; geoZoom(wide?"all":"pen"); return true;
}
{ const ro=new ResizeObserver(()=>{ ovSize(); if(mapFit())return; placeMapPins(); if(ovState)ovPlacePins(); }); ro.observe(document.getElementById("ovMap")); ro.observe(geoMap); } // pins re-size when the window does
(function(){ // partner logos: use the image if the file is there, else show the name in a dashed tile (drop the files in assets/logos/)
  document.querySelectorAll(".logo").forEach(el=>{
    const miss=()=>{ el.classList.add("missing"); el.textContent=el.dataset.name; el.title="Logo file not added yet: "+el.dataset.src; };
    const img=new Image(); img.alt=el.dataset.name; img.onload=()=>{ el.textContent=""; el.appendChild(img); }; img.onerror=miss; img.src=el.dataset.src;
  });
})();
(function(){ // mobile: tap the banner to read all of it; hide the chat button while scrolling down so it never covers content
  const fl=document.querySelector(".flag"); if(fl)fl.addEventListener("click",()=>fl.classList.toggle("open"));
  const f=document.getElementById("chatFab"); let y=scrollY;
  addEventListener("scroll",()=>{ const d=scrollY-y; if(Math.abs(d)<6)return; y=scrollY; f.classList.toggle("away",d>0&&innerWidth<=620&&document.getElementById("chatPanel").hidden); },{passive:true});
})();
function showPage(id){
  document.querySelectorAll("nav button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.p===id)));
  document.querySelectorAll(".page").forEach(p=>p.hidden=(p.id!==id));
  requestAnimationFrame(()=>requestAnimationFrame(growBars));
  window.scrollTo({top:0});
  const nv=document.querySelector("nav"), cur=nv.querySelector('[aria-selected="true"]'); // keep the active tab in view on narrow screens
  if(cur)nv.scrollTo({left:cur.offsetLeft-(nv.clientWidth-cur.offsetWidth)/2,behavior:"smooth"});
  if(typeof chatRefreshChips==="function")chatRefreshChips();
}


// ---- Data quality page: coverage matrix built from the same data the maps use ----
function buildCoverage(){
  const own=t=>`<span class="cv own">${t||"Own"}</span>`, sh=t=>`<span class="cv sh">${t}</span>`, no='<span class="cv no">none</span>';
  const rows=[]; let nVis=0,nCoral=0,nScored=0,nProv=0;
  for(const n of Object.keys(PANEL)){
    const d=PANEL[n], cb=k=>d.cbar.find(i=>i.n===k), pb=k=>d.pbar.find(i=>i.n===k);
    const reef=cb("Live coral cover");
    rows.push([n,pb("Marine park visitors")?.real?sh("State"):no, reef?.real?own():no, cb("Water headroom")?.real?sh("State"):no, cb("Waste handling")?.real?sh("State"):no,
      pb("Cost-of-living pressure")?.real?sh("District"):no, no, '<span class="cv sh">Scored*</span>']);
    nScored++; if(reef?.real)nCoral++;
  }
  for(const [n,d] of Object.entries(PENDING)){
    const has=k=>d.real.find(r=>r.n.startsWith(k)), reef=has("Live coral cover");
    const vis=d.visitors?own(): has("Marine park visitors")?own("Own, 2017"):no;
    const water=has("Water headroom")&&has("Households with piped")?sh("State, district"):has("Water headroom")?sh("State"):has("Households with piped")?sh("District"):no;
    rows.push([n,vis,reef?(/Shared/.test(reef.src)?sh("Shared"):own()):no,water,has("Managed waste")?sh("State"):no,
      has("Resident population")||has("Median household")?sh("District"):no, d.prov?'<span class="cv pv">Found</span>':no, d.prov?'<span class="cv pv">Provisional</span>':'<span class="cv no">none</span>']);
    if(d.visitors||has("Marine park visitors"))nVis++; if(reef)nCoral++; if(d.prov)nProv++;
  }
  const stOf=n=>PANEL[n]?GEO.pins[n].state:PENDING[n].state;
  document.getElementById("cvBody").innerHTML=rows.map(r=>`<tr data-q="${esc((r[0]+" "+stOf(r[0])).toLowerCase())}"><td>${esc(r[0])}</td>${r.slice(1).map(c=>`<td>${c}</td>`).join("")}</tr>`).join("");
  document.getElementById("cvSummary").textContent=`${rows.length} places: ${nScored} scored, ${nProv} provisional, ${rows.length-nScored-nProv} with no score. ${nCoral} have coral cover measured at or near the place, ${nVis} of the tracked places have a visitor series of their own, and ${nProv} have a daily limit. *Scored places are partly built from illustrative values; see Method.`;
}
buildCoverage();
document.getElementById("cvSearch").addEventListener("input",e=>{
  const q=e.target.value.trim().toLowerCase(); let n=0;
  document.querySelectorAll("#cvBody tr").forEach(r=>{ const on=!q||r.dataset.q.includes(q); r.hidden=!on; if(on)n++; });
  document.getElementById("cvCount").textContent=q?`Showing ${n} of ${document.querySelectorAll("#cvBody tr").length} places.`:"";
});

function dqShow(id){
  document.querySelectorAll("#dqTabs button").forEach(b=>{ const on=b.dataset.dq===id; b.setAttribute("aria-selected",String(on)); b.tabIndex=on?0:-1; if(on)b.scrollIntoView({block:"nearest",inline:"nearest"}); });
  ["dqP1","dqP5","dqP3","dqP4"].forEach(p=>{ document.getElementById(p).hidden=(p!==id); });
}
document.getElementById("dqTabs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b)dqShow(b.dataset.dq); });
document.getElementById("dqTabs").addEventListener("keydown",e=>{
  if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
  const tabs=[...document.querySelectorAll("#dqTabs button")], i=tabs.findIndex(b=>b.getAttribute("aria-selected")==="true"), n=tabs[(i+(e.key==="ArrowRight"?1:tabs.length-1))%tabs.length];
  dqShow(n.dataset.dq); n.focus();
});

// ---- Early warning: triage board, what-if levers, seasonal calendar -------------------------------------------------
const RESPONSE={amber:"Monitor monthly; prepare staged permit release.",red:"Apply quota or pricing; prioritise infrastructure.",crit:"Consider closure, moratorium, ecological assessment."};
const SEASON=APPDATA.seasonData;
const clampN=(v,a,b)=>Math.max(a,Math.min(b,v));
// Latest-year score with levers applied: vis = fractional change to the visitor indicator (pbar[0]), cap = {indicator name: amount added}.

// Tiny inline score-history line: own y-range (padded, always including 50), dashed threshold, dot on the latest year.
function sparkSVG(series){
  const W=240,H=38,pad=4,lo=Math.min(...series,50)-4,hi=Math.max(...series,50)+4;
  const x=i=>pad+i*(W-2*pad)/(series.length-1), y=v=>H-pad-(v-lo)/(hi-lo)*(H-2*pad);
  const pts=series.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Score history ${YR[0]} to ${YR[YR.length-1]}: ${series[0]} to ${series[series.length-1]}">`
    +`<line x1="${pad}" x2="${W-pad}" y1="${y(50).toFixed(1)}" y2="${y(50).toFixed(1)}" stroke="${TH("--ink-3")}" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>`
    +`<polyline points="${pts}" fill="none" stroke="${TH("--ink")}" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
    +`<circle cx="${x(series.length-1).toFixed(1)}" cy="${y(series[series.length-1]).toFixed(1)}" r="3" fill="${TH("--ink")}"/></svg>`;
}
let triFilter="all";
const triSeries=new Map(); // name -> last drawn score series, so a changed series can morph instead of jump
function morphSpark(el,from,to){
  if(el._sp)cancelAnimationFrame(el._sp);
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const t0=performance.now();
  (function step(t){ const f=Math.min(1,(t-t0)/800), e=1-Math.pow(1-f,3);
    el.innerHTML=sparkSVG(to.map((v,i)=>from[i]+(v-from[i])*e)); if(f<1)el._sp=requestAnimationFrame(step); })(t0);
}
function renderTriage(){
  const DEST=computeDest().slice().sort((a,b)=>b.s-a.s), el=document.getElementById("triage");
  const lanes=BANDS.slice(1).reverse().map(b=>[b.k,LBL[b.k],bandRng(b)]);
  const watch=DEST.filter(d=>d.band!=="green"), shown=triFilter==="all"?watch:watch.filter(d=>d.band===triFilter);
  const cnt=k=>watch.filter(d=>d.band===k).length, lane=lanes.find(l=>l[0]===triFilter);
  const f=(k,lab)=>`<button type="button" class="triF" data-f="${k}" aria-pressed="${triFilter===k}">${k==="all"?"":`<i class="dot ${k}"></i>`}${lab} <span class="num">${k==="all"?watch.length:cnt(k)}</span></button>`;
  const i18=YR.indexOf(2018);
  el.innerHTML=`<div class="triFilter" role="group" aria-label="Filter by band">${f("all","All")}${lanes.map(([k,lab])=>f(k,lab)).join("")}</div>`
    +`<p class="triResp">${lane?`<b>${lane[1]}</b> (${lane[2]}): ${RESPONSE[triFilter]}`:"Highest score first. Click a destination for the full breakdown."}</p>`
    +(shown.length?shown.map(d=>{ const p=PANEL[d.n], dr=topDriver(p), w=weakest(p), dlt=p.score[p.score.length-1]-p.score[i18];
      return `<button class="triRow" type="button" data-dest="${d.n}" data-b="${d.band}" title="Weakest capacity: ${w.n} (${w.v.toFixed(2)})">
        <span class="nm">${d.n}</span>
        <span class="drv">Largest weighted input: ${dr.n}, ${Math.round(dr.share*100)}%</span>
        <span class="spark">${sparkSVG(p.score)}</span>
        <span class="dl ${dlt>0?"up":dlt<0?"dn":""}">${dlt>0?"▲ +":dlt<0?"▼ ":""}${dlt===0?"no change":dlt} <small>since 2018</small></span>
        <span class="sc"><b class="num">${d.s}</b><span class="pill ${PILL[d.band]}">${LBL[d.band]}</span></span></button>`; }).join(""):`<p class="empty">None right now.</p>`);
  el.querySelectorAll(".triRow").forEach(r=>{ const n=r.dataset.dest, now=PANEL[n].score, old=triSeries.get(n);
    if(old&&old.length===now.length&&old.some((v,i)=>v!==now[i]))morphSpark(r.querySelector(".spark"),old,now);
    triSeries.set(n,now.slice()); });
  const prov=Object.entries(PENDING).filter(([n,d])=>d.prov);
  document.getElementById("triProv").textContent=prov.length?`Not on the board (a different, simpler provisional measure, not comparable): ${prov.map(([n,d])=>`${n} ${d.prov.score}`).join(", ")}. See Destination detail.`:"";
}
document.getElementById("triage").addEventListener("click",e=>{
  const fb=e.target.closest(".triF"); if(fb){ triFilter=fb.dataset.f; renderTriage(); document.querySelector(`.triF[data-f="${triFilter}"]`).focus(); return; }
  const b=e.target.closest(".triRow"); if(b){ selectDest(b.dataset.dest); showPage("p2"); }
});

// What-if
const wi={dest:null,vis:0,cap:{}};
function wiBuild(){
  const d=PANEL[wi.dest], box=document.getElementById("wiLevers");
  const vmax=200; // ponytail: no hard ceiling exists for real visitors; +200% (3x) is an arbitrary slider range
  wi.vis=Math.min(wi.vis,vmax/100);
  box.innerHTML=`<fieldset class="leverBox"><legend>Pressure</legend><div class="lever"><label for="wiVis"><span>Visitors <span class="note" style="margin:0">no hard cap, up to +${vmax}%</span></span><span class="num" id="wiVisV">0%</span></label><input type="range" id="wiVis" min="-60" max="${vmax}" step="5" value="${Math.round(wi.vis*100)}"></div></fieldset>`
    +`<fieldset class="leverBox"><legend>Capacity</legend>`+d.cbar.map((it,i)=>`<div class="lever"><label for="wiC${i}"><span>${it.n} <span class="note" style="margin:0">now ${it.v.toFixed(2)}</span></span><span class="num" id="wiC${i}V">+0.00</span></label><input type="range" id="wiC${i}" min="0" max="0.5" step="0.05" value="${wi.cap[it.n]||0}"></div>`).join("")+`</fieldset>`;
  document.getElementById("wiVis").addEventListener("input",e=>{ wi.vis=e.target.value/100; wiRender(); });
  d.cbar.forEach((it,i)=>document.getElementById("wiC"+i).addEventListener("input",e=>{ wi.cap[it.n]=+e.target.value; wiRender(); }));
}
function wiRender(){
  const d=PANEL[wi.dest], now=scoreWith(d), after=scoreWith(d,{vis:wi.vis,cap:wi.cap});
  document.getElementById("wiVisV").textContent=`${wi.vis>0?"+":""}${Math.round(wi.vis*100)}%`;
  d.cbar.forEach((it,i)=>{ document.getElementById("wiC"+i+"V").textContent=`+${(wi.cap[it.n]||0).toFixed(2)}`; });
  const b0=bandFor(now.s), b1=bandFor(after.s);
  document.getElementById("wiResult").innerHTML=`<div class="wiRes">
    <div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end">
      <div><div class="note" style="margin:0">Now</div><span class="big num" data-k="now" data-d="0">${now.s}</span> <span class="pill ${PILL[b0]}">${LBL[b0]}</span></div>
      <div><div class="note" style="margin:0">With your changes</div><span class="big num" data-k="after" data-d="0">${after.s}</span> <span class="pill ${PILL[b1]}">${LBL[b1]}</span></div>
      <div><div class="note" style="margin:0">Change</div><span class="big num" data-k="chg" data-d="0" data-sign="1">${after.s-now.s>0?"+":""}${after.s-now.s}</span></div></div>
    <p class="note" style="margin:10px 0 0">Pressure P ${now.P.toFixed(2)} to ${after.P.toFixed(2)}; capacity C ${now.C.toFixed(2)} to ${after.C.toFixed(2)}.</p>
    ${wiCalc(d,now,after)}</div>`;
  wiAnimate();
  renderWiChart();
}
// Step-by-step working behind the What-if score, plus number tweens so changes read as a calculation, not a jump.
const wiPrev={};
function wiCalc(d,now,after){
  const mv={vis:wi.vis,cap:wi.cap};
  const rows=(items,mapAfter,kind)=>{ const tw=items.reduce((a,it)=>a+it.w,0);
    return items.map((it,i)=>{ const v1=mapAfter[i].v, ch=Math.abs(v1-it.v)>1e-9;
      return `<tr class="${ch?"wiChg":""}"><td>${it.n}</td><td class="num">${Math.round(100*it.w/tw)}%</td><td class="num">${it.v.toFixed(2)}</td><td class="num" data-k="${kind}${i}" data-d="2">${v1.toFixed(2)}</td></tr>`; }).join(""); };
  const pa=d.pbar.map((it,i)=>({v:i===0?Math.max(.03,it.v*(1+wi.vis)):it.v}));
  const ca=d.cbar.map(it=>({v:Math.min(.95,Math.max(it.v,it.v+(wi.cap[it.n]||0)))}));
  const head=t=>`<thead><tr><th>${t}</th><th class="num">Weight</th><th class="num">Now</th><th class="num">With changes</th></tr></thead>`;
  return `<div class="wiCalc"><h4 style="margin:16px 0 4px;font-size:14px">How this score is calculated</h4>
    <p class="note" style="margin:6px 0">1. Each indicator is scaled 0 to 1. 2. Pressure P and capacity C are each a weighted geometric mean (the weights multiply in as powers, so one weak indicator drags the whole side down). 3. Score = 100 × P ÷ (P + C).</p>
    <table>${head("Pressure indicators")}<tbody>${rows(d.pbar,pa,"p")}</tbody></table>
    <p class="note" style="margin:6px 0 12px">P = <span class="num">${now.P.toFixed(2)}</span> → <b class="num" data-k="P" data-d="2">${after.P.toFixed(2)}</b></p>
    <table>${head("Capacity indicators")}<tbody>${rows(d.cbar,ca,"c")}</tbody></table>
    <p class="note" style="margin:6px 0 12px">C = <span class="num">${now.C.toFixed(2)}</span> → <b class="num" data-k="C" data-d="2">${after.C.toFixed(2)}</b></p>
    <p class="wiFormula num">100 × ${after.P.toFixed(2)} ÷ (${after.P.toFixed(2)} + ${after.C.toFixed(2)}) = <b data-k="S" data-d="0">${after.s}</b></p></div>`;
}
function wiAnimate(){
  const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("#wiResult [data-k]").forEach(el=>{
    const k=wi.dest+el.dataset.k, to=parseFloat(el.textContent), dp=+el.dataset.d, sg=el.dataset.sign,
      from=wiPrev[k]!==undefined?wiPrev[k]:to, fmt=v=>(sg&&v>0?"+":"")+v.toFixed(dp);
    wiPrev[k]=to;
    if(reduce||from===to)return;
    const t0=performance.now(), dur=500;
    (function step(t){ const f=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-f,3); el.textContent=fmt(from+(to-from)*e);
      if(f<1)requestAnimationFrame(step); else el.textContent=fmt(to); })(t0);
  });
}
let c8;
const WI_RGB={green:["21,127,108",.10],amber:["184,121,26",.16],red:["214,80,50",.20],crit:["90,16,16",.34]};
const WI_BANDS=BANDS.map(b=>[b.lo,b.hi,WI_RGB[b.k][0],LBL[b.k],WI_RGB[b.k][1]]);
const wiZones={id:"wiZones",
  beforeDatasetsDraw(c){ const {ctx,chartArea:a,scales:{x,y}}=c; ctx.save(); ctx.beginPath(); ctx.rect(a.left,a.top,a.width,a.height); ctx.clip();
    WI_BANDS.forEach(([lo,hi,rgb,n,al])=>{ ctx.fillStyle=`rgba(${rgb},${al})`; const t=y.getPixelForValue(hi), bt=y.getPixelForValue(lo); ctx.fillRect(a.left,t,a.width,bt-t); });
    const x0=x.getPixelForValue(0); ctx.strokeStyle=TH("--ink-3"); ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(x0,a.top); ctx.lineTo(x0,a.bottom); ctx.stroke(); ctx.restore(); },
  afterDatasetsDraw(c){ const {ctx,chartArea:a,scales:{x,y}}=c; ctx.save(); ctx.font="600 11px IBM Plex Sans"; ctx.textAlign="right"; ctx.textBaseline="top";
    WI_BANDS.forEach(([lo,hi,rgb,n])=>{ const t=Math.max(y.getPixelForValue(hi),a.top), bt=Math.min(y.getPixelForValue(lo),a.bottom); if(bt-t>16){ ctx.fillStyle=`rgb(${rgb})`; ctx.fillText(n.toUpperCase(),a.right-8,t+5); } });
    ctx.fillStyle=TH("--ink-2"); ctx.textAlign="left"; ctx.textBaseline="bottom"; ctx.fillText("today",x.getPixelForValue(0)+5,a.bottom-4);
    const m=c.getDatasetMeta(1).data[0]; if(m){ const ph=(performance.now()%1600)/1600; ctx.strokeStyle=`rgba(196,68,44,${(1-ph).toFixed(2)})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(m.x,m.y,7+ph*16,0,Math.PI*2); ctx.stroke(); } ctx.restore(); }};
let wiPulse, wiIO;
function renderWiChart(){
  const d=PANEL[wi.dest], pts=[], raw=v=>{ const r=scoreWith(d,{vis:v/100,cap:wi.cap}); return 100*r.P/(r.P+r.C); };
  for(let v=-60;v<=200;v+=5)pts.push({x:v,y:+raw(v).toFixed(1)});
  const cur=wi.vis*100, ys=pts.map(q=>q.y), lo=Math.max(0,Math.floor((Math.min(...ys,cur?raw(cur):100)-6)/10)*10), hi=Math.min(100,Math.max(lo+30,Math.ceil((Math.max(...ys)+6)/10)*10));
  const here={x:cur,y:+raw(cur).toFixed(1)};
  if(c8&&c8._wiDest===wi.dest&&c8.canvas.isConnected){ // sliders: move the line in place, no redraw animation
    c8.data.datasets[0].data=pts; c8.data.datasets[1].data=[here]; c8.options.scales.y.min=lo; c8.options.scales.y.max=hi; c8.update("none"); return; }
  if(c8)c8.destroy();
  cancelAnimationFrame(wiPulse);
  c8=new Chart(document.getElementById("c8"),{type:"line",plugins:[wiZones],
    data:{datasets:[
      {label:"Score",data:pts,borderColor:TH("--ink"),borderWidth:2.5,cubicInterpolationMode:"monotone",pointRadius:0,pointHoverRadius:4,tension:.3},
      {label:"Your setting",data:[here],borderColor:TH("--surface"),borderWidth:2,backgroundColor:TH("--coral"),pointRadius:7,showLine:false}]},
    options:base({animation:{duration:400},layout:{padding:{right:6,top:6}},interaction:{mode:"nearest",intersect:false},
      plugins:{legend:{display:false},tooltip:{callbacks:{title:i=>`Visitors ${i[0].parsed.x>0?"+":""}${Math.round(i[0].parsed.x)}%`,label:i=>`Score ${i.parsed.y.toFixed(0)}`}}},
      scales:{x:{type:"linear",min:-60,max:200,title:{display:true,text:"Change in visitors",color:TH("--ink-2"),font:{size:11}},grid:{display:false},ticks:{...TICK,stepSize:innerWidth<620?50:20,maxRotation:0,callback:v=>(v>0?"+":"")+v+"%"}},
        y:{min:lo,max:hi,title:{display:true,text:"AMBANG score",color:TH("--ink-2"),font:{size:11}},grid:{color:TH("--grid")},ticks:{...TICK,stepSize:10},border:{display:false}}}})});
  c8._wiDest=wi.dest;
  const ch=c8, loop=()=>{ if(ch!==c8)return; ch.draw(); wiPulse=requestAnimationFrame(loop); }; // pulsing ring on "Your setting", runs only while the chart is on screen
  if(wiIO)wiIO.disconnect();
  if(!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)&&"IntersectionObserver" in window){
    wiIO=new IntersectionObserver(([e])=>{ cancelAnimationFrame(wiPulse); if(e.isIntersecting)loop(); }); wiIO.observe(ch.canvas); }
}
function wiSet(name){ wi.dest=name; wi.vis=0; wi.cap={}; wiBuild(); wiRender(); }
const wiSel=document.getElementById("wiSel");
Object.keys(PANEL).forEach(k=>{ const o=document.createElement("option"); o.value=k; o.textContent=k; wiSel.appendChild(o); });
wiSel.addEventListener("change",e=>wiSet(e.target.value));
document.getElementById("wiReset").addEventListener("click",()=>wiSet(wi.dest));

// Seasonal calendar
let c9;
function renderSeasonChart(n){
  const s=SEASON[n], M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], closed=EAST_CLOSED.includes(n);
  const vals=s.month_share.map(v=>+(v*100).toFixed(1)), peak=vals.indexOf(Math.max(...vals)), shut=i=>closed&&[10,11,0,1].includes(i);
  if(c9)c9.destroy();
  c9=new Chart(document.getElementById("c9"),{type:"bar",
    data:{labels:M,datasets:[
      {type:"bar",label:"Share of the year's interest",data:vals,backgroundColor:vals.map((v,i)=>shut(i)?TH("--bar-off"):i===peak?TH("--teal"):TH("--bar")),maxBarThickness:28},
      {type:"line",label:"Even year (8.3%)",data:vals.map(()=>8.3),borderColor:TH("--ink-3"),borderDash:[5,4],borderWidth:1.5,pointRadius:0}]},
    options:base({plugins:{legend:{labels:{boxWidth:10,boxHeight:10,font:{size:12},color:TH("--ink")}}},
      scales:{x:{grid:{display:false},ticks:TICK},y:{min:0,title:{display:true,text:"% of the year's interest",color:TH("--ink-2"),font:{size:11}},grid:GRID,ticks:{...TICK,callback:v=>v+"%"},border:{display:false}}}})});
  document.getElementById("calChartNote").textContent=`${n}: peak month ${M[peak]} (${vals[peak]}%).`
    +(s.ms_share!=null?` Malay-language pages are ${Math.round(s.ms_share*100)}% of the views, so this is not an English-only picture.`:"")
    +(s.term_share?` Share of searches by term: ${Object.entries(s.term_share).map(([t,v])=>`${t} ${Math.round(v*100)}%`).join(", ")}.`:"")
    +(closed?" Grey bars are the typical resort-closure months (Nov to Feb).":"")
    +(s.reliable?"":" Too little volume to read a season from: do not rely on this.")
    +` Source: ${s.source||"Google Trends searches in Malaysia"}.`;
}
// One place to change the selected destination, so the dropdown, the chart and the highlighted table row always agree.
function calPick(n){
  document.getElementById("calSel").value=n; renderSeasonChart(n);
  document.querySelectorAll("#calTbl tr[data-n]").forEach(r=>{ const on=r.dataset.n===n; r.classList.toggle("sel",on); r.querySelector(".calBtn").setAttribute("aria-pressed",String(on)); });
}
function renderCalendar(){
  const order=["Perhentian","Redang","Lang Tengah","Kapas","Tioman","Sibu","Tinggi","Langkawi","Pangkor","Cameron Highlands","Fraser's Hill","Sipadan / Mabul","Tunku Abdul Rahman Park","Kinabalu / Kundasang"];
  const names=order.filter(n=>SEASON[n]).concat(Object.keys(SEASON).filter(n=>!order.includes(n)&&(PANEL[n]||PENDING[n])));
  const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let html=`<thead><tr><th scope="col">Destination</th>${M.map(m=>`<th scope="col">${m}</th>`).join("")}</tr></thead><tbody>`;
  names.forEach(n=>{
    const s=SEASON[n], closed=EAST_CLOSED.includes(n);
    html+=`<tr class="${s.reliable?"":"low"}" data-n="${n.replace(/"/g,"&quot;")}" ><td class="nm"><button type="button" class="calBtn" aria-pressed="false" aria-label="Chart ${n.replace(/"/g,"&quot;")} above">${n}</button>${s.reliable?"":`<small>low volume, do not read</small>`}${s.measures==="visits"?`<small>climber counts</small>`:""}</td>`
      +s.month_share.map((v,i)=>{
        const t=clampN((v-.06)/.07,0,1), shut=closed&&[10,11,0,1].includes(i);
        const lab=`${n}, ${M[i]}: ${(v*100).toFixed(1)}% of the year's interest${shut?", typical resort closure":""}`;
        return shut?`<td class="c calHatch" title="${lab}" aria-label="${lab}">×</td>`:`<td class="c" style="background:rgba(21,127,108,${(.10+.6*t).toFixed(2)})" title="${lab}" aria-label="${lab}">${Math.round(v*100)}</td>`;
      }).join("")+`</tr>`;
  });
  document.getElementById("calTbl").innerHTML=html+"</tbody>";
  const cs=document.getElementById("calSel");
  if(!cs.options.length){
    names.forEach(n=>{ const o=document.createElement("option"); o.value=n; o.textContent=n; cs.appendChild(o); });
    cs.addEventListener("change",e=>calPick(e.target.value));
    cs.value=names.includes("Perhentian")?"Perhentian":names[0];
    const tb=document.getElementById("calTbl"), go=r=>{ if(r){ calPick(r.dataset.n); document.getElementById("c9").scrollIntoView({behavior:"smooth",block:"center"}); } }; // click a table row = pick that destination
    tb.addEventListener("click",e=>go(e.target.closest("tr[data-n]")));
  }
  calPick(cs.value);
  document.getElementById("calNote").innerHTML=`Cells show each month's share of the year's interest in percent (an even year is 8.3). Interest is when people look a place up (Wikipedia pageviews in English and Malay, 2016 to 2025 without the COVID years 2020 and 2021), not when they visit; Kinabalu uses real monthly climber counts from Sabah Parks. Flat rows mean interest barely changes across the year. Hatched months mark the typical northeast monsoon closure of resorts on the Terengganu and Pahang islands, October or November to February, reopening in March (<a href="https://www.tin.media/news/details/terengganu-islands-quiets-down-as-monsoon-season-sets-in" target="_blank" rel="noopener">Terengganu tourism department, as reported</a>); it varies by resort.`;
}

// Early warning sub-tabs: one panel at a time. Charts made while a panel was hidden are resized when it opens.
function ewShow(panelId){
  document.querySelectorAll("#ewTabs button").forEach(b=>{ const on=b.dataset.ew===panelId; b.setAttribute("aria-selected",String(on)); b.tabIndex=on?0:-1; });
  ["ewP1","ewP2","ewP3"].forEach(id=>{ document.getElementById(id).hidden=(id!==panelId); });
  if(panelId==="ewP2"&&c8)c8.resize();
  if(panelId==="ewP3"&&c9)c9.resize();
}
document.getElementById("ewTabs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b)ewShow(b.dataset.ew); });
document.getElementById("ewTabs").addEventListener("keydown",e=>{
  if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
  const tabs=[...document.querySelectorAll("#ewTabs button")], i=tabs.findIndex(b=>b.getAttribute("aria-selected")==="true"), n=tabs[(i+(e.key==="ArrowRight"?1:tabs.length-1))%tabs.length];
  ewShow(n.dataset.ew); n.focus();
});
function renderEarlyWarning(){
  renderTriage();
  document.getElementById("ewCount").textContent=computeDest().filter(d=>d.band!=="green").length;
  if(!wi.dest){ wiSet(computeDest().slice().sort((a,b)=>b.s-a.s)[0].n); wiSel.value=wi.dest; }
  else wiRender();
}
renderEarlyWarning();
renderCalendar();

// Method: tabs, weight bars, provisional list (read from the live data so the page cannot drift)
function mtShow(id){
  document.querySelectorAll("#mtTabs button").forEach(b=>{ const on=b.dataset.mt===id; b.setAttribute("aria-selected",String(on)); b.tabIndex=on?0:-1; });
  ["mtP1","mtP3"].forEach(p=>{ document.getElementById(p).hidden=(p!==id); });
}
document.getElementById("mtTabs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b)mtShow(b.dataset.mt); });
document.getElementById("mtTabs").addEventListener("keydown",e=>{
  if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
  const tabs=[...document.querySelectorAll("#mtTabs button")], i=tabs.findIndex(b=>b.getAttribute("aria-selected")==="true"), n=tabs[(i+(e.key==="ArrowRight"?1:tabs.length-1))%tabs.length];
  mtShow(n.dataset.mt); n.focus();
});
(function renderMethodDyn(){
  const NAMES={visitor:"Marine park visitors",accom:"Accommodation density",hotel:"Hotel guest arrivals",income:"Cost-of-living pressure",season:"Seasonality",occ:"Occupancy"};
  const w=WEIGHT_SCHEMES.ewm, ks=Object.keys(w).sort((a,b)=>w[b]-w[a]), mx=w[ks[0]];
  document.getElementById("wBars").innerHTML=ks.map(k=>`<div class="wrow"><span>${NAMES[k]}</span><span class="bt"><i style="width:${(w[k]/mx*100).toFixed(1)}%;background:#3E7C8C"></i></span><span class="num">${(w[k]*100).toFixed(1)}%</span></div>`).join("");
  { const q=Object.entries(PENDING), uns=q.filter(([n,d])=>!d.prov).map(([n])=>n), noted=["Langkawi","Pangkor","Fraser's Hill","Miri"], more=uns.filter(n=>!noted.includes(n)).length; // counts come from the data, so they cannot go stale
    document.getElementById("nScored").textContent=Object.keys(PANEL).length;
    document.getElementById("nProv").textContent=q.length-uns.length;
    document.getElementById("nUns").textContent=uns.length;
    const m=document.getElementById("unsMore"); m.hidden=!more; m.innerHTML=`<b>${more} more places</b> added from the Atlas: tracked, no usable data yet. They are listed in the Coverage table.`; }
  document.getElementById("destProv").innerHTML=Object.entries(PENDING).filter(([n,d])=>d.prov).map(([n,d])=>`<li><b>${esc(n)}: ${esc(d.prov.score)}</b> (range ${esc(d.prov.lo)} to ${esc(d.prov.hi)}), limit used: ${esc(d.prov.caps[0].label.replace(/^Central: /,""))}</li>`).join("");
})();

const tabs=[...document.querySelectorAll("nav button")];
tabs.forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.p)));
document.getElementById("homeLink").addEventListener("click",e=>{ e.preventDefault(); showPage("p1"); });

// AI summary and chat: every call goes to this site's own /api/ai (scripts/server.js), which holds the ILMU key, caches shared answers and rate-limits.

// ================= AI layer: server call, context, formatting, chat, page briefs =================
const aiPage=()=>({view:aiViewName(),sel:sel.value,scheme:document.getElementById("wscheme").value}); // read by ai.js
function aiViewName(){ const b=document.querySelector("nav button[aria-selected='true']"); return b?b.textContent.trim():""; }

// Destination names in a reply become buttons that open that destination.
function linkDests(root){
  const names=[...Object.keys(PANEL),...Object.keys(PENDING)].sort((a,b)=>b.length-a.length);
  const re=new RegExp("(?<![\\w])("+names.map(n=>n.replace(/[.*+?^${}()|[\]\\\/]/g,"\\$&")).join("|")+")(?![\\w])","g");
  const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest("button,a,code")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes=[]; while(tw.nextNode())nodes.push(tw.currentNode);
  nodes.forEach(node=>{
    const t=node.nodeValue; re.lastIndex=0; if(!re.test(t))return; re.lastIndex=0;
    const frag=document.createDocumentFragment(); let last=0, m;
    while((m=re.exec(t))){ frag.append(t.slice(last,m.index)); const b=document.createElement("button"); b.type="button"; b.className="dlink"; b.dataset.dest=m[1]; b.textContent=m[1]; frag.append(b); last=m.index+m[0].length; }
    frag.append(t.slice(last)); node.replaceWith(frag);
  });
}
document.addEventListener("click",e=>{
  const b=e.target.closest(".dlink"); if(!b)return;
  selectDest(b.dataset.dest); showPage("p2");
  if(matchMedia("(max-width:620px)").matches)chatToggle(false);
});

// ---- Ask AMBANG: floating chat --------------------------------------------------------------------------
const chatHistory=[]; // sent to the model
const auditLog=[];   // local-only transcript for Export log; never sent anywhere
const auditAdd=(role,text)=>auditLog.push({ts:new Date().toISOString(),role,text});
const chatBody=document.getElementById("chatBody"), chatInput=document.getElementById("chatInput");
let chatBusy=false;
function chatAppend(kind,text,opts={}){
  const div=document.createElement("div");
  div.className="chatMsg "+(kind==="user"?"user":kind==="err"?"err":"bot"); if(kind==="err")div.setAttribute("role","alert"); // role first, so the insert is announced
  if(kind==="bot"){
    div.innerHTML=aiFormat(text); linkDests(div);
    if(!opts.plain){ const act=document.createElement("div"); act.className="chatAct"; const c=document.createElement("button"); c.type="button"; c.className="linkbtn"; c.textContent="Copy"; c.addEventListener("click",()=>copyText(text,c)); act.append(c); div.append(act); }
  }else div.textContent=text;
  chatBody.appendChild(div); chatBody.scrollTop=chatBody.scrollHeight;
  return div;
}
function chatTyping(){
  const div=document.createElement("div"); div.className="chatMsg bot";
  div.innerHTML='<span class="typing" role="status" aria-label="Ask AMBANG is writing"><i></i><i></i><i></i></span>';
  chatBody.appendChild(div); chatBody.scrollTop=chatBody.scrollHeight; return div;
}
function chatMsgWithButtons(kind,text,buttons){
  const div=chatAppend(kind,text,{plain:true}); const act=document.createElement("div"); act.className="chatAct";
  buttons.forEach(([label,fn])=>{ const b=document.createElement("button"); b.type="button"; b.className="linkbtn"; b.textContent=label; b.addEventListener("click",fn); act.append(b); });
  div.append(act); return div;
}
function chatToggle(open){
  const panel=document.getElementById("chatPanel"), show=open!==undefined?open:(panel.hidden||panel.classList.contains("out"));
  clearTimeout(chatToggle.t);
  document.getElementById("chatFab").setAttribute("aria-expanded",String(show));
  if(show){ panel.hidden=false; panel.classList.remove("out"); panel.classList.add("pop"); chatRefreshChips(); chatInput.focus(); }
  else if(!panel.hidden){ panel.classList.remove("pop"); panel.classList.add("out"); chatToggle.t=setTimeout(()=>{ panel.hidden=true; panel.classList.remove("out"); },200); } // pops back in, then hides
}
document.getElementById("chatFab").addEventListener("click",()=>chatToggle());
document.getElementById("chatClose").addEventListener("click",()=>{ chatToggle(false); document.getElementById("chatFab").focus(); });
document.getElementById("chatPanel").addEventListener("keydown",e=>{ if(e.key==="Escape"){ chatToggle(false); document.getElementById("chatFab").focus(); } });
document.getElementById("chatExport").addEventListener("click",()=>{
  if(!auditLog.length){ chatAppend("bot","Nothing to export yet: no questions have been asked this session.",{plain:true}); return; }
  const blob=new Blob([auditLog.map(e=>`[${e.ts}] ${e.role.toUpperCase()}: ${e.text}`).join("\n\n")],{type:"text/plain"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download=`ambang-chat-log-${Date.now()}.txt`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
function chatWelcome(){
  chatAppend("bot","Ask me about a destination's score, what drives it, how places compare, or how the method works. I answer from the data on screen and will say when a figure is illustrative rather than real.",{plain:true});
}
document.getElementById("chatNew").addEventListener("click",()=>{ chatHistory.length=0; chatBody.innerHTML=""; chatInput.maxLength=1000; // the server rejects longer messages
chatWelcome(); chatRefreshChips(); chatInput.focus(); });

function chatChipList(){
  const page=(document.querySelector(".page:not([hidden])")||{}).id, d=sel.value;
  if(page==="p2"&&d){
    if(PANEL[d]) return [`Why is ${d} ${LBL[bandFor(PANEL[d].score[PANEL[d].score.length-1])]}?`,`What would improve ${d} the most?`,`How real is the data for ${d}?`,`How does ${d} compare with the other islands in its state?`];
    return [`Why does ${d} not have a full AMBANG score?`,`What data is missing for ${d}?`,"How do provisional scores differ from the main score?"];
  }
  if(page==="p3") return ["Who needs attention first?","Which lever helps most for the top destination?","Is there a clear visiting season?","What does the monsoon closure change?"];
  if(page==="p4") return ["What is real data and what is illustrative?","Why a geometric mean?","What are the biggest limits of this score?","Why are the capacity weights equal?"];
  return ["Which regions are closest to their limit?","What does a region's colour mean?","Which places are tracked but not scored, and why?","What here is real data and what is a placeholder?"];
}
function chatRefreshChips(){
  const el=document.getElementById("chatChips"), list=chatChipList(), key=list.join("|");
  if(el.dataset.k===key)return; el.dataset.k=key; el.innerHTML=""; // unchanged list: keep the nodes (and any focus on them)
  list.forEach(q=>{ const b=document.createElement("button"); b.className="chip"; b.type="button"; b.textContent=q; b.addEventListener("click",()=>chatSendMsg(q,false,true)); el.appendChild(b); });
}

async function chatRun(text,standalone){
  chatBusy=true; document.getElementById("chatSend").disabled=true; chatInput.disabled=true;
  const typing=chatTyping();
  try{
    // Suggested questions are self-contained, so they go alone: the same button then produces the same request for everyone and the server cache can answer it.
    // Typed questions keep the last 11 turns for context (and to stay inside the server limit).
    const reply=await aiAsk(standalone?[{role:"user",content:text}]:chatHistory.slice(-11),aiBuildDashboardContext(),700);
    typing.remove(); chatAppend("bot",reply);
    if(reply.startsWith("I can only answer questions about this dashboard")){ chatHistory.pop(); } // a refused question must not stay in the context that later turns are answered from
    else chatHistory.push({role:"assistant",content:reply});
    auditAdd("assistant",reply);
  }catch(err){
    typing.remove(); chatHistory.pop(); auditAdd("error",err.message);
    const m=chatMsgWithButtons("err",err.message,[["Retry",()=>{ m.remove(); chatSendMsg(text,true,standalone); }]]);
    if(err.kind==="rate")aiCountdown(m.querySelector(".linkbtn"),"Retry",err.wait);
  }finally{
    chatBusy=false; document.getElementById("chatSend").disabled=false; chatInput.disabled=false; if(!matchMedia("(pointer:coarse)").matches)chatInput.focus(); chatRefreshChips(); // phones: leave the keyboard down so the answer stays readable
  }
}
async function chatSendMsg(override,isRetry,standalone){
  const text=(override||chatInput.value).trim();
  if(!text||chatBusy)return;
  if(!isRetry){ chatAppend("user",text); auditAdd("user",text); }
  chatInput.value=""; chatInput.style.height="auto";
  chatHistory.push({role:"user",content:text});
  await chatRun(text,standalone);
}
document.getElementById("chatSend").addEventListener("click",()=>chatSendMsg());
chatInput.addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); chatSendMsg(); } });
chatInput.addEventListener("input",function(){ this.style.height="auto"; this.style.height=Math.min(this.scrollHeight,90)+"px"; });
chatWelcome(); chatRefreshChips();

// ---- AI briefs: a short written summary of the page you are on -------------------------------------------
const movesText=n=>{
  const d=PANEL[n], now=scoreWith(d).s;
  const ms=[{l:"visitors down 20%",s:scoreWith(d,{vis:-.2}).s}].concat(d.cbar.map(it=>({l:`${it.n} up 0.20`,s:scoreWith(d,{cap:{[it.n]:.2}}).s}))).sort((a,b)=>a.s-b.s);
  return `${n}: now ${now}; one move at a time gives ${ms.map(m=>`${m.l} -> ${m.s}`).join(", ")}`;
};
function briefPromptDest(){
  const n=sel.value; if(!n)return null;
  if(PANEL[n])return `Write a brief for a policymaker about ${n}. In 4 to 6 plain sentences cover: its score and band, the two biggest pressure drivers, the binding capacity constraint, one concrete next step that matches the band's indicated response, and one sentence on which of its inputs are real and which are illustrative. What-if results you may quote: ${movesText(n)}. Use only numbers from the context.`;
  const d=PENDING[n];
  return `Write a brief for a policymaker about ${n}, which has ${d.prov?"a PROVISIONAL score only":"no AMBANG score"}. In 4 to 6 plain sentences: say clearly that it is ${d.prov?"not comparable with the scored islands, explain the method (average daily visitors against a daily limit) and give its range":"unscored, and why"}, what real data exists for it, what is missing, and the single most useful next step to get a proper score. Use only the context.`;
}
const briefPromptOv=()=>"Write a brief on the national picture for a policymaker, in 5 to 6 plain sentences: rank the regions by average score and say which is closest to its limit and why, name the scored destination highest in each of the top two regions, say which places are tracked but not comparably scored, and end with one caution about data quality. Use only the context.";
const briefPromptEw=()=>{
  const top=computeDest().slice().sort((a,b)=>b.s-a.s).slice(0,2).map(d=>d.n);
  return `Write a brief for a destination manager about who needs attention first, in 5 to 6 plain sentences. Name the top two destinations and the response their band calls for, and say what the what-if analysis implies: whether cutting visitors or fixing the weakest capacity indicator moves the score more. What-if results you may quote: ${top.map(movesText).join(" | ")}. Use only numbers from the context.`;
};
const briefSystem=()=>aiBuildDashboardContext()+"\n\nBRIEF MODE: write one short brief of 90 to 150 words in plain sentences, no headings. Never invent numbers. If something is illustrative, say so.";

const briefs=[];
function makeBrief(id,title,keyFn,promptFn){
  const host=document.getElementById(id);
  host.innerHTML=`<div class="card aiBrief"><div class="chooserTop"><h3>${title}</h3><div class="aiBtns"><button class="btn gen" type="button">Generate brief</button><button class="linkbtn cpy" type="button" hidden>Copy</button></div></div><p class="note aiHint"></p><div class="aiOut" aria-live="polite"></div><p class="aiFoot" hidden>Written by a language model from the data in this dashboard. Check it against the numbers on the page.</p></div>`;
  const q=s=>host.querySelector(s), out=q(".aiOut"), hint=q(".aiHint"), gen=q(".gen"), cpy=q(".cpy"), foot=q(".aiFoot"), cache={};
  const show=text=>{ out.innerHTML=aiFormat(text); linkDests(out); cpy.hidden=false; foot.hidden=false; hint.textContent=""; gen.textContent="Regenerate"; cpy.onclick=()=>copyText(text,cpy); };
  const b={ refresh(){
    const k=keyFn(); hint.classList.remove("aiErr"); out.innerHTML=""; cpy.hidden=true; foot.hidden=true; gen.textContent="Generate brief";
    if(k===null){ hint.textContent="Choose a destination first."; gen.disabled=true; return; }
    gen.disabled=false;
    if(cache[k])show(cache[k]);
    else hint.textContent="Writes a short plain-language brief of this view from the live data.";
  }};
  gen.addEventListener("click",async()=>{
    const k=keyFn(), prompt=promptFn(); if(k===null||!prompt)return;
    gen.disabled=true; hint.classList.remove("aiErr"); hint.textContent="Writing…"; out.innerHTML="";
    try{ const text=await aiAsk([{role:"user",content:prompt}],briefSystem(),600); cache[k]=text; gen.disabled=false; show(text); }
    catch(err){ gen.disabled=false; hint.textContent=err.message; hint.classList.add("aiErr"); hint.setAttribute("role","alert"); gen.textContent="Try again"; if(err.kind==="rate")aiCountdown(gen,"Try again",err.wait); }
  });
  briefs.push(b); b.refresh(); return b;
}
const schemeKey=()=>document.getElementById("wscheme").value;
makeBrief("aiBriefOv","AI brief: national picture",()=>"ov|"+schemeKey(),briefPromptOv);
makeBrief("aiBriefDest","AI brief: this destination",()=>sel.value?"d|"+schemeKey()+"|"+sel.value:null,briefPromptDest);
makeBrief("aiBriefEw","AI brief: who needs attention",()=>"ew|"+schemeKey(),briefPromptEw);
function aiBriefRefresh(){ briefs.forEach(b=>b.refresh()); }


(function(){ // theme switch: set the attribute, drop the colour cache, repaint everything through the same path the weights switch uses
  const btn=document.getElementById("tbtn"), root=document.documentElement;
  const mark=t=>btn.setAttribute("aria-checked",String(t==="dark"));
  mark(root.dataset.theme);
  btn.addEventListener("click",()=>{
    const t=root.dataset.theme==="dark"?"light":"dark";
    const apply=()=>{
      root.dataset.theme=t; try{ localStorage.setItem("ambangTheme",t); }catch(x){}
      for(const k in _thc)delete _thc[k];
      mark(t); applyChartTheme(); paintLegend();
      repaintAll(); // theme colours only; the weights 'change' handler would also wipe the AI briefs
    };
    if(document.startViewTransition&&!matchMedia("(prefers-reduced-motion:reduce)").matches)document.startViewTransition(apply); else apply(); // one cross-fade of a snapshot, not a colour transition on every element
  });
})();
(function(){ // sliding thumb behind the active weights button; ResizeObserver re-places it when the bar is hidden/shown or reflows
  const seg=document.getElementById("wseg"); let first=true;
  const place=()=>{ const b=seg.querySelector('[aria-pressed="true"]'); if(!b||!b.offsetWidth)return;
    seg.style.setProperty("--tx",b.offsetLeft+"px"); seg.style.setProperty("--tw",b.offsetWidth+"px");
    if(first){ first=false; requestAnimationFrame(()=>seg.classList.add("thumb")); } };
  new ResizeObserver(place).observe(seg);
  new MutationObserver(place).observe(seg,{attributes:true,subtree:true,attributeFilter:["aria-pressed"]});
  place();
})();
(function(){ // /classic#p1..p5 opens that tab, /classic#dest=Name opens that destination (used by links from the new view)
  const go=()=>{ let h=""; try{ h=decodeURIComponent(location.hash.slice(1)); }catch(e){} if(/^p[1-5]$/.test(h))showPage(h); else if(h.startsWith("dest=")){ const n=h.slice(5); if(PANEL[n]||PENDING[n]){ selectDest(n); showPage("p2"); } } };
  go(); addEventListener("hashchange",go);
})();
