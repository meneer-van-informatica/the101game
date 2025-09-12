set -e
APP="/var/www/the101game"
PM="101"

cd "$APP"
mkdir -p site/stippy

# --- write stippy.css ---
cat > site/stippy/stippy.css <<'CSS'
:root{--stippy-accent:#e02424;--stippy-bg:#111827;--stippy-fg:#f9fafb;--stippy-shadow:0 12px 30px rgba(0,0,0,.35);--stippy-z:9999}
#stippy-beacon{position:fixed;right:18px;bottom:18px;z-index:var(--stippy-z);width:52px;height:52px;border-radius:50%;border:none;outline:none;background:var(--stippy-accent);color:#fff;font-size:24px;line-height:52px;box-shadow:var(--stippy-shadow);cursor:pointer}
#stippy-beacon .dot{position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 0 4px rgba(224,36,36,.2);animation:stippy-pulse 2s infinite}
@keyframes stippy-pulse{0%{transform:scale(1);opacity:.9}70%{transform:scale(1.6);opacity:0}100%{transform:scale(1);opacity:.9}}
.stippy-overlay{position:fixed;inset:0;z-index:calc(var(--stippy-z) - 1);background:rgba(17,24,39,.45);display:none}
.stippy-card{position:absolute;max-width:340px;background:var(--stippy-bg);color:var(--stippy-fg);border-radius:12px;padding:14px 16px;box-shadow:var(--stippy-shadow);border:1px solid rgba(255,255,255,.08);display:block}
.stippy-card h3{margin:0 0 6px 0;font-size:16px;letter-spacing:.2px;display:flex;gap:.5rem;align-items:center}
.stippy-card p{margin:0 0 10px 0;font-size:14px;line-height:1.35}
.stippy-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.stippy-btn{background:transparent;color:var(--stippy-fg);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px}
.stippy-btn.primary{background:var(--stippy-accent);border-color:var(--stippy-accent)}
.stippy-card::after{content:"";position:absolute;width:10px;height:10px;background:var(--stippy-bg);transform:rotate(45deg)}
.stippy-card[data-placement="top"]::after{bottom:-5px;left:20px;border-left:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}
.stippy-card[data-placement="right"]::after{left:-5px;top:20px;border-top:1px solid rgba(255,255,255,.08);border-left:1px solid rgba(255,255,255,.08)}
.stippy-card[data-placement="bottom"]::after{top:-5px;left:20px;border-top:1px solid rgba(255,255,255,.08);border-right:1px solid rgba(255,255,255,.08)}
.stippy-card[data-placement="left"]::after{right:-5px;top:20px;border-bottom:1px solid rgba(255,255,255,.08);border-right:1px solid rgba(255,255,255,.08)}
.stippy-ring{position:absolute;pointer-events:none;border:2px solid var(--stippy-accent);box-shadow:0 0 0 6px rgba(224,36,36,.2);border-radius:12px;z-index:var(--stippy-z)}
@media (prefers-reduced-motion:reduce){#stippy-beacon .dot{animation:none}}
CSS

# --- write stippy.js ---
cat > site/stippy/stippy.js <<'JS'
(function(){
  const S={cfg:null,idx:0,open:false,els:{},key:null};
  const qs=(s,r=document)=>r.querySelector(s), clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function loadCfg(){const sc=document.currentScript||document.querySelector('script[data-stippy-config]');const url=sc?.dataset?.stippyConfig;return url?fetch(url,{cache:'no-cache'}).then(r=>r.json()):Promise.reject('stippy: config ontbreekt');}
  function beacon(emoji){const b=document.createElement('button');b.id='stippy-beacon';b.type='button';b.setAttribute('aria-label','Open Stippy');b.innerHTML=<span aria-hidden="true"></span><span class="dot" aria-hidden="true"></span>;b.addEventListener('click',toggle);document.body.appendChild(b);return b}
  function overlay(){const o=document.createElement('div');o.className='stippy-overlay';o.addEventListener('click',close);document.body.appendChild(o);return o}
  function card(){const c=document.createElement('div');c.className='stippy-card';c.role='dialog';c.ariaModal='true';c.tabIndex=-1;document.body.appendChild(c);return c}
  function ring(){const r=document.createElement('div');r.className='stippy-ring';document.body.appendChild(r);return r}
  function openStep(i){
    S.idx=i; const step=S.cfg.steps[i]; if(!step){close();return}
    let target=null; if(step.selector){ target=qs(step.selector); if(!target){setTimeout(()=>openStep(i),200);return} target.scrollIntoView({behavior:'smooth',block:'center'}) }
    S.els.overlay.style.display='block';
    const title=(S.cfg.name||'Stippy')+(S.cfg.theme?.emoji? :'');
    S.els.card.innerHTML=<h3></h3><p></p>
      <div class="stippy-actions">
        
        <button class="stippy-btn" data-action="close">Sluiten</button>
        <button class="stippy-btn primary" data-action="next"></button>
      </div>;
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
    c.style.left=${L+window.scrollX}px; c.style.top=${T+window.scrollY}px; c.dataset.placement=w; c.style.visibility='visible';
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
      S.key = stippy::v;
      S.els.beacon=beacon(S.cfg.theme?.emoji||'🔴'); S.els.overlay=overlay(); S.els.card=card(); S.els.ring=ring();
      document.addEventListener('keydown', onKey);
      const qs=new URLSearchParams(location.search), force=qs.get('stippy')==='1', doneFlag=localStorage.getItem(S.key+':done')==='1';
      if((S.cfg.autoStart && !doneFlag) || force){ setTimeout(()=>{ S.els.card.style.display='block'; openStep(0); },200); }
    }catch(e){/* stil falen */}
  });
})();
JS

# --- write stippy.json ---
cat > site/stippy/stippy.json <<'JSON'
{
  "version": 1,
  "slug": "w0l1",
  "name": "Stippy",
  "theme": { "accent": "#e02424", "emoji": "🔴" },
  "autoStart": true,
  "steps": [
    { "id": "welcome", "text": "Hoi! Ik ben Stippy. Ik wijs je door W0L1. Klik ‘Volgende’.", "placement": "bottom" },
    { "id": "title",   "selector": "h1", "text": "Titel kort en spreekbaar (K-9).", "placement": "right", "markCompleteKey": "w0l1:title" },
    { "id": "list",    "selector": "ol,ul", "text": "W0L1 blijft ‘alleen HTML’. Lijstje oké?", "placement": "left" },
    { "id": "back",    "selector": "a[href*='index']", "text": "Teruglink werkt? Dan ben je klaar.", "placement": "top" }
  ]
}
JSON

# --- patch app.py once (Flask) ---
if ! grep -q "def w0l1_html" the101gameengine/app.py; then
cat >> the101gameengine/app.py <<'PY'
# --- Stippy / site static routes ---
import os
from flask import send_from_directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
SITE_DIR = os.path.join(ROOT_DIR, 'site')

@app.get('/site/<path:filename>')
def site_static(filename):
    return send_from_directory(SITE_DIR, filename, max_age=0)

@app.get('/w0l1.html')
def w0l1_html():
    return send_from_directory(SITE_DIR, 'w0l1.html', max_age=0)

@app.get('/w0l1')
def w0l1_short():
    return w0l1_html()
PY
fi

# --- ensure includes in w0l1.html ---
if [ -f site/w0l1.html ]; then
  grep -q 'stippy/stippy.css' site/w0l1.html || \
    sed -i "/<head>/a <link rel=\"stylesheet\" href=\"stippy/stippy.css\">" site/w0l1.html
  grep -q 'stippy/stippy.js' site/w0l1.html || \
    sed -i "/<\/body>/i <script src=\"stippy/stippy.js\" data-stippy-config=\"stippy/stippy.json\" defer><\/script>" site/w0l1.html
fi

# --- reload + smoke test ---
if command -v pm2 >/dev/null 2>&1; then pm2 reload "$PM" && pm2 save; else echo "[server] pm2 missing, skip"; fi
curl -fsS -I https://the101game.io/w0l1.html | sed -n '1p'