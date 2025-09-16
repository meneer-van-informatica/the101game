(function(){
  // Korte safety: zet PageCtx.index=0 (Lobby) voor "Start".
  window.PageCtx = window.PageCtx || {}; 
  window.PageCtx.index = 0;

  const $ = (s)=>document.querySelector(s);
  const gh = $('#btn-gh');
  const go = $('#btn-start');

  if (gh) gh.addEventListener('click', ()=>{ location.href='/api/auth/github/login'; });
  if (go) go.addEventListener('click', ()=>{
    // naar Lobby (0000 / 5200) binnen huidige site
    if (window.Pager && Pager.go) Pager.go(0); else location.href = '/';
  });
})();
