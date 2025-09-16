(function(){
  // voeg klok span toe als hij nog niet bestaat
  const hud = document.getElementById('hud');
  if (!hud) return;
  let sep = document.createElement('span'); sep.textContent = '·'; sep.style.opacity = .7; sep.style.margin = '0 .35rem';
  let sp = document.createElement('span'); sp.id = 'clock'; sp.style.fontWeight = '600';
  hud.appendChild(sep); hud.appendChild(sp);

  function pad2(n){ return String(n).padStart(2,'0'); }
  function fmt(d){
    const y=d.getFullYear(), m=pad2(d.getMonth()+1), da=pad2(d.getDate());
    const h=pad2(d.getHours()), mi=pad2(d.getMinutes()), s=pad2(d.getSeconds());
    return `${y}-${m}-${da} ${h}:${mi}:${s}`;
  }
  function tick(){ sp.textContent = fmt(new Date()); }
  tick(); setInterval(tick, 1000);
})();
