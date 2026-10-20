// "Tracked, not scored yet": provisional cards, then the other parks as name-only buttons with state filters. Details always open in a side window.
(function(){
"use strict";
const root=document.getElementById("provRoot"), P=(window.APPDATA||{}).pendingData;
if(!root||!P)return;
const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
const all=Object.entries(P), prov=all.filter(([,d])=>d.prov), none=all.filter(([,d])=>!d.prov);
const bandOf=pv=>"g-"+(pv.band==="critical"?"crit":pv.band);
const real=d=>(d.real||[]).map(r=>`<li><span>${esc(r.n)}</span><b class="num">${esc(r.v)}</b><i>${esc(r.yr)}</i></li>`).join("");
const rg=r=>{const a=r.score_low!=null?r.score_low:r.score,b=r.score_alt;return a===b||b==null?`${a}`:`${Math.min(a,b)} to ${Math.max(a,b)}`;};

// ---- the side window (one dialog, reused) ----
const dlg=document.createElement("dialog"); dlg.className="dr pvDr"; dlg.setAttribute("aria-labelledby","pvT");
dlg.innerHTML='<div class="drTop"><span class="eyebrow" id="pvEy"></span><button type="button" class="x" aria-label="Close">×</button></div><div class="drBody" id="pvBody"></div>';
document.body.appendChild(dlg);
const body=dlg.querySelector("#pvBody"), ey=dlg.querySelector("#pvEy");
function close(){ if(!dlg.open)return; if(reduce)return dlg.close(); dlgClose(dlg); }
dlg.querySelector(".x").onclick=close;
dlg.addEventListener("click",e=>{ if(e.target===dlg)close(); });
dlg.addEventListener("cancel",e=>{ e.preventDefault(); close(); });
function show(eyebrow,html){ ey.textContent=eyebrow; body.innerHTML=html; [...body.children].forEach((c,i)=>c.style.setProperty("--k",i)); dlg.scrollTop=0; if(!dlg.open)dlg.showModal(); }
const classicLink=n=>`<div class="ctas"><a class="cta ghost" href="/classic#dest=${encodeURIComponent(n)}">Full detail in Classic</a></div>`;

// ---- provisional destination ----
function detail([n,d]){
  const pv=d.prov;
  show(`${d.state} · provisional`,`<h2 id="pvT">${esc(n)}</h2>
    <div class="pvHero ${bandOf(pv)}"><span class="pvTag">Provisional</span><span class="pvScore"><b class="num">${esc(pv.score)}</b><span>range ${esc(pv.lo)} to ${esc(pv.hi)}</span></span><span class="pvMeta">${esc(d.state)} · ${esc((d.kind||"").toLowerCase())}</span></div>
    <div class="pvWarn" role="note"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></svg><div><b>Not comparable with the scored islands</b><p>Provisional score only. It compares real visitor numbers with an official daily limit, which is a different and simpler measure than the six-indicator AMBANG score, so do not compare it with the scored islands.</p></div></div>
    <p class="pvNote">${esc(pv.basis)} Score = 100 × U / (U + 1), where U is average daily visitors divided by the daily limit.</p>
    ${pv.rows&&pv.rows.length?`<h3>By period</h3><div class="pvScroll"><table class="pvTbl"><thead><tr><th>Period</th><th>Per day</th><th>Score</th><th>Range</th></tr></thead><tbody>${pv.rows.map(r=>`<tr><td>${esc(r.label)}</td><td class="num">${esc(r.per_day)}</td><td class="num">${esc(r.score)}</td><td class="num">${esc(rg(r))}</td></tr>`).join("")}</tbody></table></div>`:""}
    <h3>Real indicators</h3><ul class="pvReal">${real(d)}</ul>
    <h3>Daily limits found (they disagree and have changed)</h3><ul class="pvCaps">${(pv.caps||[]).map(c=>`<li>${esc(c.label)}. <a class="lnk" href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener">${esc(c.src)}</a></li>`).join("")}</ul>
    <p class="pvNote"><b>Caveats:</b> ${esc((pv.caveats||[]).join(" "))}</p>${classicLink(n)}`);
}

// ---- a park with no score ----
function parkDetail([n,d]){
  show(`${d.state} · no score`,`<h2 id="pvT">${esc(n)}</h2>
    <p class="pvMetaLine">${esc(d.state)} · ${esc((d.kind||"").toLowerCase())}</p>
    <div class="pvNone" role="note"><b>No AMBANG score, and no provisional one either</b><p>Tracked with the real figures we have. Filling the gaps with made-up values would give a number that looks comparable to the scored islands but isn't.</p></div>
    <h3>Real indicators</h3>${(d.real||[]).length?`<ul class="pvReal">${real(d)}</ul>`:`<p class="pvNote">No real figures found for this place yet.</p>`}${classicLink(n)}`);
}

// ---- the section: provisional cards, then the other parks as name-only buttons ----
const states=[...new Set(none.map(([,d])=>d.state))].sort(), count=s=>none.filter(([,d])=>d.state===s).length;
const card=([n,d],i)=>{ const pv=d.prov;
  return `<button type="button" class="pvCard ${bandOf(pv)}" style="--i:${i}" data-n="${esc(n)}" aria-haspopup="dialog">
    <span class="pvTop"><span class="pvTag">Provisional</span><span class="pvSt">${esc(d.state)} · ${esc((d.kind||"").toLowerCase())}</span></span>
    <span class="pvName">${esc(n)}</span>
    <span class="pvRow"><span class="pvScore"><b class="num">${esc(pv.score)}</b><span>range ${esc(pv.lo)} to ${esc(pv.hi)}</span></span><span class="pvGo">Details <i aria-hidden="true">→</i></span></span></button>`; };
root.innerHTML=`<div class="pvLede">${nfo("pvMore","These places are on the map with the real data we have, but no AMBANG score.","Filling the missing indicators with made-up values would give a number that looks comparable to the scored islands but isn't.")}</div>
  ${prov.length?`<div class="pvGrid">${prov.map(card).join("")}</div>`:""}
  ${none.length?`<div class="pvParks"><div class="pvParksHead"><h3>${none.length} more parks tracked, no score yet</h3>
    <div class="pvFil" role="group" aria-label="Filter by state"><button type="button" class="chip" aria-pressed="true" data-f="">All (${none.length})</button>${states.map(s=>`<button type="button" class="chip" aria-pressed="false" data-f="${esc(s)}">${esc(s)} (${count(s)})</button>`).join("")}</div></div>
    <ul class="pvNames">${none.map(([n,d])=>`<li data-st="${esc(d.state)}"><button type="button" class="pvName2" data-p="${esc(n)}" aria-haspopup="dialog" title="${esc(d.state)}">${esc(n)}</button></li>`).join("")}</ul></div>`:""}`;
root.addEventListener("click",e=>{
  const c=e.target.closest(".pvCard"); if(c){ const en=all.find(([n])=>n===c.dataset.n); if(en)detail(en); return; }
  const p=e.target.closest("[data-p]"); if(p){ const en=all.find(([n])=>n===p.dataset.p); if(en)parkDetail(en); return; }
  const f=e.target.closest("[data-f]"); if(f){
    root.querySelectorAll("[data-f]").forEach(b=>b.setAttribute("aria-pressed",String(b===f)));
    let k=0; root.querySelectorAll(".pvNames li").forEach(li=>{ const hide=!!f.dataset.f&&li.dataset.st!==f.dataset.f; li.hidden=hide; if(!hide)li.style.setProperty("--i",k++); }); // visible ones fade in again, one after another
  }
});
root.querySelectorAll(".pvNames li").forEach((li,i)=>li.style.setProperty("--i",i));
})();
