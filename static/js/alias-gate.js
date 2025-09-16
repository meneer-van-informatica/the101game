// /static/js/alias-gate.js  — v3
// - voorkomt re-pop na Start
// - Enter op "/" => claim 'lmw' direct

(function () {
  if (window.__ALIAS_GATE_V3_LOADED__) return;
  window.__ALIAS_GATE_V3_LOADED__ = true;

  const LS_KEY = 'the101.alias3';
  const SS_KEY = 'the101.gate.closed';
  const CK    = 'alias'; // fallback cookie (client-side)

  // ---------- helpers ----------
  const valid3 = a => /^[a-z0-9]{3}$/i.test(String(a||''));
  const norm3  = a => String(a||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,3);

  const getLocal = () => { try { return norm3(localStorage.getItem(LS_KEY)||''); } catch(_) { return '';} };
  const setLocal = a  => { try { localStorage.setItem(LS_KEY, norm3(a)); } catch(_){} };

  const getCookie = (name)=>{
    const m = document.cookie.match(new RegExp('(?:^|; )'+name.replace(/([.$?*|{}()\[\]\\/+^])/g,'\\$1')+'=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  };
  const setCookie = (name,val,days)=>{
    const d = new Date(); d.setTime(d.getTime()+(days*864e5));
    document.cookie = `${name}=${encodeURIComponent(val)};path=/;max-age=${days*86400};SameSite=Lax`;
  };

  const hasAlias = ()=>{
    const a = getLocal();
    if (valid3(a)) return a;
    const c = norm3(getCookie(CK));
    return valid3(c) ? c : '';
  };

  async function whoAmI(){
    try{
      const r = await fetch('/api/alias/whoami',{credentials:'include'});
      if(!r.ok) return '';
      const j = await r.json().catch(()=>null);
      if(j?.ok && valid3(j.alias)) return norm3(j.alias);
    }catch(_){}
    return '';
  }

  async function claimServer(a){
    // Best-effort: laat server cookie zetten als endpoint bestaat
    try{
      const r = await fetch('/api/alias/claim',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ alias:a }),
        credentials:'include'
      });
      return r.ok;
    }catch(_){ return false; }
  }

  function persistAlias(a){
    a = norm3(a);
    if (!valid3(a)) return false;
    setLocal(a);                // blijvend → voorkomt repop
    setCookie(CK,a,365);        // browser-cookie fallback
    try { sessionStorage.setItem(SS_KEY,'1'); } catch(_){}
    document.dispatchEvent(new CustomEvent('the101:alias-changed',{detail:{alias:a}}));
    return true;
  }

  // ---------- UI ----------
  function ensureModal(){
    if (document.getElementById('alias-ovl')) return;

    const ovl = document.createElement('div');
    ovl.id = 'alias-ovl';
    ovl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:10000';
    ovl.innerHTML = `
      <div class="alias-card" style="width:min(420px,92vw);background:#121a24;border:1px solid #2b3440;color:#e9eef2;border-radius:14px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.35)">
        <h2 style="margin:0 0 6px 0;font-size:18px">Kies je alias (3 tekens)</h2>
        <div class="alias-row" style="display:flex;gap:8px;margin-top:10px">
          <input id="alias-input" maxlength="3" placeholder="bijv. lmw"
            style="flex:1;padding:.7rem .8rem;border-radius:10px;border:1px solid #2b3440;background:#0f1720;color:#e9eef2;letter-spacing:.15em;text-transform:lowercase">
          <button id="alias-save" style="padding:.7rem 1rem;border-radius:10px;border:1px solid #2b3440;background:#bfa3ff;color:#12121a;font-weight:700;cursor:pointer">Start</button>
        </div>
        <div id="alias-msg" style="margin-top:8px;font-size:12px;opacity:.9"></div>
      </div>`;

    document.body.appendChild(ovl);

    const $in  = ovl.querySelector('#alias-input');
    const $btn = ovl.querySelector('#alias-save');
    const $msg = ovl.querySelector('#alias-msg');
    const say  = t => { $msg.textContent = String(t||''); };

    $in.addEventListener('input', ()=>{
      const v = norm3($in.value);
      if ($in.value !== v) $in.value = v;
    });
    $in.addEventListener('keydown', e => { if (e.key === 'Enter') $btn.click(); });

    $btn.addEventListener('click', async ()=>{
      let a = norm3($in.value || 'lmw');     // default lmw
      if (!valid3(a)) { say('Gebruik precies 3 tekens: a–z of 0–9.'); $in.focus(); return; }

      // 1) Lokaal vastzetten + cookie (direct) → voorkomt re-pop
      persistAlias(a);

      // 2) UI dicht
      ovl.remove();

      // 3) Server in achtergrond
      claimServer(a);
    });
  }

  // ---------- Gate ----------
  async function gate(){
    try { if (sessionStorage.getItem(SS_KEY)==='1') return; } catch(_){}

    // Als we lokaal of via cookie al een alias hebben: NIET tonen
    const aLocal = hasAlias();
    if (valid3(aLocal)) return;

    // Zo niet: misschien weet de server het (signed cookie)?
    const aSrv = await whoAmI();
    if (valid3(aSrv)) { persistAlias(aSrv); return; }

    // Anders: toon modal
    ensureModal();
  }

  // ---------- Global ENTER quick-claim 'lmw' op homepage ----------
  function bindEnterShortcut(){
    document.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter') return;

      const onHome = location.pathname === '/' || location.pathname === '/index.html';
      const ovl = document.getElementById('alias-ovl');
      const have = hasAlias();

      if (ovl) {
        // Modal open → vul lmw in als leeg en klik Start
        const $in  = ovl.querySelector('#alias-input');
        const $btn = ovl.querySelector('#alias-save');
        if ($in && !$in.value) $in.value = 'lmw';
        if ($btn) $btn.click();
        e.preventDefault();
        return;
      }

      if (onHome && !have) {
        // Geen modal, geen alias → meteen lmw claimen
        const a = 'lmw';
        persistAlias(a);
        claimServer(a);
        e.preventDefault();
      }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    bindEnterShortcut();
    gate();
  });
})();

