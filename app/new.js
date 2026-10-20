// AMBANG new view. Scores, bands and weights come from core.js (shared with the classic view); this file only draws.
(function(){
const $=s=>document.querySelector(s), root=document.documentElement, SVGNS="http://www.w3.org/2000/svg";
const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
const svgEl=(tag,a={},p)=>{const e=document.createElementNS(SVGNS,tag);for(const k in a)e.setAttribute(k,a[k]);p&&p.appendChild(e);return e};
const GEO=APPDATA.geoData, PENDING=APPDATA.pendingData;
const LAST=YR.length-1, I18=YR.indexOf(2018), BK=BANDS.map(b=>b.k), bi=b=>BK.indexOf(b);
const names=Object.keys(PANEL), now=n=>PANEL[n].score[LAST], stateOf=n=>GEO.pins[n].state;
const unscored=Object.entries(PENDING).filter(([,p])=>p.prov).map(([n])=>n); // same "+N tracked, not scored yet" as the classic view (provisional ones; the other parks stay hidden)
let scheme="ewm", filterState=null, openName=null;

// ---- small helpers ----
function tween(el,to,dec=0,suf=""){
  const from=el._v??0; el._v=to; cancelAnimationFrame(el._r);
  const fmt=v=>(dec?v.toFixed(dec):String(Math.round(v)))+suf;
  if(reduce||from===to){el.textContent=fmt(to);return}
  const t0=performance.now(), d=700;
  (function f(t){const k=Math.min(1,(t-t0)/d), e=1-Math.pow(1-k,3);el.textContent=fmt(from+(to-from)*e);if(k<1)el._r=requestAnimationFrame(f)})(t0);
}
function ringSVG(size){
  const s=svgEl("svg",{class:"ring",viewBox:"0 0 48 48",width:size,height:size,"aria-hidden":"true"});
  svgEl("circle",{class:"bg",cx:24,cy:24,r:19},s);
  svgEl("circle",{class:"fg",cx:24,cy:24,r:19,transform:"rotate(-90 24 24)","stroke-dasharray":119.38,"stroke-dashoffset":119.38},s);
  const t=svgEl("text",{x:24,y:28.5},s); return s;
}
function setRing(s,score){ s.querySelector(".fg").style.strokeDashoffset=119.38*(1-score/100); tween(s.querySelector("text"),score); }
function spark(series,cls){
  const W=120,H=34,lo=Math.min(...series),hi=Math.max(...series),pad=(hi-lo||1)*.15;
  const X=i=>2+i*(W-4)/(series.length-1), Y=v=>H-3-(v-lo+pad)/(hi-lo+2*pad)*(H-6);
  const pts=series.map((v,i)=>X(i).toFixed(1)+","+Y(v).toFixed(1));
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" class="${cls}"><path class="spark fill" d="M${pts.join("L")}L${W-2},${H}L2,${H}Z"/><path class="spark" d="M${pts.join("L")}" vector-effect="non-scaling-stroke"/></svg>`;
}
const topDrv=n=>topDriver(PANEL[n]);

// ---- hero ----
const heroH=$("#heroH");
heroH.innerHTML=`<span class="num" id="heroN">0</span> of <span id="heroT">${names.length}</span> scored destinations are over their limit`;
const mix=$("#mix"), mixLeg=$("#mixLeg");
BK.forEach(b=>{ const i=document.createElement("i"); i.className="g-"+b; i.dataset.b=b; i.title=LBL[b]; mix.appendChild(i);
  const s=document.createElement("span"); s.className="g-"+b; s.dataset.b=b; s.innerHTML=`<b class="num">0</b> ${LBL[b]}`; mixLeg.appendChild(s); });
function renderHero(){
  const over=names.filter(n=>now(n)>50).length; tween($("#heroN"),over);
  const cnt=Object.fromEntries(BK.map(b=>[b,names.filter(n=>bandFor(now(n))===b).length]));
  BK.forEach(b=>{ mix.querySelector(`[data-b=${b}]`).style.width=(cnt[b]/names.length*100)+"%"; tween(mixLeg.querySelector(`[data-b=${b}] b`),cnt[b]); });
  mix.setAttribute("aria-label",BK.map(b=>cnt[b]+" "+LBL[b]).join(", "));
  const top=names.slice().sort((a,b)=>now(b)-now(a)).slice(0,3), box=$("#attn"); box.textContent="";
  top.forEach(n=>{ const bd=bandFor(now(n)), b=document.createElement("button"); b.type="button"; b.className="g-"+bd;
    const r=ringSVG(46); const td=topDrv(n);
    b.append(r); b.insertAdjacentHTML("beforeend",`<span class="nm"><b>${esc(n)}</b><small>${esc(stateOf(n))} · ${esc(td.n.toLowerCase())}</small></span><span class="pill">${LBL[bd]}</span>`);
    b.onclick=()=>openDrawer(n); box.appendChild(b); requestAnimationFrame(()=>requestAnimationFrame(()=>setRing(r,now(n)))); });
}

// ---- ticker ----
function renderTicker(){
  let list=names.filter(n=>now(n)>=BANDS[2].lo).sort((a,b)=>now(b)-now(a)); if(!list.length)list=names.filter(n=>now(n)>=BANDS[1].lo).sort((a,b)=>now(b)-now(a));
  const item=n=>{ const bd=bandFor(now(n)), td=topDrv(n); return `<span class="it g-${bd}"><b>${esc(n)}</b> ${now(n)} ${LBL[bd]} · largest weighted input: ${esc(td.n.toLowerCase())} (${Math.round(td.share*100)}%)</span>`; };
  const set=list.length?list.map(item).join(""):`<span class="it g-green">No destination is past Warning right now.</span>`;
  const tk=$("#tk"); tk.style.setProperty("--dur",Math.max(30,list.length*9)+"s");
  tk.innerHTML=`<div class="set">${set}</div><div class="set" aria-hidden="true">${set}</div>`;
}

// ---- kpis ----
const kpiBox=$("#kpis");
[["k1","Destinations scored",""],["k2","Over the threshold (score above 50)","g-red"],["k3",`Warning or worse (${BANDS[1].lo} and up)`,"g-amber"],["k4","Moved up a band since 2018","g-crit"]].forEach(([id,l,c])=>{
  kpiBox.insertAdjacentHTML("beforeend",`<div class="kpi ${c}" id="${id}"><div class="v num">0</div><div class="l">${l}</div><div class="s"></div></div>`); });
function renderKpis(){
  const cnt=f=>YR.map((_,i)=>names.filter(n=>f(PANEL[n].score[i])).length);
  const mean=YR.map((_,i)=>names.reduce((s,n)=>s+PANEL[n].score[i],0)/names.length);
  const moved=names.filter(n=>bi(bandFor(now(n)))>bi(bandFor(PANEL[n].score[I18])));
  const set=(id,v,html)=>{ const k=$("#"+id); tween(k.querySelector(".v"),v); k.querySelector(".s").innerHTML=html; };
  set("k1",names.length,`<div class="l" style="margin:0 0 4px">+${unscored.length} tracked, not scored yet</div>`+spark(mean,"") );
  set("k2",cnt(s=>s>50)[LAST],spark(cnt(s=>s>50),""));
  set("k3",cnt(s=>s>=BANDS[1].lo)[LAST],spark(cnt(s=>s>=BANDS[1].lo),""));
  set("k4",moved.length,`<div class="l" style="margin:0">${moved.length?esc(moved.join(", ")):"None"}</div>`);
}

// ---- map ----
const map=$("#map"), W=GEO.view.w, H=GEO.view.h;
map.setAttribute("viewBox",`0 0 ${W} ${H}`);
const proj=(lon,lat)=>[(lon-GEO.view.lon0)*GEO.view.scale,(GEO.view.lat1-lat)*GEO.view.scale];
const landEls={}, pinEls={};
const tracked=new Set(names.map(stateOf));
for(const [st,d] of Object.entries(GEO.land)){
  const p=svgEl("path",{class:"land"+(tracked.has(st)?" tr":""),d},map); landEls[st]=p;
  if(tracked.has(st)){ p.setAttribute("tabindex","0"); p.setAttribute("role","button"); p.setAttribute("aria-label",`Filter by ${st}`);
    p.onclick=()=>setState(filterState===st?null:st); p.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();p.onclick()}}; svgEl("title",{},p).textContent=st; }
}
for(const [n,p] of Object.entries(PENDING)){ if(!p.prov)continue; const [x,y]=proj(p.lon,p.lat);
  const g=svgEl("g",{class:"pin uns"},map); svgEl("circle",{class:"dot",cx:x,cy:y,r:3.6},g); svgEl("title",{},g).textContent=`${n}: tracked, not scored yet`; }
for(const n of names){ const p=GEO.pins[n], [x,y]=proj(p.lon,p.lat);
  const g=svgEl("g",{class:"pin",tabindex:"0",role:"button"},map);
  svgEl("circle",{class:"halo",cx:x,cy:y,r:7},g); svgEl("circle",{class:"dot",cx:x,cy:y,r:5},g); svgEl("title",{},g);
  g.onclick=()=>openDrawer(n); g.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDrawer(n)}};
  g.onmouseenter=()=>hot(n,true); g.onmouseleave=()=>hot(n,false); g.onfocus=()=>hot(n,true); g.onblur=()=>hot(n,false);
  pinEls[n]=g; }
// phones: show one landmass at a time (the full map is mostly empty sea there); wider screens always show everything
const EAST=new Set(["Sabah","Sarawak","Labuan"]), narrow=matchMedia("(max-width:620px)");
function bbox(east){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; const add=(x,y)=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)};
  for(const [st,d] of Object.entries(GEO.land))if(EAST.has(st)===east)d.match(/-?\d+\.?\d*,-?\d+\.?\d*/g).forEach(q=>{const [x,y]=q.split(",");add(+x,+y)});
  for(const p of [...Object.values(GEO.pins),...Object.values(PENDING).filter(p=>p.prov)])if(EAST.has(p.state)===east)add(...proj(p.lon,p.lat));
  return [x0-14,y0-14,x1-x0+28,y1-y0+28];
}
// ---- map camera: auto-zoom to a state, +/-/reset buttons, Ctrl+scroll or pinch, double-click, drag to pan ----
let area="pen";
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const ASP=()=>narrow.matches?0.95:1040/380; // the SVG keeps one shape so the page never jumps while zooming
const homeBox=()=>narrow.matches?bbox(area==="bor"):[0,0,W,H];
const fit=([x,y,w,h])=>({cx:x+w/2,cy:y+h/2,w:Math.max(w,h*ASP())});
const homeCam=()=>fit(homeBox());
function stateBox(st){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; const add=(x,y)=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)};
  if(GEO.land[st])GEO.land[st].match(/-?\d+\.?\d*,-?\d+\.?\d*/g).forEach(q=>{const [x,y]=q.split(",");add(+x,+y)});
  for(const p of [...Object.values(GEO.pins),...Object.values(PENDING).filter(p=>p.prov)])if(p.state===st)add(...proj(p.lon,p.lat));
  return [x0-22,y0-22,x1-x0+44,y1-y0+44];
}
const ctl=document.createElement("div"); ctl.className="mapCtl";
ctl.innerHTML='<button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">\u2212</button><button type="button" data-z="home" aria-label="Reset map view"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7M6 10v9h12v-9"/></svg></button>';
map.parentElement.appendChild(ctl);
let cam=homeCam(), flight=0;
const limits=()=>({min:W/14,max:homeCam().w});
function apply(c){
  const L=limits(); c={cx:clamp(c.cx,0,W),cy:clamp(c.cy,0,H),w:clamp(c.w,L.min,L.max)}; cam=c;
  const h=c.w/ASP(); map.setAttribute("viewBox",[c.cx-c.w/2,c.cy-h/2,c.w,h].map(n=>n.toFixed(2)).join(" "));
  const s=Math.pow(L.max/c.w,.55); // pins grow a little when zoomed in, not as fast as the land
  map.querySelectorAll(".pin .halo").forEach(e=>e.setAttribute("r",7/s));
  map.querySelectorAll(".pin:not(.uns) .dot").forEach(e=>e.setAttribute("r",5/s));
  map.querySelectorAll(".pin.uns .dot").forEach(e=>e.setAttribute("r",3.6/s));
  map.classList.toggle("zoomed",L.max/c.w>1.06);
  ctl.querySelector("[data-z=in]").disabled=c.w<=L.min*1.001; ctl.querySelector("[data-z=out]").disabled=c.w>=L.max*.999;
  ctl.querySelector("[data-z=home]").disabled=Math.abs(L.max/c.w-1)<.01&&Math.abs(c.cx-homeCam().cx)<2&&Math.abs(c.cy-homeCam().cy)<2;
}
function fly(to,ms=650){
  cancelAnimationFrame(flight); const L=limits(); to={cx:clamp(to.cx,0,W),cy:clamp(to.cy,0,H),w:clamp(to.w,L.min,L.max)};
  if(reduce||!ms)return apply(to);
  const f=cam, t0=performance.now(), l0=Math.log(f.w), l1=Math.log(to.w); // zoom in log space so it feels even
  (function step(t){ const k=Math.min(1,(t-t0)/ms), e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
    apply({cx:f.cx+(to.cx-f.cx)*e,cy:f.cy+(to.cy-f.cy)*e,w:Math.exp(l0+(l1-l0)*e)}); if(k<1)flight=requestAnimationFrame(step); })(t0);
}
const toMap=(x,y)=>{ const r=map.getBoundingClientRect(), h=cam.w/ASP(); return {x:cam.cx-cam.w/2+(x-r.left)/r.width*cam.w, y:cam.cy-h/2+(y-r.top)/r.height*h}; };
function zoomAt(px,py,f,animate){ // keeps the point under the cursor fixed
  const p=toMap(px,py), L=limits(), w=clamp(cam.w/f,L.min,L.max), k=w/cam.w, to={cx:p.x-(p.x-cam.cx)*k,cy:p.y-(p.y-cam.cy)*k,w};
  if(animate)fly(to,320); else{ cancelAnimationFrame(flight); apply(to); }
}
ctl.addEventListener("click",e=>{ const b=e.target.closest("button[data-z]"); if(!b)return; const z=b.dataset.z;
  if(z==="home")return fly(filterState?fit(stateBox(filterState)):homeCam());
  const r=map.getBoundingClientRect(); zoomAt(r.left+r.width/2,r.top+r.height/2,z==="in"?1.7:1/1.7,true); });
map.addEventListener("wheel",e=>{ if(!(e.ctrlKey||e.metaKey))return; e.preventDefault(); zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*(e.deltaMode?.05:.0025))); },{passive:false}); // Ctrl+scroll, and a trackpad pinch arrives the same way
map.addEventListener("dblclick",e=>{ if(e.target.closest(".pin"))return; zoomAt(e.clientX,e.clientY,2,true); });
map.addEventListener("keydown",e=>{ if(e.target!==map)return; const r=map.getBoundingClientRect(), k=e.key;
  if(k==="+"||k==="=")zoomAt(r.left+r.width/2,r.top+r.height/2,1.7,true); else if(k==="-")zoomAt(r.left+r.width/2,r.top+r.height/2,1/1.7,true); else if(k==="0")fly(homeCam());
  else if(k.startsWith("Arrow")){ e.preventDefault(); const d=cam.w*.15; fly({cx:cam.cx+(k==="ArrowRight"?d:k==="ArrowLeft"?-d:0),cy:cam.cy+(k==="ArrowDown"?d:k==="ArrowUp"?-d:0),w:cam.w},220); } });
map.setAttribute("tabindex","0"); map.setAttribute("aria-keyshortcuts","+ - 0 ArrowKeys");
// drag to pan (one pointer) and pinch to zoom (two pointers); a drag never counts as a click on a pin or state
const ptr=new Map(); let drag=null, pinch=null, dragged=false;
map.addEventListener("pointerdown",e=>{ if(e.button>0)return; ptr.set(e.pointerId,{x:e.clientX,y:e.clientY}); cancelAnimationFrame(flight);
  if(ptr.size===1){ drag={x:e.clientX,y:e.clientY,c:{...cam},go:false}; dragged=false; }
  else if(ptr.size===2){ const [p,q]=[...ptr.values()]; pinch={d:Math.hypot(p.x-q.x,p.y-q.y),w:cam.w}; drag=null; } });
map.addEventListener("pointermove",e=>{ if(!ptr.has(e.pointerId))return; ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptr.size===2){ const [p,q]=[...ptr.values()], d=Math.hypot(p.x-q.x,p.y-q.y); dragged=true; const m=toMap((p.x+q.x)/2,(p.y+q.y)/2), w=clamp(pinch.w*pinch.d/d,limits().min,limits().max), k=w/cam.w; apply({cx:m.x-(m.x-cam.cx)*k,cy:m.y-(m.y-cam.cy)*k,w}); return; }
  if(!drag)return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
  if(!drag.go){ if(Math.hypot(dx,dy)<5||!map.classList.contains("zoomed")&&e.pointerType==="touch")return; drag.go=true; dragged=true; map.setPointerCapture(e.pointerId); map.classList.add("dragging"); }
  const r=map.getBoundingClientRect(), u=drag.c.w/r.width; apply({cx:drag.c.cx-dx*u,cy:drag.c.cy-dy*u,w:drag.c.w}); });
const endPtr=e=>{ ptr.delete(e.pointerId); if(ptr.size<2)pinch=null; if(ptr.size===0){ drag=null; map.classList.remove("dragging"); setTimeout(()=>{dragged=false},0); } };
map.addEventListener("pointerup",endPtr); map.addEventListener("pointercancel",endPtr);
map.addEventListener("click",e=>{ if(dragged){ e.stopPropagation(); e.preventDefault(); } },true);
$("#mapSeg").addEventListener("click",e=>{ const b=e.target.closest("button[data-a]"); if(!b||b.dataset.a===area)return; area=b.dataset.a;
  $("#mapSeg").querySelectorAll("button").forEach(x=>{x.classList.toggle("on",x===b);x.setAttribute("aria-pressed",String(x===b))}); fly(homeCam()); });
function resetAspect(){ map.style.aspectRatio=String(ASP()); apply(filterState?fit(stateBox(filterState)):homeCam()); }
narrow.addEventListener("change",resetAspect); resetAspect();
const INFO_I='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 11v6M12 7.2v.1"/></svg>';
function nfo(id,short,more){ return `<div class="irow nfo"><div class="nfoT"><span>${short}</span><button type="button" class="info" aria-expanded="false" aria-controls="${id}" aria-label="More information">${INFO_I}</button></div><div class="more" id="${id}"><div class="mi"><p>${more}</p></div></div></div>`; }
window.nfo=nfo;
document.addEventListener("click",e=>{ const i=e.target.closest(".nfo .info"); if(!i)return; const row=i.closest(".irow"), on=!row.classList.contains("open"); row.classList.toggle("open",on); i.setAttribute("aria-expanded",String(on)); });
$("#mapNote").textContent="Land colour is the state average of scored destinations. Hollow pins are tracked, not scored yet. Drag to move, use + / − or Ctrl + scroll to zoom, double-click to zoom in; picking a state zooms to it.";
function renderMap(){
  const by={}; names.forEach(n=>(by[stateOf(n)]??=[]).push(now(n)));
  for(const [st,el] of Object.entries(landEls)){ el.setAttribute("class","land"+(tracked.has(st)?" tr":"")+(by[st]?" b-"+bandFor(Math.round(by[st].reduce((a,b)=>a+b,0)/by[st].length)):"")+(filterState&&filterState!==st&&tracked.has(st)?" dim":"")); }
  for(const n of names){ const g=pinEls[n], bd=bandFor(now(n)); g.setAttribute("class",`pin g-${bd}${bd==="crit"?" crit":""}${filterState&&filterState!==stateOf(n)?" dim":""}`);
    g.setAttribute("aria-label",`${n}, ${stateOf(n)}, score ${now(n)}, ${LBL[bd]}`); g.querySelector("title").textContent=`${n}: ${now(n)} ${LBL[bd]}`; }
}

// ---- ranked rows (built once, updated in place so bars slide and rows reorder) ----
const rowsBox=$("#rows"), rowEl={};
for(const n of names){
  const b=document.createElement("button"); b.type="button"; b.className="row";
  b.innerHTML=`<span class="rk"></span><span class="nm"><b>${esc(n)}</b><small>${esc(stateOf(n))}</small></span><span class="bar"><i></i></span><span class="sc num">0</span><span class="pill"></span>`;
  b.onclick=()=>openDrawer(n); b.onmouseenter=()=>hot(n,true); b.onmouseleave=()=>hot(n,false); b.onfocus=()=>hot(n,true); b.onblur=()=>hot(n,false);
  rowEl[n]=b; rowsBox.appendChild(b);
}
function hot(n,on){ rowEl[n].classList.toggle("hot",on); pinEls[n].classList.toggle("hot",on); }
function renderRows(){
  const vis=n=>!filterState||stateOf(n)===filterState;
  const before=new Map(names.filter(n=>!rowEl[n].classList.contains("gone")).map(n=>[n,rowEl[n].getBoundingClientRect().top]));
  const order=names.slice().sort((a,b)=>now(b)-now(a)); let rk=0;
  order.forEach(n=>{ const r=rowEl[n], bd=bandFor(now(n)); r.classList.toggle("gone",!vis(n)); rowsBox.appendChild(r);
    r.className=r.className.replace(/\bg-\w+/g,"").trim()+" g-"+bd; r.classList.toggle("gone",!vis(n));
    if(vis(n)){ r.querySelector(".rk").textContent=String(++rk).padStart(2,"0"); r.style.setProperty("--i",rk); }
    r.querySelector(".bar i").style.width=now(n)+"%"; tween(r.querySelector(".sc"),now(n)); const p=r.querySelector(".pill"); p.textContent=LBL[bd];
    r.setAttribute("aria-label",`${n}, ${stateOf(n)}, score ${now(n)}, ${LBL[bd]}`); });
  if(reduce)return;
  order.forEach(n=>{ const r=rowEl[n]; if(!before.has(n)||r.classList.contains("gone"))return; const d=before.get(n)-r.getBoundingClientRect().top; if(!d)return;
    r.style.transition="none"; r.style.transform=`translateY(${d}px)`; requestAnimationFrame(()=>requestAnimationFrame(()=>{r.style.transition="";r.style.transform=""})); });
}
// state chips
const chips=$("#chips");
function buildChips(){
  const avg=st=>{const a=names.filter(n=>stateOf(n)===st).map(now);return a.reduce((x,y)=>x+y,0)/a.length};
  chips.textContent=""; [null,...[...tracked].sort((a,b)=>avg(b)-avg(a))].forEach(st=>{
    const c=document.createElement("button"); c.type="button"; c.className="chip"; c.dataset.s=st??""; c.setAttribute("aria-pressed",String(st===filterState));
    c.textContent=st?`${st} (${names.filter(n=>stateOf(n)===st).length})`:`All (${names.length})`; c.onclick=()=>setState(st); chips.appendChild(c); });
}
function setState(st){ filterState=st; chips.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed",String((c.dataset.s||null)===st))); renderMap(); renderRows(); if(typeof fly==="function")fly(st?fit(stateBox(st)):homeCam()); }

// ---- detail drawer ----
const dr=$("#dr"), drB=$("#drB");
const seriesFor=(n,key)=>{ const d=PANEL[n], w=WEIGHT_SCHEMES[key];
  return deriveScore(buildSeries(d.baseP,wgm(d.pbar.map((it,i)=>({v:it.v,w:w[INDICATOR_KEYS[i]]})))),buildSeries(d.baseC,wgm(d.cbar))); };
function morphTrend(n,from,to){
  const svg=drB.querySelector(".trend"); if(!svg)return;
  const m=[34,84,18,26,560,220], iw=m[4]-m[0]-m[1], ih=m[5]-m[2]-m[3], both=[...seriesFor(n,"ewm"),...seriesFor(n,"equal")];
  const lo=Math.max(0,Math.floor((Math.min(...both,45)-8)/5)*5), hi=Math.min(100,Math.ceil((Math.max(...both,60)+8)/5)*5);
  const X=y=>m[0]+(y-YR[0])/(YR[LAST]-YR[0])*iw, Y=v=>m[2]+(hi-v)/(hi-lo)*ih;
  const ln=svg.querySelector(".ln"), pts=svg.querySelectorAll(".pt"), lab=svg.querySelector(".lastLab"); ln.classList.add("done");
  const draw=s=>{ ln.setAttribute("d","M"+s.map((v,i)=>X(YR[i]).toFixed(1)+","+Y(v).toFixed(1)).join("L")); pts.forEach((p,i)=>p.setAttribute("cy",Y(s[i]).toFixed(1))); lab.setAttribute("y",Y(s[LAST])-11); lab.textContent=Math.round(s[LAST]); const sl=svg.querySelector(".scnLn"); if(sl)sl.setAttribute("y1",Y(s[LAST]).toFixed(1)); };
  const fin=()=>{ draw(to); pts.forEach((p,i)=>{p.querySelector("title").textContent=YR[i]+": "+to[i]}); };
  if(reduce)return fin();
  const t0=performance.now(); cancelAnimationFrame(morphTrend.r);
  (function f(t){ const k=Math.min(1,(t-t0)/800), e=1-Math.pow(1-k,3); draw(from.map((a,i)=>a+(to[i]-a)*e)); if(k<1)morphTrend.r=requestAnimationFrame(f); else fin(); })(t0);
}
function trendSVG(n,bd){
  const s=PANEL[n].score, both=[...seriesFor(n,"ewm"),...seriesFor(n,"equal")], ml=34,mr=84,mt=18,mb=26,w=560,h=220,iw=w-ml-mr,ih=h-mt-mb;
  const lo=Math.max(0,Math.floor((Math.min(...both,45)-8)/5)*5), hi=Math.min(100,Math.ceil((Math.max(...both,60)+8)/5)*5);
  const X=y=>ml+(y-YR[0])/(YR[LAST]-YR[0])*iw, Y=v=>mt+(hi-v)/(hi-lo)*ih;
  const zones=BANDS.map(({lo:a,hi:b,c})=>{const y0=Math.max(a,lo),y1=Math.min(b,hi);return y1>y0?`<rect class="z" x="${ml}" y="${Y(y1).toFixed(1)}" width="${iw}" height="${(Y(y0)-Y(y1)).toFixed(1)}" fill="var(${c})" fill-opacity=".14"/>`:""}).join("");
  const ticks=[25,50,75].filter(v=>v>lo&&v<hi).map(v=>`<text x="${ml-6}" y="${Y(v)+4}" text-anchor="end">${v}</text>`).join("");
  const xs=YR.map(y=>`<text x="${X(y).toFixed(1)}" y="${h-8}" text-anchor="middle">${y}</text>`).join("");
  const d="M"+s.map((v,i)=>X(YR[i]).toFixed(1)+","+Y(v).toFixed(1)).join("L");
  const dots=s.map((v,i)=>`<circle class="pt" cx="${X(YR[i]).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i===LAST?5:3}"><title>${YR[i]}: ${v}</title></circle>`).join("");
  return `<svg class="trend g-${bd}" data-lo="${lo}" data-hi="${hi}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Score history ${YR[0]} to ${YR[LAST]}: ${s[0]} to ${s[LAST]}">${zones}${ticks}<line class="th" x1="${ml}" x2="${w-mr}" y1="${Y(50)}" y2="${Y(50)}"/><text x="${w-mr}" y="${Y(50)-5}" text-anchor="end">threshold 50</text>${xs}<path class="ln" d="${d}"/>${dots}<g class="scnG g-${bd}" style="opacity:0"><line class="scnLn" x1="${X(YR[LAST]).toFixed(1)}" y1="${Y(s[LAST]).toFixed(1)}" x2="${X(YR[LAST]).toFixed(1)}" y2="${Y(s[LAST]).toFixed(1)}"/><circle class="scnPt" cx="${(w-34).toFixed(1)}" cy="${Y(s[LAST]).toFixed(1)}" r="5"/><text class="scnLab" x="${(w-34).toFixed(1)}" y="${(Y(s[LAST])-11).toFixed(1)}" text-anchor="middle"></text><text class="scnTag" x="${(w-34).toFixed(1)}" y="${h-8}" text-anchor="middle">what-if</text></g><text x="${X(YR[LAST])}" y="${Y(s[LAST])-11}" text-anchor="end" class="lastLab" style="fill:var(--ink);font-weight:500">${s[LAST]}</text></svg>`;
}
let iid=0;
function indRows(items,showW){
  return items.map(it=>{ const id="ind"+(++iid), val=it.v.toFixed(2), w=Math.round(it.w*100);
    return `<div class="irow"><div class="im"><span class="nm">${esc(it.n)}</span><span class="tag${it.real?" real":""}">${it.real?"Real data":"Placeholder"}</span><span class="t"><i data-w="${Math.round(it.v*100)}"></i></span><span class="w num"${showW?` data-wv="${w}"`:""}>${showW?w+"%":Math.round(it.v*100)}</span><button type="button" class="info" aria-expanded="false" aria-controls="${id}" aria-label="Details for ${esc(it.n)}"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 11v6M12 7.2v.1"/></svg></button></div>
    <div class="more" id="${id}"><div class="mi"><dl class="dd"><div><dt>Source</dt><dd>${it.src?esc(it.src):"No source recorded: this is a placeholder value."}</dd></div><div><dt>Status</dt><dd>${it.real?"Real data fetched from an open source":"Illustrative placeholder, not measured"}</dd></div><div><dt>Value</dt><dd class="num">${val} on a 0 to 1 scale</dd></div><div><dt>${showW?"Weight":"Counts"}</dt><dd>${showW?`<span class="num wdd">${w}%</span> of the pressure score under the current weights`:"equally with the other capacity indicators"}</dd></div></dl></div></div></div>`; }).join("");
}
const wi={vis:0,cap:{}};
function wiHTML(d){
  const caps=d.cbar.map((it,i)=>`<div class="lever"><label for="wiC${i}"><span>${esc(it.n)} <small>now ${it.v.toFixed(2)}</small></span><b class="num" id="wiC${i}V">+0.00</b></label><input type="range" id="wiC${i}" data-cn="${i}" min="0" max="0.5" step="0.05" value="0"></div>`).join("");
  return `<div class="wi">
    <div class="wiRes"><div class="wiBox" id="wiNowBox"><small>Now</small><span><b class="num" id="wiNow">0</b><span class="pill"></span></span></div><span class="arr" aria-hidden="true">→</span><div class="wiBox" id="wiAftBox"><small>With your changes</small><span><b class="num" id="wiAft">0</b><span class="pill"></span><i class="num" id="wiDelta"></i></span></div></div>
    <div class="wiBar" aria-hidden="true"><i class="mk now" id="wiMkNow"></i><i class="mk aft" id="wiMkAft"></i></div>
    <fieldset class="lvr"><legend>Pressure</legend><div class="lever"><label for="wiVis"><span>Visitors <small>no hard cap, up to +200%</small></span><b class="num" id="wiVisV">0%</b></label><input type="range" id="wiVis" min="-60" max="200" step="5" value="0"></div></fieldset>
    <fieldset class="lvr"><legend>Capacity</legend>${caps}</fieldset>
    <div class="wiFoot"><span id="wiPC" class="num"></span><button type="button" class="lnk" id="wiReset">Reset</button></div></div>`;
}
function wiRender(){
  if(!openName||!$("#wiAft"))return;
  const d=PANEL[openName], a=scoreWith(d), b=scoreWith(d,{vis:wi.vis,cap:wi.cap}), b0=bandFor(a.s), b1=bandFor(b.s), dl=b.s-a.s;
  $("#wiNowBox").className="wiBox g-"+b0; $("#wiAftBox").className="wiBox g-"+b1;
  $("#wiNowBox .pill").textContent=LBL[b0]; $("#wiAftBox .pill").textContent=LBL[b1];
  tween($("#wiNow"),a.s); tween($("#wiAft"),b.s);
  const de=$("#wiDelta"); de.textContent=dl?(dl>0?"+":"")+dl:"no change"; de.className="num "+(dl>0?"up":dl<0?"down":"");
  trendScenario(b.s,b1,dl!==0); $("#wiMkNow").style.left=a.s+"%"; $("#wiMkAft").style.left=b.s+"%";
  $("#wiVisV").textContent=(wi.vis>0?"+":"")+Math.round(wi.vis*100)+"%";
  d.cbar.forEach((it,i)=>{ $("#wiC"+i+"V").textContent="+"+(wi.cap[it.n]||0).toFixed(2); });
  $("#wiPC").textContent="Pressure P "+a.P.toFixed(2)+" → "+b.P.toFixed(2)+" · capacity C "+a.C.toFixed(2)+" → "+b.C.toFixed(2);
}
function trendScenario(score,bd,changed){
  const svg=drB.querySelector(".trend"); if(!svg)return; const g=svg.querySelector(".scnG"), lo=+svg.dataset.lo, hi=+svg.dataset.hi;
  const Y=v=>18+(hi-Math.max(lo,Math.min(hi,v)))/(hi-lo)*176, ln=g.querySelector(".scnLn"), pt=g.querySelector(".scnPt"), lab=g.querySelector(".scnLab");
  g.setAttribute("class","scnG g-"+bd); g.style.opacity=changed?1:0; lab.textContent=score;
  const from=g._y??+pt.getAttribute("cy"), to=Y(score), x2=+pt.getAttribute("cx"); g._y=to;
  const set=y=>{ ln.setAttribute("x2",x2); ln.setAttribute("y2",y.toFixed(1)); pt.setAttribute("cy",y.toFixed(1)); lab.setAttribute("y",(y+(y<40?20:-11)).toFixed(1)); };
  cancelAnimationFrame(g._r); if(reduce)return set(to);
  const t0=performance.now(); (function f(t){ const k=Math.min(1,(t-t0)/420), e=1-Math.pow(1-k,3); set(from+(to-from)*e); if(k<1)g._r=requestAnimationFrame(f); })(t0);
}
function wiReset(){ wi.vis=0; wi.cap={}; drB.querySelectorAll(".wi input[type=range]").forEach(i=>{i.value=0}); wiRender(); }
drB.addEventListener("input",e=>{
  const t=e.target; if(!t.closest||!t.closest(".wi"))return;
  if(t.id==="wiVis")wi.vis=t.value/100; else if(t.dataset.cn!=null)wi.cap[PANEL[openName].cbar[+t.dataset.cn].n]=+t.value;
  wiRender();
});
drB.addEventListener("click",e=>{ if(e.target.closest("#wiReset"))wiReset(); });
const RESPONSE={amber:"Monitor monthly; prepare staged permit release.",red:"Apply quota or pricing; prioritise infrastructure.",crit:"Consider closure, moratorium, ecological assessment."};
const advHTML=bd=>RESPONSE[bd]?`<b>Suggested response:</b> ${RESPONSE[bd]}`:"Within capacity: keep routine monitoring.";
function reefSec(n,d){
  const r=d.reef; if(!r)return "";
  const body=`<div class="reef">${r.lab.map((l,i)=>`<div class="rf${l===n?" me":""}"><span>${esc(l)}</span><span class="t"><i data-w="${Math.max(0,Math.min(100,r.v[i]))}"></i></span><b class="num">${r.v[i]}</b></div>`).join("")}</div><p class="rfNote">${esc(r.metric)}. ${esc(r.note)}</p>`;
  return isec(esc(r.title),"this destination highlighted",body,true);
}
function isec(title,hint,body,open){
  return `<section class="isec${open?" open":""}"><button type="button" class="isecH" aria-expanded="${!!open}"><span>${title}</span><small>${hint}</small><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button><div class="more"><div class="mi">${body}</div></div></section>`;
}
function fillDrawer(n){
  const d=PANEL[n], sc=now(n), bd=bandFor(sc), td=topDrv(n), wk=weakest(d);
  drB.className="drBody g-"+bd; drB.innerHTML=`<h2 id="drT">${esc(n)}</h2>
  <div class="drHead"><span id="drRing"></span><div><span class="pill" id="drPill">${LBL[bd]}</span><p id="drWhy" style="margin:6px 0 0;color:var(--ink-2)">Largest weighted input: <b>${esc(td.n.toLowerCase())}</b> (${Math.round(td.share*100)}% of the weighted inputs). Weakest capacity: <b>${esc(wk.n.toLowerCase())}</b>.</p><p id="drAdv" class="adv">${advHTML(bd)}</p></div></div>
  ${d.note?`<p style="color:var(--ink-2);margin:0">${esc(d.note)}</p>`:""}
  <div class="schemes" role="group" aria-label="Weight scheme">${["ewm","equal"].map(k=>{const v=latestScore(d,k);return `<button type="button" class="sch g-${bandFor(v)}" data-w="${k}" aria-pressed="${scheme===k}"><span>${k==="ewm"?"Trained weights":"Equal weights"}</span><b class="num">${v}</b></button>`}).join("")}</div>
  <h3>Score since ${YR[0]}</h3>${trendSVG(n,bd)}
  ${isec("Try a lever","what if visitors or capacity change",wiHTML(d),false)}
  ${isec("Pressure indicators","value, weight",indRows(d.pbar,true),true)}
  ${isec("Capacity indicators","value 0 to 100",indRows(d.cbar,false),true)}
  ${reefSec(n,d)}
  <div class="ctas"><button type="button" class="cta" id="askAbout">Ask the AI about ${esc(n)}</button><a class="cta ghost" href="/classic#dest=${encodeURIComponent(n)}">Full analysis in Classic</a></div>`;
  [...drB.children].forEach((c,i)=>c.style.setProperty("--k",i));
  wi.vis=0; wi.cap={}; { const s0=scoreWith(PANEL[n]).s; $("#wiNow")._v=s0; $("#wiAft")._v=s0; } wiRender();
  drB._series=PANEL[n].score.slice(); drB.querySelectorAll(".irow .w[data-wv]").forEach(e=>{e._v=+e.dataset.wv});
  drB.querySelectorAll(".sch").forEach(c=>c.onclick=()=>setScheme(c.dataset.w));
  $("#askAbout").onclick=()=>{ if(window.AMBANG_ASK)dr.addEventListener("close",()=>AMBANG_ASK.open(n),{once:true}); closeDrawer(); }; // open the chat once the modal is gone, so it can take focus
  $("#drS").textContent=stateOf(n)+" · "+(YR[LAST]);
  const r=ringSVG(84); $("#drRing").replaceWith(r); r.id="drRing"; requestAnimationFrame(()=>requestAnimationFrame(()=>setRing(r,sc)));
  const ln=drB.querySelector(".ln"); if(ln)ln.style.setProperty("--len",Math.ceil(ln.getTotalLength())+2);
  requestAnimationFrame(()=>requestAnimationFrame(()=>drB.querySelectorAll(".irow .t i, .rf .t i").forEach(i=>i.style.width=i.dataset.w+"%")));
}
function updateDrawer(n){ // weights changed while the drawer is open: animate in place instead of re-rendering
  const d=PANEL[n], sc=now(n), bd=bandFor(sc), td=topDrv(n), wk=weakest(d), from=drB._series||d.score, to=d.score.slice();
  drB.className="drBody g-"+bd; const tr=drB.querySelector(".trend"); tr.setAttribute("class",tr.getAttribute("class").replace(/g-\w+/,"g-"+bd));
  setRing($("#drRing"),sc); $("#drPill").textContent=LBL[bd]; $("#drAdv").innerHTML=advHTML(bd);
  $("#drWhy").innerHTML='Largest weighted input: <b>'+esc(td.n.toLowerCase())+'</b> ('+Math.round(td.share*100)+'% of the weighted inputs). Weakest capacity: <b>'+esc(wk.n.toLowerCase())+'</b>.';
  drB.querySelectorAll(".sch").forEach(c=>c.setAttribute("aria-pressed",String(c.dataset.w===scheme)));
  d.pbar.forEach((it,i)=>{ const e=drB.querySelectorAll(".irow .w[data-wv]")[i], t=drB.querySelectorAll(".irow .wdd")[i]; if(e)tween(e,Math.round(it.w*100),0,"%"); if(t)tween(t,Math.round(it.w*100),0,"%"); });
  morphTrend(n,from,to); drB._series=to; wiRender();
}
function setScheme(key){ // header toggle and the drawer chips both land here
  if(key===scheme)return; scheme=key; applyWeightScheme(key);
  $("#wseg").querySelectorAll("button").forEach(x=>{const on=x.dataset.w===key;x.classList.toggle("on",on);x.setAttribute("aria-pressed",String(on))});
  renderAll(); if(openName)updateDrawer(openName);
  document.dispatchEvent(new CustomEvent("ambang:scheme",{detail:key}));
}
function openDrawer(n){ openName=n; fillDrawer(n); if(!dr.open)dr.showModal(); try{history.replaceState(null,"","#"+encodeURIComponent(n))}catch(e){} }
drB.addEventListener("click",e=>{
  const i=e.target.closest(".info"), s=e.target.closest(".isecH");
  if(i){ const row=i.closest(".irow"), on=!row.classList.contains("open"); row.classList.toggle("open",on); i.setAttribute("aria-expanded",String(on)); }
  else if(s){ const sec=s.closest(".isec"), on=!sec.classList.contains("open"); sec.classList.toggle("open",on); s.setAttribute("aria-expanded",String(on)); }
});
function closeDrawer(){ if(!dr.open)return; if(reduce)return dr.close(); dlgClose(dr); }
$("#drX").onclick=closeDrawer;
dr.addEventListener("cancel",e=>{e.preventDefault();closeDrawer()});
dr.addEventListener("click",e=>{if(e.target===dr)closeDrawer()});
dr.addEventListener("close",()=>{ openName=null; try{history.replaceState(null,"",location.pathname+location.search)}catch(e){} });

// ---- controls: view/weights segments with a sliding thumb, theme switch ----
function thumb(seg){
  let first=true; const place=()=>{ const b=seg.querySelector(".on"); if(!b||!b.offsetWidth)return;
    seg.style.setProperty("--tx",b.offsetLeft+"px"); seg.style.setProperty("--tw",b.offsetWidth+"px");
    if(first){first=false;requestAnimationFrame(()=>seg.classList.add("thumb"))} };
  new ResizeObserver(place).observe(seg); new MutationObserver(place).observe(seg,{attributes:true,subtree:true,attributeFilter:["class"]}); place();
}
document.querySelectorAll(".seg").forEach(thumb);
$("#wseg").addEventListener("click",e=>{
  const b=e.target.closest("button[data-w]"); if(b)setScheme(b.dataset.w);
});
(function(){
  const btn=$("#tbtn"); const mark=t=>btn.setAttribute("aria-checked",String(t==="dark")); mark(root.dataset.theme);
  btn.addEventListener("click",()=>{
    const t=root.dataset.theme==="dark"?"light":"dark";
    const apply=()=>{ root.dataset.theme=t; try{localStorage.setItem("ambangTheme",t)}catch(x){} for(const k in _thc)delete _thc[k]; mark(t); };
    if(document.startViewTransition&&!reduce)document.startViewTransition(apply); else apply(); // one cross-fade of a snapshot, not a colour transition on every element (that hung the page)
  });
})();

function renderAll(){ renderHero(); renderTicker(); renderKpis(); renderMap(); buildChips(); renderRows(); }
(function(){ // section nav: the highlight follows the scroll position, and a click sets it at once (so jumping up or down both work)
  const bar=document.querySelector(".snav .wrap"), links=[...bar.querySelectorAll("a")], tg=links.map(a=>document.getElementById(a.getAttribute("href").slice(1)));
  let cur=-1, lock=0, tick=0;
  const mark=i=>{ if(i===cur)return; cur=i; links.forEach((a,k)=>{ a.classList.toggle("on",k===i); if(k===i)a.setAttribute("aria-current","true"); else a.removeAttribute("aria-current"); });
    const a=links[i]; if(a)bar.scrollTo({left:a.offsetLeft-(bar.clientWidth-a.offsetWidth)/2,behavior:reduce?"auto":"smooth"}); }; // keep the active pill in view on phones
  const spy=()=>{ tick=0; if(Date.now()<lock)return; let i=-1;
    tg.forEach((el,k)=>{ if(el&&el.getBoundingClientRect().top<=140)i=k; });
    if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)i=links.length-1; // bottom of the page = last section
    mark(i); };
  addEventListener("scroll",()=>{ if(!tick)tick=requestAnimationFrame(spy); },{passive:true});
  bar.addEventListener("click",e=>{ const a=e.target.closest("a"); if(!a)return; mark(links.indexOf(a)); lock=Date.now()+1200; setTimeout(spy,1250); }); // ignore the sections the smooth scroll passes on the way
  addEventListener("scrollend",()=>{ lock=0; spy(); });
  // the bar can be dragged with the mouse (touch already swipes) and the wheel moves it sideways
  let down=null, moved=false;
  bar.addEventListener("pointerdown",e=>{ if(e.pointerType!=="mouse"||e.button)return; down={x:e.clientX,l:bar.scrollLeft}; moved=false; });
  addEventListener("pointermove",e=>{ if(!down)return; const dx=e.clientX-down.x; if(Math.abs(dx)>4){ moved=true; bar.classList.add("drag"); } if(moved)bar.scrollLeft=down.l-dx; });
  addEventListener("pointerup",()=>{ down=null; bar.classList.remove("drag"); setTimeout(()=>{moved=false},0); });
  bar.addEventListener("click",e=>{ if(moved){ e.preventDefault(); e.stopImmediatePropagation(); } },true); // a drag is not a click on a link
  bar.addEventListener("dragstart",e=>e.preventDefault());
  bar.addEventListener("wheel",e=>{ if(bar.scrollWidth<=bar.clientWidth||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return; bar.scrollLeft+=e.deltaY; e.preventDefault(); },{passive:false});
  spy();
})();
new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle("off",!e.isIntersecting))).observe($(".hero")); // pause the endless wave/ticker animations while scrolled away
new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle("off",!e.isIntersecting))).observe($(".ticker"));
window.AMBANG_NEW={open:openDrawer,current:()=>openName,scheme:()=>scheme};
renderAll();
let h=""; try{ h=decodeURIComponent(location.hash.slice(1)); }catch(e){} // a malformed hash is ignored
if(h&&PANEL[h])openDrawer(h);
})();
