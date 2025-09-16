(function(){
  function parseCounter(){
    const el=document.getElementById('counter'); if(!el) return null;
    const m=(el.textContent||'').match(/(-?\d+)\s*\/\s*(\d+)/);
    if(!m) return null; return { idx: parseInt(m[1],10), total: parseInt(m[2],10) };
  }
  function renderLobby(){
    const page=document.getElementById('page')||document.body;
    const box=document.createElement('div');
    box.style.cssText='max-width:980px;margin:70px auto 24px;padding:16px;border:1px solid #2b3440;border-radius:12px;background:#0f141a;color:#e9eef2;text-align:left';
    const pre=document.createElement('pre');
    pre.style.cssText='font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;line-height:1.25;white-space:pre';
    pre.textContent =
`KUKEL HOTEL — LOBBY (0000 / 5200)
┌─────────────────────────────────────────────┐
│  @ jij (alias)                              │
│                                             │
│  [·] planten    [#] bank        [=] balie   │
│                                             │
│  Deur → (druk F voor pagina 0001)          │
└─────────────────────────────────────────────┘`;
    const btn=document.createElement('button');
    btn.textContent='▶  8-bit muziek';
    btn.style.cssText='margin-top:10px;padding:8px 12px;border:1px solid #2b3440;border-radius:10px;background:#121a24;color:#e9eef2;cursor:pointer';
    btn.addEventListener('click', ()=> { try{ Music.playLobby(); }catch(_){ } btn.disabled=true; btn.textContent='♫ speelt…'; });
    box.appendChild(pre); box.appendChild(btn);
    page.innerHTML=''; page.appendChild(box);
  }
  function maybeLobby(){
    const c=parseCounter(); if(!c) return;
    // lobby op -0001 (persoonlijk), 0000 is publieke lobby — jij wil 0000 als start
    if (c.idx === 0 || c.idx === 0000) renderLobby();
  }
  window.addEventListener('load', maybeLobby);
})();
