// SRT-gedreven loader die ~10s duurt (afhankelijk van scene0.srt).
(function(){
  async function fetchText(url){ const r = await fetch(url, {cache:'no-store'}); if(!r.ok) throw new Error(r.status); return r.text(); }

  // Heel simpele SRT-parser (cue nummer -> tijdsrange -> tekstregels)
  function parseSRT(s){
    const blocks = s.replace(/\r/g,'').trim().split(/\n\n+/);
    const cues = [];
    for(const b of blocks){
      const lines = b.split('\n');
      // formaten: idx? daarna "hh:mm:ss,ms --> hh:mm:ss,ms"
      let i = 0;
      if (/^\d+$/.test(lines[0])) i = 1;
      const m = lines[i].match(/(\d+):(\d+):(\d+),(\d+)\s+-->\s+(\d+):(\d+):(\d+),(\d+)/);
      if(!m) continue;
      const toMs = (h,mn,s,ms)=> ((+h*3600 + +mn*60 + +s)*1000 + +ms);
      const t0 = toMs(m[1],m[2],m[3],m[4]);
      const t1 = toMs(m[5],m[6],m[7],m[8]);
      const text = lines.slice(i+1).join('\n');
      cues.push({t0, t1, text});
    }
    cues.sort((a,b)=>a.t0-b.t0);
    return cues;
  }

  function schedule(cues){
    const el = document.getElementById('loader');
    const line = document.getElementById('loader-line');
    if(!el || !line) return;
    const tStart = performance.now();
    const handles = [];

    for(const c of cues){
      handles.push(setTimeout(()=>{ line.textContent = c.text; }, c.t0));
    }

    const total = cues.length ? cues[cues.length-1].t1 : 10000; // fallback 10s
    handles.push(setTimeout(()=>{
      el.style.opacity='0';
      setTimeout(()=> el.remove(), 400);
    }, total));

    // failsafe hard-cap 12s
    handles.push(setTimeout(()=>{
      try{ el.remove(); }catch{}
    }, Math.max(12000,total+1500)));
  }

  async function boot(){
    try{
      const srt = await fetchText('/scene0.srt');
      const cues = parseSRT(srt);
      if(!cues.length) throw new Error('empty srt');
      schedule(cues);
    }catch(e){
      // fallback tekst + 10s timer
      const line = document.getElementById('loader-line');
      const el = document.getElementById('loader');
      if(line) line.textContent = 'the\n101\nGAME';
      setTimeout(()=>{ if(el){ el.style.opacity='0'; setTimeout(()=>el.remove(), 350); } }, 10000);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

