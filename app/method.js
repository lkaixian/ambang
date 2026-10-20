(function(){
"use strict";
const root=document.getElementById("mtRoot"); if(!root)return;
const reduce=()=>matchMedia("(prefers-reduced-motion:reduce)").matches;
const NAMES={visitor:"Marine park visitors",accom:"Accommodation density",hotel:"Hotel guest arrivals",income:"Cost-of-living pressure",season:"Seasonality",occ:"Occupancy"};
const scheme=()=>(window.AMBANG_NEW&&AMBANG_NEW.scheme&&AMBANG_NEW.scheme())||"ewm";
const SCH=s=>s==="ewm"?"Trained (EWM)":"Equal weight";
const LIM=[["Per-island pressure is apportioned","Visitor pressure is published at state level. Island figures are scaled from each state's total, so read them as relative ordering, not independent measurements."],["Visitor counts stop at 2017","The scored islands use the Department of Marine Park Malaysia series, which ends in 2017 on the open portal. The score describes relative pressure, not today."],["Most capacity is state-level","Waste, water and resident base are the same for every island in a state. Only live coral cover is measured per island."],["Resident base is weak","Population is closer to a pressure measure than a capacity one. It stays for now because it is real and comparable; the research report suggests dropping or moving it."],["Cameron Highlands borrows a marine weight","Its visitor weight was trained on marine park counts, but its own input is a partial district measure, so compare its score with the islands only with care."],["Weights are partly trained on illustration","The entropy weights use a mix of real and illustrative values, so they will shift as more indicators become real."],["A band is a prompt, not a verdict","Alert means a place warrants investigation, not that an ecological determination was made. Official statistics lag, so the newest score describes the latest observable year."],["Provisional scores are different","They compare visitors with a daily limit, not the six-indicator score, and the limits disagree between sources. Never compare them with the scored islands."],["Interest is not visits","The Seasonality calendar shows when people look places up. Most curves are nearly flat, so it says little about a visiting season."],["Language changes the answer","Malaysians search in Malay (\"Pulau Redang\"); English terms mostly show foreign travellers, and the two differ a lot in size and season. We sum English and Malay Wikipedia views and ask for Malay and English Google Trends terms in one chart. An English-only curve would understate local interest."]];
const DTL=[["Why a geometric mean","So one binding constraint, such as no sewage treatment on a small island, cannot be offset by abundance elsewhere. Each destination names its lowest capacity indicator as its binding constraint, the same bottleneck logic (Liebig's law of the minimum) used by tourism carrying-capacity frameworks such as UNWTO/UNEP PAP-RAC and Cifuentes."],["Why entropy weights, and not a supervised model or expert panel","The score is derived from these same indicators, so there is no independent target to train a model against; fitting one would only fit noise back onto itself. AHP or Delphi expert weighting needs external panels and several consensus rounds, which do not fit a hackathon timeline. Published Malaysian AHP weights exist for Perhentian and Tioman (Nasir, 2022) and are used as the reference in the capacity research report."],["Why capacity weights are equal","Most capacity indicators are state-level, so every island in a state shares the same value. Entropy weighting would give those near-zero weight and reward only coral cover, which is the wrong way round for a weakest-link design. The research report proposes domain weights (ecological 0.35, infrastructure 0.45, resident 0.20) as the next step; they are our assumptions and are not applied yet."],["Normalisation","Bounds are computed across the pooled destination-year panel and stored, so new years are scored against fixed history instead of rescaling the past."]];
const BAND_ROW={green:["Comfortable headroom","Promote; absorb demand redirected from stressed sites"],amber:["Threshold Vicinity","Monitor monthly; prepare staged permit release"],red:["Load exceeds capacity","Apply quota or pricing; prioritise infrastructure"],crit:["Sustained exceedance","Consider closure, moratorium, ecological assessment"]};
const dtl=a=>a.map(([s,p])=>`<details class="mtDtl"><summary>${esc(s)}</summary><p>${esc(p)}</p></details>`).join("");
const names=Object.keys(PANEL).sort();
const def=names.includes("Perhentian")?"Perhentian":names[0];
const keys=Object.keys(WEIGHT_SCHEMES.ewm).sort((a,b)=>WEIGHT_SCHEMES.ewm[b]-WEIGHT_SCHEMES.ewm[a]);

root.innerHTML=`
<p class="mtSub">One ratio of pressure to capacity, built from open Malaysian data. Every indicator is labelled real or illustrative here and on each destination page.</p>
<p class="mtSdg"><span class="pill">SDG 14 Life Below Water</span><span class="pill">SDG 12 Responsible Consumption and Production</span><span class="pill">SDG 8 Decent Work and Economic Growth (extension)</span></p>
<div class="mtTabs" role="tablist" aria-label="Method views">
 <button type="button" role="tab" id="mtT1" aria-selected="true" aria-controls="mtP1" data-mt="mtP1">The score</button>
 <button type="button" role="tab" id="mtT2" aria-selected="false" aria-controls="mtP2" data-mt="mtP2" tabindex="-1">Limits</button>
</div>
<div class="mtPanels">
<div id="mtP1" class="mtPanel on" role="tabpanel" aria-labelledby="mtT1">
 <div class="card mtCard"><h3>The index</h3>
  <div class="mtEq">AMBANG = 100 &times; P / (P + C)</div>
  <div class="mtGrid">
   <div class="mtMini"><b>P &middot; Pressure</b><p>Weighted geometric mean of six indicators, each scaled 0 to 1: visitors, accommodation, hotel arrivals, cost of living, seasonality and occupancy.</p></div>
   <div class="mtMini"><b>C &middot; Capacity</b><p>Geometric mean of the capacity indicators, equal-weighted today: waste handling, water headroom, resident base and live coral cover (river water quality for Cameron Highlands).</p></div>
   <div class="mtMini"><b>50 &middot; Threshold</b><p>At 50, pressure equals what the place can absorb. Above it, the load exceeds capacity.</p></div>
  </div>
  <div class="mtEx"><div class="mtExHd"><label for="mtSel">Worked example</label><select id="mtSel">${names.map(n=>`<option${n===def?" selected":""}>${esc(n)}</option>`).join("")}</select><span class="mtSch" id="mtSch"></span></div>
   <div class="mtExRow"><div><small>P &middot; Pressure</small><span class="num" id="mtP">-</span></div><div><small>C &middot; Capacity</small><span class="num" id="mtC">-</span></div><div class="mtScore" id="mtScBox"><small>100 &times; P / (P + C)</small><span class="num" id="mtS">-</span></div></div>
  </div>
  <div class="mtWrap"><table class="mtTbl"><thead><tr><th>Band</th><th>Range</th><th>What it means</th><th>Indicated response</th></tr></thead><tbody>
   ${BANDS.map(b=>`<tr><td><span class="mtBand g-${b.k}">${LBL[b.k]}</span></td><td class="num">${bandRng(b)}</td><td>${BAND_ROW[b.k][0]}</td><td>${BAND_ROW[b.k][1]}</td></tr>`).join("")}
  </tbody></table></div>
 </div>
 <div class="card mtCard"><h3>Pressure weights</h3>
  <p class="mtNote">Entropy Weight Method: an indicator that varies more across destinations carries more discriminating information and earns more weight. Higher weight means more discriminating, not more important in a policy sense.</p>
  <div class="mtLeg"><span><i class="mtK1"></i>Trained (EWM)</span><span><i class="mtK2"></i>Equal weight</span><span class="mtCur" id="mtCur"></span></div>
  <div id="mtW">${keys.map(k=>`<div class="mtRow" data-k="${k}"><span>${esc(NAMES[k])}</span><span class="mtBars"><span class="mtTr"><i class="mtB1"></i></span><span class="mtTr"><i class="mtB2"></i></span></span><span class="num mtV"></span></div>`).join("")}</div>
  <p class="mtNote">Caveat: trained on a mix of real and illustrative values, so treat the weights as a working pipeline, not a finding.</p>
  <details class="mtDtl"><summary>How the weights were trained</summary><p><code>python scripts/train_weights.py</code>, n = ${names.length} destinations &times; ${INDICATOR_KEYS.length} indicators. Re-run on 2026-09-22 after marine park visitors became real data for the 14 marine islands: its weight rose from 22.9% to ${(WEIGHT_SCHEMES.ewm.visitor*100).toFixed(1)}%, because the real spread between islands (Kedah's near 0.03, Terengganu's near 0.95) is far wider than the old placeholders. A hand-set 3/2/1 priority scheme was used before there were enough destinations to train on.</p></details>
 </div>
 <div class="card mtCard"><h3>Design choices</h3>${dtl(DTL)}</div>
</div>
<div id="mtP2" class="mtPanel" role="tabpanel" aria-labelledby="mtT2" hidden>
 <div class="mtGrid mtLim">${LIM.map(([b,p])=>`<div class="mtMini"><b>${esc(b)}</b><p>${esc(p)}</p></div>`).join("")}</div>
</div>
</div>`;

/* tabs: panel unhidden first, then .on added two frames later so the transition runs */
const tabs=[...root.querySelectorAll(".mtTabs button")];
function show(id){
  tabs.forEach(b=>{const on=b.dataset.mt===id;b.setAttribute("aria-selected",on);b.tabIndex=on?0:-1;});
  root.querySelectorAll(".mtPanel").forEach(p=>{
    if(p.id===id){p.hidden=false;requestAnimationFrame(()=>requestAnimationFrame(()=>p.classList.add("on")));}
    else{p.classList.remove("on");p.hidden=true;}
  });
}
root.querySelector(".mtTabs").addEventListener("click",e=>{const b=e.target.closest("button");if(b)show(b.dataset.mt);});
root.querySelector(".mtTabs").addEventListener("keydown",e=>{
  const i=tabs.findIndex(b=>b.getAttribute("aria-selected")==="true"),k=e.key,j=k==="ArrowRight"?i+1:k==="ArrowLeft"?i-1:k==="Home"?0:k==="End"?tabs.length-1:null; if(j===null)return;
  const n=tabs[(j+tabs.length)%tabs.length];
  show(n.dataset.mt);n.focus();e.preventDefault();
});

/* weight bars: both schemes drawn; CSS width/opacity transitions do the easing */
function bars(){
  const s=scheme(),mx=WEIGHT_SCHEMES.ewm[keys[0]];
  root.querySelectorAll(".mtRow").forEach(r=>{
    const k=r.dataset.k,e=WEIGHT_SCHEMES.ewm[k],q=WEIGHT_SCHEMES.equal[k];
    r.querySelector(".mtB1").style.width=(e/mx*100).toFixed(1)+"%";
    r.querySelector(".mtB2").style.width=(q/mx*100).toFixed(1)+"%";
    r.classList.toggle("act1",s==="ewm");r.classList.toggle("act2",s!=="ewm");
    r.querySelector(".mtV").textContent=((s==="ewm"?e:q)*100).toFixed(1)+"%";
  });
  root.querySelector("#mtCur").textContent="Active: "+SCH(s);
}
let seen=false;  // bars start at width 0 and grow when scrolled into view
const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)&&!seen){seen=true;bars();io.disconnect();}},{threshold:.2});
io.observe(root.querySelector("#mtW"));

/* worked example with number tween */
const cur={P:0,C:0,S:0},el={P:root.querySelector("#mtP"),C:root.querySelector("#mtC"),S:root.querySelector("#mtS")};
let raf=0;
function paint(){
  el.P.textContent=cur.P.toFixed(3);el.C.textContent=cur.C.toFixed(3);el.S.textContent=Math.round(cur.S);
  root.querySelector("#mtScBox").className="mtScore g-"+bandFor(Math.round(cur.S));
}
function example(){
  const d=PANEL[root.querySelector("#mtSel").value],s=scheme(),w=WEIGHT_SCHEMES[s];
  const P=wgm(d.pbar.map((it,i)=>({v:it.v,w:w[INDICATOR_KEYS[i]]}))),C=scoreWith(d).C,S=100*P/(P+C);
  root.querySelector("#mtSch").textContent=SCH(s)+" weights";
  const from={...cur},to={P,C,S},t0=performance.now();cancelAnimationFrame(raf);
  if(reduce()){Object.assign(cur,to);return paint();}
  (function f(t){const k=Math.min(1,Math.max(0,(t-t0)/450)),e=1-Math.pow(1-k,3);
    for(const x in to)cur[x]=from[x]+(to[x]-from[x])*e;paint();if(k<1)raf=requestAnimationFrame(f);})(t0);
}
root.querySelector("#mtSel").addEventListener("change",example);
document.addEventListener("ambang:scheme",()=>{seen=true;bars();example();});
example();
})();
