(function(){
  const KEY='w0l0_clicks';
  const LIMIT=10;
  let lastTs=0;

  // audio core + unlock voor mobiel
  let ac, master, unlocked=false;
  function initAudio(){
    if(ac) return;
    ac = new (window.AudioContext||window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.08;
    master.connect(ac.destination);
  }
  function unlock(){
    if(unlocked) return;
    initAudio();
    // resume + ultra-kort bijna-silent tikje om safari/ios te unlocken
    const resume = ac.resume ? ac.resume() : Promise.resolve();
    resume.finally(()=>{
      try{
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type='sine'; o.frequency.value=440;
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        o.connect(g); g.connect(master);
        o.start();
        o.stop(ac.currentTime+0.02);
      }catch(_){}
      unlocked=true;
      // listeners opruimen na unlock
      ['pointerdown','touchstart','click','keydown'].forEach(t=>document.removeEventListener(t,onFirst,true));
    });
  }
  function onFirst(e){
    if(e.type==='keydown' && !(e.key===' ' || e.key==='Enter')) return;
    unlock();
  }
  ['pointerdown','touchstart','click','keydown'].forEach(t=>document.addEventListener(t,onFirst,{capture:true,passive:true}));

  function tik(freq=1200, dur=0.035){
    initAudio(); if(ac.state==='suspended'){ ac.resume(); }
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type='square'; o.frequency.value=freq;
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(1, ac.currentTime+0.005);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ac.currentTime+dur+0.02);
  }
  function chime(){
    initAudio(); if(ac.state==='suspended'){ ac.resume(); }
    const t = ac.currentTime;
    const tones = [[880,0],[1318.5,0.08],[1760,0.16]];
    for(const [f,dt] of tones){
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.value=f;
      g.gain.setValueAtTime(0, t+dt);
      g.gain.linearRampToValueAtTime(0.9, t+dt+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dt+0.24);
      o.connect(g); g.connect(master);
      o.start(t+dt); o.stop(t+dt+0.26);
    }
  }
  window._w0_chime = chime;

  function get(){ return parseInt(localStorage.getItem(KEY)||'0',10) }
  function set(v){ localStorage.setItem(KEY,String(v)) }
  function reset(){ localStorage.removeItem(KEY) }

  function bump(){
    const now=Date.now();
    if(now-lastTs<180) return; // debounce dubbele events
    lastTs=now;
    tik(); // sync tik
    const c=get()+1; set(c);
    if(c>=LIMIT){ reset(); location.assign('/w0l0.html') }
  }

  function handler(e){
    if(!e.isTrusted) return;
    if(e.target && e.target.closest && e.target.closest('#stippy')) return;
    bump();
  }

  // unified input voor taps/clicks
  window.addEventListener('pointerup', handler, {passive:true});
  window.addEventListener('click',     handler, {passive:true});
  window.addEventListener('touchend',  handler, {passive:true});

  // favicon chime op échte user-gesture (pointerdown = sneller op mobiel)
  document.addEventListener('DOMContentLoaded', ()=>{
    const fav=document.getElementById('favicon-btn');
    if(!fav) return;
    const play = (e)=>{ e.preventDefault(); chime(); };
    fav.addEventListener('pointerdown', play, {passive:false});
    fav.addEventListener('click',       play, {passive:false});
    fav.addEventListener('keydown',     (e)=>{ if(e.key===' '||e.key==='Enter'){ play(e) } }, {passive:false});
  });
})();
