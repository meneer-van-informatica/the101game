(function(){
  const KEY='the101game.alias';

  // elke refresh: alias wissen
  try{ localStorage.removeItem(KEY); }catch(_){}

  function setAlias(a){
    a=(a||'').trim().slice(0,24);
    if(!a) return;
    localStorage.setItem(KEY,a); // voor binnen de sessie
    // login ping
    fetch('/api/profile/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:a})}).catch(()=>{});
    markAdminIfNeeded(a);
  }

  function getAlias(){ try{ return localStorage.getItem(KEY)||''; }catch(_){ return ''; } }
  function isAdmin(a){ a=(a||getAlias()||'').toLowerCase(); return a==='lmw'||a==='admin'; }

  function adminBadge(){
    const hud=document.getElementById('hud'); if(!hud) return;
    if (hud.querySelector('.badge-admin')) return;
    const b=document.createElement('span');
    b.className='badge-admin';
    b.style.cssText='margin-left:.5rem;padding:.15rem .45rem;border-radius:8px;border:1px solid #5b8cff;background:#1a2740;color:#cfe3ff;font-weight:800;font-size:12px;letter-spacing:.3px';
    b.textContent='ADMIN';
    hud.appendChild(b);
  }

  function cacheBustAssets(){
    const v='v='+Date.now();
    document.querySelectorAll('script[src^="/js/"],link[rel="stylesheet"][href^="/"]').forEach(el=>{
      const attr = el.tagName==='LINK'?'href':'src';
      const u = new URL(el.getAttribute(attr), location.origin);
      if (!u.searchParams.has('v')){ u.searchParams.set('v', v); el.setAttribute(attr, u.pathname+'?'+u.searchParams.toString()); }
    });
  }

  function markAdminIfNeeded(a){
    if(!isAdmin(a)) return;
    adminBadge();
    cacheBustAssets();
    // ook Page cache破 – simpele no-store hint via meta (runtime)
    const m=document.createElement('meta'); m.httpEquiv='Cache-Control'; m.content='no-store';
    document.head.appendChild(m);
  }

  // hook op bestaand alias-invoer (best-effort)
  window.addEventListener('DOMContentLoaded', ()=>{
    const inp=document.getElementById('alias');
    const form=inp?.closest('form');
    const btn=document.getElementById('alias-submit')||document.querySelector('[data-action="alias-submit"]');
    function done(){ setAlias(inp.value); }
    if(form){ form.addEventListener('submit', e=>{ e.preventDefault(); done(); }); }
    if(btn){ btn.addEventListener('click', done); }
    if(inp){ inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); done(); }}); }
  });

  // logout beacon bij sluiten
  window.addEventListener('pagehide', ()=>{
    const a=getAlias(); if(!a) return;
    const blob=new Blob([JSON.stringify({alias:a})],{type:'application/json'});
    navigator.sendBeacon && navigator.sendBeacon('/api/profile/logout', blob);
  });

  // export mini-API
  window.Alias={ set:setAlias, get:getAlias, isAdmin:isAdmin };
})();
