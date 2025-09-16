(function(){
  let ctx=null, nodes=[];
  function ac(){ return ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)()); }
  function note(freq, t0, dur, type='square', vol=0.06){
    const c=ac(), o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.value=vol;
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0+dur);
    nodes.push(o,g);
  }
  function stopAll(){ try{nodes.forEach(n=>n.disconnect&&n.disconnect());}catch(_){ } nodes=[]; if(ctx?.state==='running'){/* keep ctx */} }
  function playLobby(){
    const c=ac(); const start=c.currentTime+0.05; const sp=0.22;
    const scale=[261.63,293.66,329.63,349.23,392.00,440.00,493.88]; // C maj
    for(let i=0;i<16;i++){
      const t=start+i*sp;
      const f1=scale[(i*2)%scale.length], f2=scale[(i*3+1)%scale.length];
      note(f1, t, sp*0.9,'square',0.045);
      note(f2/2, t, sp*0.9,'triangle',0.03);
      if(i%4===0) note(110, t, sp*0.9,'sawtooth',0.02); // kicky bass
    }
    // loop every ~3.5s
    setTimeout(()=>{ stopAll(); playLobby(); }, 3500);
  }
  window.Music = { playLobby, stopAll };
})();
