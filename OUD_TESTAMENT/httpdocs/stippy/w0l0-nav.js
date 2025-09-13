(function(){
  const KEY='w0l0_clicks';
  const LIMIT=10;
  let lastTs=0;

  // audio core (harder + bass), met compressor
  let ac, comp, outGain, unlocked=false;
  function initAudio(){
    if(ac) return;
    ac = new (window.AudioContext||window.webkitAudioContext)();
    comp = ac.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-24, ac.currentTime);
    comp.knee.setValueAtTime(15, ac.currentTime);
    comp.ratio.setValueAtTime(12, ac.currentTime);
    comp.attack.setValueAtTime(0.003, ac.currentTime);
    comp.release.setValueAtTime(0.25, ac.currentTime);
    outGain = ac.createGain();
    outGain.gain.value = 0.9; // volume boost (x ~15 tov eerder)
    comp.connect(outGain);
    outGain.connect(ac.destination);
  }
  function unlock(){
    if(unlocked) return;
    initAudio();
    const resume = ac.resume ? ac.resume() : Promise.resolve();
    resume.finally(()=>{
      try{
        const o=ac.createOscillator(), g=ac.createGain();
        o.type='sine'; o.frequency.value=440;
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        o.connect(g); g.connect(comp);
        o.start(); o.stop(ac.currentTime+0.02);
      }catch(_){}
      unlocked=true;
      ['pointerdown','touchstart','click','keydown'].forEach(t=>document.removeEventListener(t,onFirst,true));
    });
  }
  function onFirst(e){
    if(e.type==='keydown' && !(e.key===' '||e.key==='Enter')) return;
    unlock();
  }
  ['pointerdown','touchstart','click','keydown'].forEach(t=>document.addEventListener(t,onFirst,{capture:true,passive:true}));

  // loud tick + bass thump in sync
  function tik(){
    initAudio(); if(ac.state==='suspended'){ ac.resume(); }
    const t=ac.currentTime;

    // high click
    {
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='square'; o.frequency.setValueAtTime(1400,t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1.0, t+0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.05);
      o.connect(g); g.connect(comp);
      o.start(t); o.stop(t+0.07);
    }
    // bass thump (telefoon-bass is beperkt maar dit helpt)
    {
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.setValueAtTime(180,t);
      o.frequency.exponentialRampToValueAtTime(110, t+0.09);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1.0, t+0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.12);
      o.connect(g); g.connect(comp);
      o.start(t); o.stop(t+0.14);
    }
  }

  // ui: tap counter (n/10) rechtsboven
  let counterEl;
  function ensureCounter(){
    if(counterEl) return;
    const css = document.createElement('style');
    css.textContent = `
      #tap-counter{position:fixed;top:10px;right:10px;z-index:100000;
        background:#111a;border:1px solid #333;padding:.25rem .5rem;border-radius:.5rem;
        font:14px/1 ui-monospace,consolas,monospace;color:#eaeaea;backdrop-filter:blur(4px)}
      @media (prefers-color-scheme: light){#tap-counter{background:#fff9;color:#111;border-color:#ccc}}
      #tap-counter.bump{transform:scale(1.08)} `;
    document.head.appendChild(css);
    counterEl = document.createElement('div');
    counterEl.id = 'tap-counter';
    document.body.appendChild(counterEl);
    updateCounter();
  }
  function get(){ return parseInt(localStorage.getItem(KEY)||'0',10) }
  function set(v){ localStorage.setItem(KEY,String(v)) }
  function reset(){ localStorage.removeItem(KEY) }
  function updateCounter(){
    ensureCounter();
    const c = get();
    counterEl.textContent = c + '/' + LIMIT;
    counterEl.classList.remove('bump'); void counterEl.offsetWidth; counterEl.classList.add('bump');
    setTimeout(()=>counterEl.classList.remove('bump'),120);
  }

  function bump(){
    const now=Date.now();
    if(now-lastTs<180) return; // debounce dubbele events
    lastTs=now;
    tik();                      // sound
    const c=get()+1; set(c);    // count
    updateCounter();            // visual
    if(c>=LIMIT){ reset(); location.assign('/w0l0.html') }
  }

  function handler(e){
    if(!e.isTrusted) return;
    if(e.target && e.target.closest && e.target.closest('#stippy')) return;
    bump();
  }

  // input
  window.addEventListener('pointerup', handler, {passive:true});
  window.addEventListener('click',     handler, {passive:true});
  window.addEventListener('touchend',  handler, {passive:true});

  // favicon chime blijft werken via bestaand script (niet aangepast hier)

  document.addEventListener('DOMContentLoaded', ()=>{ ensureCounter(); updateCounter(); });
})();
