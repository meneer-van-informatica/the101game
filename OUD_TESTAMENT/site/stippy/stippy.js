(function(){
  const S={cfg:null,idx:0,open:false,els:{},key:null};
  const qs=(s,r=document)=>r.querySelector(s), clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function loadCfg(){const sc=document.currentScript||document.querySelector('script[data-stippy-config]');const url=sc?.dataset?.stippyConfig;return url?fetch(url,{cache:'no-cache'}).then(r=>r.json()):Promise.reject('stippy: config ontbreekt');}
  function beacon(emoji){const b=document.createElement('button');b.id='stippy-beacon';b.type='button';b.setAttribute('aria-label','Open Stippy');b.innerHTML=`<span aria-hidden="true">${emoji||'🔴'}</span><span class="dot" aria-hidden="true"></span>`;b.addEventListener('click',toggle);document.body.appendChild(b);return b}
  function overlay(){const o=document.createElement('div');o.className='stippy-overlay';o.addEventListener('click',close);document.body.appendChild(o);return o}
  function card(){const c=document.createElement('div');c.className='stippy-card';c.role='dialog';c.ariaModal='true';c.tabIndex=-1;document.body.appendChild(c);return c}
  function ring(){const r=document.createElement('div');r.className='stippy-ring';document.body.appendChild(r);return r}
  function openStep(i){
    S.idx=i; const step=S.cfg.steps[i]; if(!step){close();return}
    let target=null; if(step.selector){ target=qs(step.selector); if(!target){setTimeout(()=>openStep(i),200);return} target.scrollIntoView({behavior:'smooth',block:'center'}) }
    S.els.overlay.style.display='block';
    const title=(S.cfg.name||'Stippy')+(S.cfg.theme?.emoji?` ${S.cfg.theme.emoji}`:'');
    S.els.card.innerHTML=`<h3>${title}</h3><p>${step.text||''}</p>
      <div class="stippy-actions">
        ${i>0?`<button class="stippy-btn" data-action="prev">Vorige</button>`:''}
        <button class="stippy-btn" data-action="close">Sluiten</button>
        <button class="stippy-btn primary" data-action="next">${i<S.cfg.steps.length-1?'Volgende':'Klaar'}</button>
      </div>`;
    S.els.card.querySelector('[data-action="close"]').onclick=close;
    const nb=S.els.card.querySelector('[data-action="next"]'); if(nb) nb.onclick=()=>{ if(step.markCompleteKey) localStorage.setItem(step.markCompleteKey,'1'); (i<S.cfg.steps.length-1)?openStep(i+1):done(); };
    const pb=S.els.card.querySelector('[data-action="prev"]'); if(pb) pb.onclick=()=>openStep(i-1);
    if(target){ place(target,S.els.card,step.placement||'right'); outline(target,S.els.ring); }
    else { const vw=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0), vh=Math.max(document.documentElement.clientHeight||0,window.innerHeight||0); S.els.card.style.left=(vw/2 - S.els.card.offsetWidth/2)+'px'; S.els.card.style.top=(vh/2 - S.els.card.offsetHeight/2)+'px'; S.els.card.dataset.placement='bottom'; S.els.ring.style.width=S.els.ring.style.height='0px'; }
    S.els.card.focus({preventScroll:true}); S.open=true; localStorage.setItem(S.key+':idx',String(S.idx));
  }
  function place(t,c,w){ c.style.visibility='hidden'; c.style.display='block'; const r=t.getBoundingClientRect(), cw=c.offsetWidth,ch=c.offsetHeight,p=10; let L=0,T=0;
    if(w==='left'){L=r.left-cw-p;T=r.top}else if(w==='right'){L=r.right+p;T=r.top}else if(w==='top'){L=r.left;T=r.top-ch-p}else{L=r.left;T=r.bottom+p}
    const vw=window.innerWidth,vh=window.innerHeight; L=clamp(L,8,vw-cw-8); T=clamp(T,8,vh-ch-8);
    c.style.left=`${L+window.scrollX}px`; c.style.top=`${T+window.scrollY}px`; c.dataset.placement=w; c.style.visibility='visible';
  }
  function outline(t,r){ const b=t.getBoundingClientRect(); r.style.left=(b.left+window.scrollX-6)+'px'; r.style.top=(b.top+window.scrollY-6)+'px'; r.style.width=(b.width+12)+'px'; r.style.height=(b.height+12)+'px'; }
  function toggle(){ S.open?close():openStep(loadIdx()); }
  function close(){ S.open=false; S.els.overlay.style.display='none'; S.els.card.style.display='none'; S.els.ring.style.width=S.els.ring.style.height='0px'; }
  function done(){ localStorage.setItem(S.key+':done','1'); close(); }
  function loadIdx(){ const q=new URLSearchParams(location.search); if(q.get('stippy')==='reset'){ localStorage.removeItem(S.key+':idx'); localStorage.removeItem(S.key+':done'); } const i=parseInt(localStorage.getItem(S.key+':idx')||'0',10); return isNaN(i)?0:i; }
  function onKey(e){ if(!S.open) return; if(e.key==='Escape'){e.preventDefault();close()} if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault(); (S.idx>=S.cfg.steps.length-1)?done():openStep(S.idx+1)} if(e.key==='ArrowLeft'){e.preventDefault(); if(S.idx>0) openStep(S.idx-1)} }
  document.addEventListener('DOMContentLoaded', async ()=>{
    try{
      S.cfg = await loadCfg();
      if(S.cfg.theme?.accent) document.documentElement.style.setProperty('--stippy-accent',S.cfg.theme.accent);
      S.key = `stippy:${S.cfg.slug|| (location.pathname||'/w0l1')}:v${S.cfg.version||1}`;
      S.els.beacon=beacon(S.cfg.theme?.emoji||'🔴'); S.els.overlay=overlay(); S.els.card=card(); S.els.ring=ring();
      document.addEventListener('keydown', onKey);
      const qs=new URLSearchParams(location.search), force=qs.get('stippy')==='1', doneFlag=localStorage.getItem(S.key+':done')==='1';
      if((S.cfg.autoStart && !doneFlag) || force){ setTimeout(()=>{ S.els.card.style.display='block'; openStep(0); },200); }
    }catch(e){/* stil falen */}
  });
})();
