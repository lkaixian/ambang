// "Ask AMBANG" chat for the new view. Same server endpoint, prompt and safety rules as the classic chat (ai.js); only the UI is new.
(function(){
const $=s=>document.querySelector(s), fab=$("#askFab"), panel=$("#askPanel"), body=$("#askBody"), inp=$("#askIn"), chipsEl=$("#askChips"), send=$("#askSend");
const hist=[]; let busy=false, about="";
window.aiPage=()=>({view:"New dashboard, "+(about?"asking about "+about:"overview"),sel:about,scheme:AMBANG_NEW.scheme()}); // read by ai.js
const dests=Object.keys(PANEL);

function link(root){ // destination names in a reply become buttons that open that destination's drawer
  const re=new RegExp("(?<![\\w])("+dests.slice().sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^${}()|[\]\\\/]/g,"\\$&")).join("|")+")(?![\\w])","g");
  const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest("button,a,code")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}), nodes=[];
  while(tw.nextNode())nodes.push(tw.currentNode);
  nodes.forEach(node=>{ const t=node.nodeValue; re.lastIndex=0; if(!re.test(t))return; re.lastIndex=0;
    const f=document.createDocumentFragment(); let last=0,m;
    while((m=re.exec(t))){ f.append(t.slice(last,m.index)); const b=document.createElement("button"), name=m[1]; b.type="button"; b.className="dl"; b.textContent=name; b.onclick=()=>{ if(matchMedia("(max-width:560px)").matches)toggle(false); AMBANG_NEW.open(name); }; f.append(b); last=m.index+m[0].length; }
    f.append(t.slice(last)); node.replaceWith(f); });
}
function add(kind,text,btns){
  const d=document.createElement("div"); d.className="msg "+kind; if(kind==="err")d.setAttribute("role","alert"); // role first, so the insert is announced
  if(kind==="bot"){ d.innerHTML=aiFormat(text); link(d); } else d.textContent=text;
  (btns||[]).forEach(([label,fn])=>{ const b=document.createElement("button"); b.type="button"; b.className="lnk"; b.textContent=label; b.onclick=fn; d.append(b); });
  body.appendChild(d); body.scrollTop=body.scrollHeight; return d;
}
function chips(){
  const n=about, q=["Which regions are closest to their limit?","Who needs attention first?","What here is real data and what is a placeholder?","What does a region's colour mean?"];
  const s=n&&PANEL[n]?PANEL[n].score:null;
  const list=s?[`Why is ${n} ${LBL[bandFor(s[s.length-1])]}?`,`What would improve ${n} the most?`,`How real is the data for ${n}?`]:q; // wording matches the server's allowed suggested questions, so answers are shared and cached
  const key=list.join("|"); if(chipsEl.dataset.k===key)return; chipsEl.dataset.k=key; // unchanged list: keep the nodes (and any focus on them)
  chipsEl.textContent=""; list.forEach(t=>{ const b=document.createElement("button"); b.type="button"; b.className="chip"; b.textContent=t; b.onclick=()=>ask(t,false,true); chipsEl.appendChild(b); });
}
function welcome(){ add("bot","Ask me about a destination's score, what drives it, or how the method works. I answer from the data on this page and will say when a figure is a placeholder."); }
async function ask(over,retry,standalone){
  const text=(over||inp.value).trim(); if(!text||busy)return;
  if(!retry)add("user",text); inp.value=""; inp.style.height="auto"; hist.push({role:"user",content:text});
  busy=true; send.disabled=inp.disabled=true;
  const typing=add("bot",""); typing.innerHTML='<span class="typing" role="status" aria-label="Ask AMBANG is writing"><i></i><i></i><i></i></span>';
  try{
    const reply=await aiAsk(standalone?[{role:"user",content:text}]:hist.slice(-11),aiBuildDashboardContext(),700);
    typing.remove(); add("bot",reply);
    if(reply.startsWith("I can only answer questions about this dashboard"))hist.pop(); else hist.push({role:"assistant",content:reply}); // a refused question must not stay in the context
  }catch(err){
    typing.remove(); hist.pop();
    const m=add("err",err.message,[["Retry",()=>{m.remove();ask(text,true,standalone)}]]);
    if(err.kind==="rate")aiCountdown(m.querySelector(".lnk"),"Retry",err.wait);
  }finally{ busy=false; send.disabled=inp.disabled=false; if(!matchMedia("(pointer:coarse)").matches)inp.focus(); chips(); }
}
function toggle(open){
  const show=open!==undefined?open:panel.hidden||panel.classList.contains("out"); clearTimeout(toggle.t); fab.setAttribute("aria-expanded",String(show));
  if(show){ panel.hidden=false; panel.classList.remove("out"); chips(); inp.focus(); }
  else if(!panel.hidden){ panel.classList.add("out"); toggle.t=setTimeout(()=>{panel.hidden=true;panel.classList.remove("out")},200); }
}
fab.onclick=()=>toggle(); $("#askX").onclick=()=>{toggle(false);fab.focus()};
panel.addEventListener("keydown",e=>{if(e.key==="Escape"){toggle(false);fab.focus()}});
$("#askNew").onclick=()=>{ hist.length=0; about=""; body.textContent=""; welcome(); chips(); inp.focus(); };
$("#askForm").onsubmit=e=>{ e.preventDefault(); ask(); };
inp.addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask()} });
inp.addEventListener("input",()=>{ inp.style.height="auto"; inp.style.height=Math.min(inp.scrollHeight,90)+"px"; });
window.AMBANG_ASK={open:n=>{ about=n||""; toggle(true); }};
welcome();
})();
