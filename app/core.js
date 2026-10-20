// Shared by the new and classic dashboards: data tables, weighted scoring, band helpers. No DOM access.
// Single source of truth for score bands: a band covers lo <= score < hi (Critical is 75 and up). Tables, zones and prompts read this.
const BANDS=[{k:"green",lo:0,hi:45,c:"--teal"},{k:"amber",lo:45,hi:60,c:"--amber"},{k:"red",lo:60,hi:75,c:"--coral"},{k:"crit",lo:75,hi:100,c:"--crit"}];
const CLR=new Proxy({},{get:(_,k)=>TH((BANDS.find(b=>b.k===k)||{c:"--ink-3"}).c)}); // band colours follow the theme
const PILL={green:"p-green",amber:"p-amber",red:"p-red",crit:"p-crit",na:"p-na"};
const LBL={green:"Normal",amber:"Warning",red:"Alert",crit:"Critical",na:"No score"};
function bandFor(s){ if(!Number.isFinite(s))return "na"; return (BANDS.find(b=>s<b.hi)||BANDS[3]).k; } // non-finite = no score, never a false alarm
const bandRng=b=>!b.lo?`below ${b.hi}`:b.hi>=100?`${b.lo} and up`:`${b.lo} to ${b.hi}`;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=u=>/^https?:\/\//i.test(u)?u:"#"; // hrefs from data must be http(s)
const EAST_CLOSED=["Perhentian","Redang","Lang Tengah","Kapas","Tioman","Tulai","Sembilang"]; // resort closures reported for these; Nov to Feb
// Plays a dialog's .closing slide-out, then closes it. Only the dialog's own animationend counts (not its children's); the timer covers a missed event.
function dlgClose(dlg){
  if(!dlg.open||dlg.classList.contains("closing"))return; dlg.classList.add("closing");
  const fin=()=>{ clearTimeout(t); dlg.removeEventListener("animationend",on); dlg.classList.remove("closing"); if(dlg.open)dlg.close(); }, on=e=>{ if(e.target===dlg)fin(); }, t=setTimeout(fin,400);
  dlg.addEventListener("animationend",on);
}
function clamp01(v){ return Math.max(0,Math.min(1,v)); }
function deriveScore(p,c){ return p.map((pv,i)=>Math.round(100*pv/(pv+c[i]))); }

const YR=[2010,2012,2014,2016,2018,2020,2022,2023];

// Pretrained via the Entropy Weight Method, scripts/train_weights.py (n=15
// destinations x 6 indicators). "visitor" is now real for the 14 marine
// islands (archive.data.gov.my marine-park-visitor counts, confirmed
// 2026-09-22 -- see progress.md); the other 5 slots are still trained on
// this file's own placeholder values -- re-run once those land too.
const INDICATOR_KEYS=["visitor","hotel","accom","occ","season","income"];
const WEIGHT_SCHEMES={
  ewm:{visitor:.453, hotel:.124, accom:.202, occ:.046, season:.073, income:.101},
  equal:{visitor:1/6, hotel:1/6, accom:1/6, occ:1/6, season:1/6, income:1/6}
};
const W=WEIGHT_SCHEMES.ewm;
const REEF_NOTE="Source: Reef Check Malaysia annual surveys. This is the direct ecological measurement, not a proxy, and the strongest evidence in the project for Goal 14.";

// One entry per marine park cluster (Fisheries Act 1985 gazettement): the
// state-level pressure/capacity time series (register-grounded), the
// capacity indicators shared by every island in it (waste/water/resident
// base are genuinely state-level, per the register), and the reef
// comparison chart shown on every island's detail page.
const CLUSTERS={
  "Terengganu":{
    p:[.44,.49,.55,.60,.66,.31,.68,.72], c:[.52,.50,.47,.45,.42,.44,.39,.37],
    cbarBase:[{n:"Waste handling",v:.05,w:3,src:"archive.data.gov.my (SWCorp facility counts), state, 2020",real:true},{n:"Water headroom",v:.46,w:3,src:"data.gov.my water_production − water_consumption, state, 2022",real:true},{n:"Resident base",v:.31,w:3,src:"DOSM population_district, state, 2025",real:true}],
    reef:{lab:["Perhentian","Redang","Lang Tengah","Kapas"],v:[32.4,25.9,26.7,52.6],title:"Live coral cover by island",metric:"Per cent cover",note:REEF_NOTE},
    islands:{
      "Perhentian":{reefPct:32.4,note:"Busiest island in the cluster on every pressure indicator; crossed the threshold earliest.",pbar:[
        {n:"Marine park visitors",v:.95,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.81,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.78,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.70,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.74,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.75,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Redang":{reefPct:25.9,note:"Resort-led rather than backpacker-led, but pressure tracks Perhentian closely.",pbar:[
        {n:"Marine park visitors",v:.92,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.80,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.76,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.68,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.72,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.73,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Lang Tengah":{reefPct:26.7,note:"Smaller, boutique-resort island; meaningfully lower pressure than its two larger neighbours.",pbar:[
        {n:"Marine park visitors",v:.67,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.58,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.55,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.50,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.60,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.54,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Kapas":{reefPct:52.6,note:"Mostly a day-trip island; the lowest pressure in the cluster.",pbar:[
        {n:"Marine park visitors",v:.59,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.52,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.48,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.45,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.55,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.48,w:W.income,src:"DOSM HIES, district, annual",real:true}]}
    }
  },
  "Pahang":{
    p:[.36,.39,.43,.47,.51,.24,.50,.53], c:[.50,.49,.48,.47,.45,.46,.44,.43],
    cbarBase:[{n:"Waste handling",v:.95,w:3,src:"archive.data.gov.my (SWCorp facility counts), state, 2020",real:true},{n:"Water headroom",v:.91,w:3,src:"data.gov.my water_production − water_consumption, state, 2022",real:true},{n:"Resident base",v:.40,w:3,src:"DOSM population_district, state, 2025",real:true}],
    reef:{lab:["Tioman","Tulai","Sembilang"],v:[43.0,42,37.5],title:"Live coral cover by island",metric:"Per cent cover",note:REEF_NOTE},
    islands:{
      // Tioman 42.99 and Besar 43.04 in data/coral_cover.csv both round to 43.0 (not a copy error)
      "Tioman":{reefPct:43.0,note:"Dominates the cluster: the only island here with real resort infrastructure.",pbar:[
        {n:"Marine park visitors",v:.43,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.60,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.58,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.60,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.58,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.58,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Tulai":{reefPct:42,reefReal:false,note:"Day-trip snorkelling stop, no overnight accommodation, lowest pressure in the cluster. Its coral cover is a placeholder.",pbar:[
        {n:"Marine park visitors",v:.25,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.30,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.20,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.35,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.45,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.32,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Sembilang":{reefPct:37.5,note:"Smallest, least-visited island in the cluster.",pbar:[
        {n:"Marine park visitors",v:.22,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.28,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.22,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.32,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.40,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.30,w:W.income,src:"DOSM HIES, district, annual",real:true}]}
    }
  },
  "Kedah":{
    p:[.33,.35,.38,.41,.44,.19,.43,.45], c:[.54,.53,.53,.52,.51,.52,.50,.50],
    cbarBase:[{n:"Waste handling",v:.50,w:3,src:"archive.data.gov.my (SWCorp facility counts), state, 2020",real:true},{n:"Water headroom",v:.95,w:3,src:"data.gov.my water_production − water_consumption, state, 2022",real:true},{n:"Resident base",v:.52,w:3,src:"DOSM population_district, state, 2025",real:true}],
    reef:{lab:["Payar","Lembu","Kaca"],v:[42.3,51.9,56.9],title:"Live coral cover by island",metric:"Per cent cover",note:REEF_NOTE},
    islands:{
      "Payar":{reefPct:42.3,note:"The only island in the cluster with a jetty and resort.",pbar:[
        {n:"Marine park visitors",v:.05,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.62,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.52,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.66,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.48,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.55,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Lembu":{reefPct:51.9,note:"Day-trip stop; moderate pressure riding on Payar's visitor flow.",pbar:[
        {n:"Marine park visitors",v:.03,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.45,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.32,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.55,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.38,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.40,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Kaca":{reefPct:56.9,note:"Smallest island in the cluster, minimal infrastructure.",pbar:[
        {n:"Marine park visitors",v:.03,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.40,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.25,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.48,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.32,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.33,w:W.income,src:"DOSM HIES, district, annual",real:true}]}
    }
  },
  "Johor":{
    p:[.26,.27,.29,.31,.33,.15,.33,.34], c:[.56,.56,.55,.55,.54,.55,.54,.54],
    cbarBase:[{n:"Waste handling",v:.20,w:3,src:"archive.data.gov.my (SWCorp facility counts), state, 2020",real:true},{n:"Water headroom",v:.05,w:3,src:"data.gov.my water_production − water_consumption, state, 2022",real:true},{n:"Resident base",v:.95,w:3,src:"DOSM population_district, state, 2025",real:true}],
    reef:{lab:["Sibu","Tinggi","Besar","Rawa"],v:[52.8,52.5,43.0,48.9],title:"Live coral cover by island",metric:"Per cent cover",note:REEF_NOTE},
    islands:{
      "Sibu":{reefPct:52.8,note:"Popular dive-resort island; the cluster's highest pressure.",pbar:[
        {n:"Marine park visitors",v:.52,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.38,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.34,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.48,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.40,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.37,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Tinggi":{reefPct:52.5,note:"Largest island in the cluster; resort-led tourism similar in scale to Sibu.",pbar:[
        {n:"Marine park visitors",v:.48,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.36,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.32,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.46,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.38,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.35,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Besar":{reefPct:43.0,note:"Lower pressure than Sibu/Tinggi; the lowest coral cover of the four.",pbar:[
        {n:"Marine park visitors",v:.42,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.32,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.27,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.42,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.35,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.31,w:W.income,src:"DOSM HIES, district, annual",real:true}]},
      "Rawa":{reefPct:48.9,note:"Small, exclusive single-resort island, the lowest pressure of the four tracked here.",pbar:[
        {n:"Marine park visitors",v:.35,w:W.visitor,src:"archive.data.gov.my (Marine Park Malaysia), state, 2015–17 avg",real:true},
        {n:"Hotel guest arrivals",v:.29,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
        {n:"Accommodation density",v:.22,w:W.accom,src:"DOSM MyTAS, state/district"},
        {n:"Occupancy",v:.40,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
        {n:"Seasonality",v:.30,w:W.season,src:"Tourism Malaysia, national"},
        {n:"Cost-of-living pressure",v:.28,w:W.income,src:"DOSM HIES, district, annual",real:true}]}
    }
  }
};

// Cameron Highlands has no islands to split, district-level, single entry.
const CAMERON={
  p:[.40,.46,.52,.58,.63,.35,.66,.70], c:[.46,.44,.41,.38,.36,.38,.33,.31],
  pbar:[
    {n:"District visitor/accommodation activity",v:.70,w:W.visitor,src:"DOSM MyLocalStats, district, partial"},
    {n:"Hotel guest arrivals",v:.81,w:W.hotel,src:"Illustrative placeholder. Tourism Malaysia publishes state hotel guests (yearly), but state totals do not describe islands, so it is not used"},
    {n:"Accommodation density",v:.83,w:W.accom,src:"DOSM MyTAS, state/district"},
    {n:"Occupancy",v:.61,w:W.occ,src:"DOSM/Tourism Malaysia, state"},
    {n:"Seasonality",v:.64,w:W.season,src:"Tourism Malaysia, national"},
    {n:"Cost-of-living pressure",v:.66,w:W.income,src:"DOSM HIES, district, annual",real:true}],
  cbar:[{n:"Waste handling",v:.95,w:3,src:"archive.data.gov.my (SWCorp facility counts), state (Pahang), 2020",real:true},{n:"Water headroom",v:.91,w:3,src:"data.gov.my water_production − water_consumption, state (Pahang), 2022",real:true},{n:"River water quality",v:.35,w:3},{n:"Resident base",v:.05,w:3,src:"DOSM population_district, district, 2025",real:true}],
  reef:{lab:["Sg Bertam","Sg Telom"],v:[58,62],
    title:"River water quality index by basin",metric:"Water quality index",
    note:"Source: Department of Environment river-basin water quality monitoring. Used as the ecological capacity proxy here: there is no reef indicator on a highland river."},
  note:"Driven by accommodation density and a thin resident base rather than by visitor numbers alone. Caveat: its visitor weight was trained on marine-park counts, so read this score with extra caution."
};

// Expand each cluster into one PANEL entry per island. Capacity time series
// and the waste/water/resident-base bars are shared (genuinely state-level);
// both pressure AND capacity historical series are illustratively scaled
// from the cluster's state-level series by how this island's current
// weighted pbar/cbar snapshot compares to it (buildSeries) -- so score is
// always derived from the live weight scheme, never hand-picked, and moves
// when the weight-scheme selector changes. baseP/baseC are kept on each
// entry so applyWeightScheme can rescale without re-reading CLUSTERS.
function buildSeries(baseArr,currentWgm){
  const scale=currentWgm/baseArr[baseArr.length-1];
  return baseArr.map(v=>clamp01(v*scale));
}
const REAL_IND=APPDATA.realIndicators;
// Swap an island's placeholder Seasonality / Occupancy / Accommodation bars for real values where scripts/build_pending.py found them.
function applyReal(name,pbar){
  const r=REAL_IND[name]; if(!r)return;
  const key={"Accommodation density":"accom","Occupancy":"occ","Seasonality":"season"};
  for(const it of pbar){ const x=r[key[it.n]]; if(x){ it.v=x.v; it.real=true; it.src=x.src; } }
}
const PANEL={};
for(const cl of Object.values(CLUSTERS)){
  for(const [iname,isl] of Object.entries(cl.islands)){
    applyReal(iname,isl.pbar);
    const cbar=[...cl.cbarBase,{n:"Live coral cover",v:isl.reefPct/100,w:3,src:"reefcheck.org.my interactive map, per-site, 2025/26",real:isl.reefReal!==false}];
    const p=buildSeries(cl.p,wgm(isl.pbar));
    const c=buildSeries(cl.c,wgm(cbar));
    PANEL[iname]={
      p, c, score:deriveScore(p,c),
      baseP:cl.p, baseC:cl.c,
      pbar:isl.pbar,
      cbar,
      reef:cl.reef,
      note:isl.note
    };
  }
}
{
  applyReal("Cameron Highlands",CAMERON.pbar);
  const p=buildSeries(CAMERON.p,wgm(CAMERON.pbar));
  const c=buildSeries(CAMERON.c,wgm(CAMERON.cbar));
  PANEL["Cameron Highlands"]={
    p, c, score:deriveScore(p,c),
    baseP:CAMERON.p, baseC:CAMERON.c,
    pbar:CAMERON.pbar, cbar:CAMERON.cbar, reef:CAMERON.reef, note:CAMERON.note
  };
}

function computeDest(){
  return Object.keys(PANEL).map(n=>{
    const s=PANEL[n].score[PANEL[n].score.length-1];
    return {n, s, band:bandFor(s)};
  });
}


function applyWeightScheme(schemeKey){
  const scheme=WEIGHT_SCHEMES[schemeKey];
  for(const d of Object.values(PANEL)){
    d.pbar.forEach((it,i)=>{ it.w=scheme[INDICATOR_KEYS[i]]; });
    d.p=buildSeries(d.baseP,wgm(d.pbar));
    d.c=buildSeries(d.baseC,wgm(d.cbar));
    d.score=deriveScore(d.p,d.c);
  }
}
// weighted geometric mean: items = [{v,w}]
function wgm(items){
  const totalW=items.reduce((s,it)=>s+it.w,0);
  const logSum=items.reduce((s,it)=>s+it.w*Math.log(Math.max(it.v,.01)),0);
  return Math.exp(logSum/totalW);
}

function latestScore(d,key){
  const w=WEIGHT_SCHEMES[key];
  const P=wgm(d.pbar.map((it,i)=>({v:it.v,w:w[INDICATOR_KEYS[i]]})));
  return Math.round(100*P/(P+wgm(d.cbar)));
}

function scoreWith(d,m={}){
  const pb=d.pbar.map((it,i)=>({v:i===0?Math.max(.03,it.v*(1+(m.vis||0))):it.v,w:it.w}));
  const cb=d.cbar.map(it=>({v:Math.min(.95,Math.max(it.v,it.v+((m.cap||{})[it.n]||0))),w:it.w}));
  const P=wgm(pb),C=wgm(cb);
  return {P,C,s:Math.round(100*P/(P+C))};
}
function topDriver(d){
  const c=d.pbar.map(it=>({n:it.n,raw:it.w*it.v})), t=c.reduce((s,x)=>s+x.raw,0), b=c.slice().sort((x,y)=>y.raw-x.raw)[0];
  return {n:b.n,share:b.raw/t};
}
const weakest=d=>d.cbar.reduce((m,it)=>it.v<m.v?it:m,d.cbar[0]);
