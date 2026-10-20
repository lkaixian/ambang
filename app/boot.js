// Shared page loader: fetch the 4 data files in parallel, then load the page's scripts in parallel but run them in order (data -> core.js -> page script).
// data-v = cache-busting version, data-scripts = comma list, data-chart="1" = page needs Chart.js from the CDN.
(function(){
  var cs=document.currentScript, V=cs.dataset.v, list=cs.dataset.scripts.split(","), boot=document.getElementById("boot");
  var names=["geoData","realIndicators","pendingData","seasonData"];
  var slow=setTimeout(function(){boot.querySelector(".msg").style.display="block"},400);
  function fail(){clearTimeout(slow);boot.className="err"}
  document.getElementById("bootRetry").onclick=function(){location.reload()};
  if(cs.dataset.chart==="1"&&!window.Chart)return fail(); // charting library (CDN) did not load
  var broke=false; addEventListener("error",function(e){ if(!/^ResizeObserver/.test(e.message||""))broke=true }); // a runtime exception in a loaded script does not fire its onerror
  function load(list){var ss=list.map(function(src){var s=document.createElement("script");s.async=false;s.src=src+"?v="+V;return s}); // async=false: downloads overlap, execution stays in order
    return Promise.all(ss.map(function(s){return new Promise(function(ok,no){s.onload=ok;s.onerror=no;document.body.appendChild(s)})}))}
  Promise.all(names.map(function(n){return fetch("data/"+n+".json?v="+V).then(function(r){if(!r.ok)throw 0;return r.json()})})).then(function(d){
    window.APPDATA={};names.forEach(function(n,i){APPDATA[n]=d[i]});
    return load(list);
  }).then(function(){if(broke)return fail();clearTimeout(slow);boot.hidden=true}).catch(fail);
})();
