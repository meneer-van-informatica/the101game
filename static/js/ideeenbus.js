(function(){
  // Button links-onder, fixed block; F-pattern safe.
  const btn = document.createElement('button');
  btn.textContent = 'IDEEËNBUS';
  Object.assign(btn.style, {
    position:'fixed', left:'12px', bottom:'12px', zIndex:1000,
    padding:'.6rem .9rem', borderRadius:'10px', border:'1px solid #2b3440',
    background:'#0f1720', color:'#e9eef2', cursor:'pointer'
  });
  document.body.appendChild(btn);

  const modal = document.createElement('div');
  Object.assign(modal.style, {
    position:'fixed', inset:0, display:'none', alignItems:'center', justifyContent:'center',
    background:'rgba(0,0,0,.45)', zIndex:1001
  });
  modal.innerHTML = `
    <div style="max-width:520px;width:92%;background:#0b1220;border:1px solid #2b3440;border-radius:12px;padding:16px">
      <h3 style="margin:0 0 8px">IDEEËNBUS</h3>
      <p style="margin:0 0 12px;opacity:.9">Kies je feedback en (optioneel) voeg een notitie toe.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button data-kind="BACK"     style="flex:1;padding:.6rem;border-radius:10px;border:1px solid #3a2b2b;background:#1e0f0f;color:#ffb4b4;cursor:pointer">FEED BACK (-1)</button>
        <button data-kind="UP"       style="flex:1;padding:.6rem;border-radius:10px;border:1px solid #2b3430;background:#0f2010;color:#b7ffb7;cursor:pointer">FEED UP (+1_)</button>
        <button data-kind="FORWARD"  style="flex:1;padding:.6rem;border-radius:10px;border:1px solid #2b3040;background:#0f1420;color:#b7c9ff;cursor:pointer">FEED FORWARD (+0.1)</button>
      </div>
      <textarea id="fb-note" rows="3" placeholder="(optioneel) licht toe..."
        style="width:100%;padding:.6rem;border-radius:10px;border:1px solid #2b3440;background:#121a24;color:#e9eef2"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button id="fb-cancel" style="padding:.5rem .8rem;border-radius:8px;border:1px solid #2b3440;background:#121a24;color:#e9eef2">Sluiten</button>
      </div>
      <div id="fb-msg" style="margin-top:8px;min-height:1.2em;opacity:.9"></div>
    </div>`;
  document.body.appendChild(modal);

  btn.addEventListener('click', ()=>{ modal.style.display='flex'; });
  modal.querySelector('#fb-cancel').addEventListener('click', ()=>{ modal.style.display='none'; });

  function pageIndex(){ try{ return (window.PageCtx&&Number(window.PageCtx.index))||0; }catch{ return 0; } }
  async function send(kind){
    const note = (document.getElementById('fb-note').value||'').slice(0,200);
    const r = await fetch('/api/feedback/submit', { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ page: pageIndex(), kind, note }) });
    const j = await r.json().catch(()=>({ok:false}));
    const msg = modal.querySelector('#fb-msg');
    if (j.ok){ msg.textContent = 'Dankjewel! Opgeslagen.'; document.getElementById('fb-note').value=''; }
    else if (j.error==='rate_limited'){ msg.textContent = 'Rustig aan 🙂 je hebt het maximum voor dit uur bereikt.'; }
    else { msg.textContent = 'Mislukt: ' + (j.error||'unknown'); }
  }

  modal.querySelectorAll('button[data-kind]').forEach(b=>{
    b.addEventListener('click', ()=> send(b.getAttribute('data-kind')));
  });
})();
