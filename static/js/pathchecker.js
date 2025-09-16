// /the101game/static/js/pathchecker.js  (LOUD, VERBOSE, DROP-IN)
// overlays + patches fetch & XHR; logs every request/response; shows errors big.

(function(){
  const maxRows = 50;
  const css = `
  .pc-ovl{position:fixed;left:10px;bottom:10px;right:10px;max-height:40vh;
    background:#0c1220;color:#e6eef6;border:1px solid #2b3b55;border-radius:10px;
    font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,.4)}
  .pc-ovl header{display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid #2b3b55}
  .pc-ovl header b{font-weight:700}
  .pc-ovl header button{margin-left:auto;border:1px solid #2b3b55;background:#162139;color:#e6eef6;border-radius:8px;padding:4px 8px;cursor:pointer}
  .pc-log{overflow:auto;max-height:calc(40vh - 38px);padding:4px 6px}
  .pc-row{display:grid;grid-template-columns: 64px 56px 1fr 68px 64px;gap:6px;padding:3px 0;border-bottom:1px dashed #22324e}
  .pc-row.ok    {color:#c7ffd1}
  .pc-row.warn  {color:#ffe9a3}
  .pc-row.err   {color:#ffb3b3}
  .pc-kv{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  `;

  function now(){ return performance.now(); }
  function fmtMs(ms){ return `${ms.toFixed(0)}ms`; }

  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const ovl = document.createElement('div'); ovl.className='pc-ovl';
  ovl.innerHTML = `<header><b>PATH-CHECKER</b><span id="pc-count">0</span><button id="pc-clear">clear</button></header><div class="pc-log" id="pc-log"></div>`;
  document.addEventListener('keydown', e=>{
    // toggle with Alt+P
    if (e.altKey && (e.key==='p' || e.key==='P')) ovl.style.display = (ovl.style.display==='none'?'':'none');
  });
  document.body.appendChild(ovl);
  const logEl = ovl.querySelector('#pc-log');
  ovl.querySelector('#pc-clear').onclick = ()=>{ logEl.innerHTML=''; count=0; updateCount(); };

  let count=0;
  function updateCount(){ ovl.querySelector('#pc-count').textContent = String(count); }
  function row(cls, a,b,c,d,e){
    const div = document.createElement('div'); div.className = `pc-row ${cls||''}`;
    div.innerHTML = `<div class="pc-kv">${a||''}</div><div class="pc-kv">${b||''}</div><div class="pc-kv" title="${c||''}">${c||''}</div><div class="pc-kv">${d||''}</div><div class="pc-kv">${e||''}</div>`;
    logEl.prepend(div);
    while (logEl.children.length > maxRows) logEl.removeChild(logEl.lastChild);
    count++; updateCount();
  }

  function classify(status){
    if (status>=200 && status<300) return 'ok';
    if (status===0) return 'warn';
    if (status>=300 && status<400) return 'warn';
    if (status>=400) return 'err';
    return '';
  }

  // errors
  window.addEventListener('error', ev=>{
    row('err','ERROR','script', ev.filename, '-', String(ev.message||'error'));
    console.error('[pathchecker:window.error]', ev);
  });
  window.addEventListener('unhandledrejection', ev=>{
    row('err','PROMISE','-', '-', '-', String(ev.reason && (ev.reason.message||ev.reason) || 'rejection'));
    console.error('[pathchecker:unhandledrejection]', ev.reason);
  });

  // fetch patch
  const _fetch = window.fetch.bind(window);
  window.fetch = async function(input, init){
    const url = (typeof input==='string' ? input : (input && input.url) || String(input));
    const method = (init && init.method) || (input && input.method) || 'GET';
    const t0 = now();
    try{
      const resp = await _fetch(input, init);
      const t1 = now();
      const cls = classify(resp.status);
      row(cls, 'FETCH', method, url, resp.status, fmtMs(t1-t0));
      // loud console line
      console.log('%c[FETCH] %s %s -> %s (%s)', 'color:#9cf', method, url, resp.status, fmtMs(t1-t0));
      return resp;
    }catch(e){
      const t1 = now();
      row('err','FETCH', method, url, 'ERR', fmtMs(t1-t0));
      console.error('[FETCH ERR]', method, url, e);
      throw e;
    }
  };

  // XHR patch
  const _XHR = window.XMLHttpRequest;
  function PatchedXHR(){
    const x = new _XHR();
    let url='(n/a)', method='GET', t0=0;
    const open = x.open;
    x.open = function(m,u,...rest){ method = m; url = u; return open.call(x,m,u,...rest); };
    x.addEventListener('loadstart', ()=>{ t0=now(); });
    x.addEventListener('loadend', ()=>{
      const dur = fmtMs(now()-t0);
      const st = x.status||0;
      const cls = classify(st);
      row(cls, 'XHR', method, url, st, dur);
      console.log('%c[XHR] %s %s -> %s (%s)', 'color:#9cf', method, url, st, dur);
    });
    x.addEventListener('error', ()=>{
      row('err', 'XHR', method, url, 'ERR', fmtMs(now()-t0));
      console.error('[XHR ERR]', method, url);
    });
    return x;
  }
  window.XMLHttpRequest = PatchedXHR;

  // navigation
  const _push = history.pushState, _replace = history.replaceState;
  history.pushState = function(s,t,u){ row('warn','NAV','push', String(u||location.href)); return _push.apply(this, arguments); };
  history.replaceState = function(s,t,u){ row('warn','NAV','repl', String(u||location.href)); return _replace.apply(this, arguments); };
  window.addEventListener('popstate', ()=> row('warn','NAV','pop', document.location.href));

  // resource 404 sniff: ping <script src>, <link href>, <img src> at load error
  ['error'].forEach(evt=>{
    window.addEventListener(evt, function(e){
      const el = e.target;
      if (!el || el === window) return;
      const src = el.currentSrc || el.src || el.href;
      if (src) { row('err','RES', el.tagName, src, 'load-fail'); console.warn('[RES ERR]', el.tagName, src); }
    }, true);
  });

  console.log('%c[pathchecker] READY — Alt+P toggles overlay', 'color:#9f9;font-weight:bold');
})();

