(function(){
  const KEY='w0l0_clicks';
  const LIMIT=10;
  let lastTs=0;

  // audio core
  let ac, master;
  function initAudio(){
    if(ac) return;
    ac = new (window.AudioContext||window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.06;
    master.connect(ac.destination);
  }
  function tik(freq=1200, dur=0.035){
    initAudio();
    if(ac.state==='suspended'){ ac.resume(); }
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(1, ac.currentTime+0.005);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
    o.connect(g); g.connect(master);
    o.start();
    o.stop(ac.currentTime + dur + 0.02);
  }
  function chime(){
    initAudio();
    if(ac.state==='suspended'){ ac.resume(); }
    const now = ac.currentTime;
    [[880,0],[1318.5,0.08],[1760,0.16]].forEach(([f,dt])=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.value=f;
      g.gain.setValueAtTime(0, now+dt);
      g.gain.linearRampToValueAtTime(0.9, now+dt+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now+dt+0.22);
      o.connect(g); g.connect(master);
      o.start(now+dt); o.stop(now+dt+0.25);
    });
  }
  window._w0_chime = chime; // optioneel: beschikbaar in console

  function get(){ return parseInt(localStorage.getItem(KEY)||'0',10) }
  function set(v){ localStorage.setItem(KEY,String(v)) }
  function reset(){ localStorage.removeItem(KEY) }

  function bump(){
    const now=Date.now();
    if(now-lastTs<180) return; // debounce dubbele events
    lastTs=now;
    tik(); // sync tik op elke tap
    const c=get()+1;
    set(c);
    if(c>=LIMIT){ reset(); location.assign('/w0l0.html') }
  }

  function handler(e){
    if(!e.isTrusted) return;
    if(e.target && e.target.closest && e.target.closest('#stippy')) return;
    bump();
  }

  // unified input
  window.addEventListener('pointerup', handler, {passive:true});
  window.addEventListener('click',     handler, {passive:true});
  window.addEventListener('touchend',  handler, {passive:true});

  // favicon chime
  document.addEventListener('DOMContentLoaded', ()=>{
    const fav=document.getElementById('favicon-btn');
    if(fav){ fav.addEventListener('click', (e)=>{ e.preventDefault(); chime(); }, {passive:true}); }
  });
})();
