(function(){
  const elSel='[data-now]';
  function show(msg){ const el=document.querySelector(elSel); if(el) el.textContent=msg; }
  async function tick(){
    try{
      show('Connecting to Spotify…');
      const r = await fetch('/spotify/now.php?mode=json&t='+Date.now(), {cache:'no-store'});
      if(!r.ok) { show('Spotify: unavailable'); return; }
      const j = await r.json();
      const src = j.source || 'Spotify';
      const artists = (j.artists||[]).join(', ');
      const track = j.track || '—';
      const yr = j.year ? ` (${j.year})` : '';
      show(`I'm listening to ${src}: ${artists} – ${track}${yr}`);
    } catch(e){ show('Spotify: error'); }
  }
  document.addEventListener('DOMContentLoaded',()=>{ tick(); setInterval(tick,20000); });
})();
