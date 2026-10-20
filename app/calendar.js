// Season calendar for the new view: when people look each place up (not when they visit). Same data and closure months as the classic Early warning tab.
(function(){
const $=s=>document.querySelector(s), SEASON=APPDATA.seasonData, PENDING=APPDATA.pendingData;
const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], NOW=new Date().getMonth();
const CLOSED_MONTHS=[10,11,0,1]; // reported resort closures, Nov to Feb
const order=["Perhentian","Redang","Lang Tengah","Kapas","Tioman","Sibu","Tinggi","Langkawi","Pangkor","Cameron Highlands","Fraser's Hill","Sipadan / Mabul","Tunku Abdul Rahman Park","Kinabalu / Kundasang"];
const names=order.filter(n=>SEASON[n]).concat(Object.keys(SEASON).filter(n=>!order.includes(n)&&(PANEL[n]||PENDING[n])));
const shut=(n,i)=>EAST_CLOSED.includes(n)&&CLOSED_MONTHS.includes(i);
const sel=$("#calSel"), plot=$("#calPlot"), grid=$("#calGrid");
let cur=null;

names.forEach(n=>{ const o=document.createElement("option"); o.value=n; o.textContent=n; sel.appendChild(o); });

// ---- heat grid ----
function buildGrid(){
  let h=`<thead><tr><th scope="col">Destination</th>${M.map((m,i)=>`<th scope="col" class="${i===NOW?"now":""}">${m}</th>`).join("")}</tr></thead><tbody>`;
  names.forEach((n,r)=>{
    const s=SEASON[n], p=PANEL[n], bd=p?bandFor(p.score[p.score.length-1]):null;
    h+=`<tr data-n="${esc(n)}" class="${s.reliable?"":"low"}"><th scope="row" class="nm"><button type="button" class="calBtn" aria-pressed="false"><span>${esc(n)}</span></button>${bd?`<i class="mini g-${bd}" title="Score ${p.score[p.score.length-1]}, ${LBL[bd]}"></i>`:""}${s.reliable?"":`<small>low volume</small>`}${s.measures==="visits"?`<small>climber counts</small>`:""}</th>`
      +s.month_share.map((v,i)=>{
        const t=Math.max(0,Math.min(1,(v-.06)/.07)), lab=`${n}, ${M[i]}: ${(v*100).toFixed(1)}% of the year's interest${shut(n,i)?", typical resort closure":""}`, d=((r+i)*22)+"ms";
        return shut(n,i)?`<td class="c hatch ${i===NOW?"now":""}" style="--d:${d}" title="${lab}" aria-label="${lab}">×</td>`
          :`<td class="c ${i===NOW?"now":""}" style="--d:${d};--t:${Math.round((.10+.6*t)*100)}%" title="${lab}" aria-label="${lab}">${Math.round(v*100)}</td>`;
      }).join("")+`</tr>`;
  });
  grid.innerHTML=h+"</tbody>";
}

// ---- bar chart (plain divs so heights can ease between destinations) ----
function buildPlot(){
  plot.innerHTML=`<div class="even" id="calEven"><span>even year 8.3%</span></div>`+M.map(m=>`<div class="b"><span class="v num"></span><i></i></div>`).join("");
  const mons=$("#calMons"); mons.innerHTML=M.map((m,i)=>`<span class="${i===NOW?"now":""}">${m}</span>`).join("");
}
function pick(n,focus){
  if(!SEASON[n])return; cur=n; sel.value=n;
  const s=SEASON[n], vals=s.month_share.map(v=>+(v*100).toFixed(1)), peak=vals.indexOf(Math.max(...vals)), top=Math.max(Math.max(...vals),8.3)*1.18;
  plot.querySelectorAll(".b").forEach((b,i)=>{
    const hp=vals[i]/top*100, bar=b.querySelector("i"), v=b.querySelector(".v");
    bar.style.height=hp+"%"; v.style.bottom="calc("+hp+"% + 3px)"; v.textContent=vals[i].toFixed(1);
    bar.className=shut(n,i)?"off":i===peak?"peak":""; b.title=`${M[i]}: ${vals[i]}% of the year's interest`+(shut(n,i)?", typical resort closure":"");
  });
  $("#calEven").style.bottom=(8.3/top*100)+"%";
  grid.querySelectorAll("tr[data-n]").forEach(r=>{ const on=r.dataset.n===n; r.classList.toggle("sel",on); r.querySelector(".calBtn").setAttribute("aria-pressed",String(on)); });
  const p=PANEL[n], bd=p?bandFor(p.score[p.score.length-1]):null;
  $("#calName").textContent=n; const meta=$("#calMeta"); meta.className=bd?"pill g-"+bd:""; meta.textContent=bd?`Score ${p.score[p.score.length-1]} · ${LBL[bd]}`:(PENDING[n]?"tracked, not scored":"");
  const open=$("#calOpen"); open.hidden=!p; open.onclick=()=>AMBANG_NEW.open(n);
  const nowV=vals[NOW], rel=nowV>8.3*1.1?"above":nowV<8.3*.9?"below":"close to";
  $("#calSum").innerHTML=`Peak month <b>${M[peak]}</b> (${vals[peak]}%). This month (${M[NOW]}) is <b>${nowV}%</b>, ${rel} an even year.`;
  $("#calChartNote").textContent="Dashed line = an even year (8.3%). "+(s.ms_share!=null?`Malay-language pages are ${Math.round(s.ms_share*100)}% of the views, so this is not an English-only picture. `:"")
    +(s.term_share?`Share of searches by term: ${Object.entries(s.term_share).map(([t,v])=>`${t} ${Math.round(v*100)}%`).join(", ")}. `:"")
    +(EAST_CLOSED.includes(n)?"Hatched bars are the typical resort-closure months (Nov to Feb). ":"")
    +(s.reliable?"":"Too little volume to read a season from: do not rely on this. ")
    +`Source: ${s.source||"Google Trends searches in Malaysia"}.`;
  plot.setAttribute("role","img"); plot.setAttribute("aria-label",`${n}: monthly share of the year's interest. Peak ${M[peak]} at ${vals[peak]} percent.`);
  if(focus)document.getElementById("calCard").scrollIntoView({behavior:"smooth",block:"nearest"});
}

buildGrid(); buildPlot();
sel.addEventListener("change",e=>pick(e.target.value));
grid.addEventListener("click",e=>{ const r=e.target.closest("tr[data-n]"); if(r)pick(r.dataset.n,true); });
$("#calNote").innerHTML=`Cells show each month's share of the year's interest in percent (an even year is 8.3). Interest is when people look a place up (Wikipedia pageviews in English and Malay, 2016 to 2025 without the COVID years 2020 and 2021), not when they visit; Kinabalu uses real monthly climber counts from Sabah Parks. Flat rows mean interest barely changes across the year. Hatched months mark the typical northeast monsoon closure of resorts on the Terengganu and Pahang islands, October or November to February, reopening in March (<a href="https://www.tin.media/news/details/terengganu-islands-quiets-down-as-monsoon-season-sets-in" target="_blank" rel="noopener">Terengganu tourism department, as reported</a>); it varies by resort.`;
window.AMBANG_CAL={pick};
pick(names.includes("Perhentian")?"Perhentian":names[0]);
})();
