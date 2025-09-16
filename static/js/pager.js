// Navigatie (A/F), alias, tracking, SRT laden, code (links) + run (rechts), lang toggle, 0000/5200 tellers.
(function(){
  const TOTAL = (window.PageBook && window.PageBook.total) || 5200;
  const pad4 = (n)=> String(n).padStart(4,'0');

  const LS_ALIAS = 'the101game.alias';
  const LS_IDX   = 'the101game.page';
  const LS_TRACK = 'the101game.track';
  const LS_LANG  = 'the101game.lang';

  // alias
  function getAlias(){
    let a = localStorage.getItem(LS_ALIAS);
    if (!a) { a = prompt('Enter your alias','') || 'Player'; a = a.trim() || 'Player'; localStorage.setItem(LS_ALIAS,a); }
    return a;
  }
  const alias = getAlias();
  document.getElementById('alias-tag').textContent = '@'+alias;

  // lang
  const $lang = document.getElementById('lang');
  let lang = localStorage.getItem(LS_LANG) || 'nl';
  $lang.value = lang;
  $lang.addEventListener('change', ()=>{
    lang = $lang.value || 'nl';
    localStorage.setItem(LS_LANG, lang);
    renderPage(); // herlaad SRT
  });

  // tracking
  const $toggle = document.getElementById('track-toggle');
  let tracking = (localStorage.getItem(LS_TRACK) ?? 'false') === 'true';
  function renderToggle(){ $toggle.textContent = `online: ${tracking?'ON':'OFF'}`; }
  $toggle.addEventListener('click', async ()=>{
    tracking = !tracking; localStorage.setItem(LS_TRACK, String(tracking)); renderToggle();
    try{ await API.online(alias, tracking); }catch{}
  }); renderToggle();

  // counter + move
  const $counter = document.getElementById('counter');
  let i = Number(localStorage.getItem(LS_IDX) || 0);

  async function renderPage(){
    // HUD
    $counter.textContent = `${pad4(i)} / ${TOTAL}`;
    // main text from SRT
    if (window.PageBook?.render) window.PageBook.render(i, lang);
    // code + run panes by convention from SRT metadata:
    // Convention: if a file /labs/<lang>/<0000>.js or .html exists, we load it.
    await loadCodeAndRun();
    // persist + API
    localStorage.setItem(LS_IDX, String(i));
    API.page(alias, i).catch(()=>{});
  }

  async function loadCodeAndRun(){
    const codeEl = document.getElementById('code');
    const iframe = document.getElementById('sandbox');
    codeEl.textContent = 'laden…';
    // probe html first, then js
    const base = `/labs/${lang}/${pad4(i)}`;
    let src = null, type = null;
    for (const ext of ['.html','.js']) {
      try {
        const r = await fetch(base+ext, { cache:'no-store' });
        if (r.ok) { src = base+ext; type = ext.slice(1); break; }
      } catch {}
    }
    if (!src) { codeEl.innerHTML = '<em>geen code</em>'; iframe.srcdoc = '<!doctype html>'; return; }

    // show code
    try{
      const txt = await (await fetch(src, { cache:'no-store' })).text();
      codeEl.textContent = txt;
    }catch{ codeEl.textContent = '(kon code niet laden)'; }

    // run in sandboxed iframe
    if (type === 'html') {
      iframe.src = src;
    } else {
      iframe.srcdoc = `<!doctype html><meta charset="utf-8"><title>${pad4(i)}</title><body><script src="${src}"><\/script></body>`;
    }
  }

  function move(dir){
    i = (i + (dir>0?1:-1) + TOTAL) % TOTAL;
    flip(dir); renderPage();
  }

  // audio flip
  let ac;
  function ctx(){ return ac || (ac = new (window.AudioContext||window.webkitAudioContext)()); }
  function flip(dir){
    try{
      const c=ctx(), o=c.createOscillator(), g=c.createGain(), t=c.currentTime;
      o.type='triangle'; o.frequency.setValueAtTime(dir>0?660:440,t); o.frequency.exponentialRampToValueAtTime(dir>0?880:330,t+0.06);
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.2,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t+0.15);
    }catch{}
  }
  document.addEventListener('click',()=>{ try{ ctx().resume(); }catch{} }, {once:true});

  // go to
  document.getElementById('goto-btn').addEventListener('click', ()=>{
    const v = prompt('Ga naar pagina (0..'+(TOTAL-1)+')', String(i));
    if (v==null) return;
    const n = Math.max(0, Math.min(TOTAL-1, parseInt(v,10)||0));
    if (n!==i){ i=n; renderPage(); }
  });

  // heartbeat + unload
  setInterval(()=>{ if (tracking) API.ping(alias, i).catch(()=>{}); }, 30000);
  window.addEventListener('beforeunload', (e)=>{ API.beaconLogout(alias); e.preventDefault(); e.returnValue=''; });

  // kukel dialog
  document.getElementById('kukel').addEventListener('click', ()=>{
    alert(`KUKEL wallet @${alias}\n\nSaldo: ${document.getElementById('kukel-balance')?.textContent || '0'}\n\nJe eerste coin verdien je via pagina 1 / 5200:\n– Mail naar lucas@the101game.io\n– Volg het format op 0 / 5200`);
  });

  // bootstrap: hello + profile (saldo & lastPage restore)
  (async ()=>{
    try {
      await API.hello(alias, i, tracking);
      const prof = (await API.getProfile(alias)).profile;
      if (prof?.lastPage != null) { i = prof.lastPage; }
      const bal = (prof && Number.isFinite(prof.kukel)) ? prof.kukel : 0;
      const bEl = document.getElementById('kukel-balance'); if (bEl) bEl.textContent = bal;
    } catch {}
    renderPage();
  })();

  // scorebord overlay init (file exists already)
})();

