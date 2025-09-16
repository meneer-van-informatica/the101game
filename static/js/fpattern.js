(function(){
  // --- helpers: tekstbreedte meten ---
  function measure(word, base=16, font="800 1px system-ui,Segoe UI,Roboto,Arial,sans-serif"){
    // maak hidden measurer
    let meter = document.getElementById('__fit_meter__');
    if(!meter){
      meter = document.createElement('span');
      meter.id='__fit_meter__';
      meter.style.cssText='position:absolute;left:-9999px;top:-9999px;white-space:pre;visibility:hidden;';
      document.body.appendChild(meter);
    }
    meter.style.font = font.replace('1px', base+'px');
    meter.textContent = word;
    return meter.getBoundingClientRect().width;
  }

  // --- zet font-size zo dat 'LUIE' past met 1% marge links/rechts ---
  function fitLuie(el, word='LUIE', marginPct=0.01, min=12, max=180){
    const rect = el.getBoundingClientRect();
    const target = rect.width * (1 - marginPct*2);
    if (target <= 0) return;
    let lo=min, hi=max, best=min;
    for(let k=0;k<20;k++){
      const mid = (lo+hi)/2;
      const w = measure(word, mid);
      if (w <= target){ best = mid; lo = mid; } else { hi = mid; }
    }
    el.style.fontSize = best.toFixed(2)+'px';
    el.style.marginLeft = (rect.width*marginPct)+'px';
    el.style.marginRight = (rect.width*marginPct)+'px';
  }

  // --- F-pattern compositie (fixed blocks) ---
  function ensureBlocks(){
    if (document.querySelector('.f-wrap')) return;
    const wrap = document.createElement('div'); wrap.className='f-wrap';

    const rail = document.createElement('div'); rail.className='f-rail';
    rail.innerHTML = `
      <div class="block">Scorebord (live)</div>
      <div class="block">Status · Online · Page</div>
    `;

    const hero = document.createElement('div'); hero.className='f-hero';
    hero.innerHTML = `
      <h1 id="center-title" class="fit-luie" style="font-weight:800">
        the<br>101<br>GAME<br>is<br>a<br>LUIE<br>SLAK
      </h1>
    `;

    const sec = document.createElement('div'); sec.className='f-secondary';
    sec.innerHTML = `
      <div class="block">KPI 1</div>
      <div class="block">KPI 2</div>
      <div class="block">KPI 3</div>
    `;

    wrap.appendChild(rail);
    wrap.appendChild(hero);
    wrap.appendChild(sec);
    document.body.appendChild(wrap);

    // IDEEËNBUS
    if(!document.getElementById('idea-inbox-btn')){
      const btn=document.createElement('button');
      btn.id='idea-inbox-btn'; btn.textContent='IDEEËNBUS';
      btn.addEventListener('click',()=> openIdeas());
      document.body.appendChild(btn);
    }
    if(!document.getElementById('idea-modal')){
      const modal=document.createElement('div'); modal.id='idea-modal';
      modal.innerHTML=`
        <div id="idea-panel">
          <h3>Tips & Tops</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin:6px 0">
            <input id="idea-alias" placeholder="alias" style="flex:1;min-height:40px;border:1px solid #2b3440;background:#121a24;color:#e9eef2;border-radius:10px;padding:8px 10px;">
            <select id="idea-type" style="flex:1;min-height:40px;border:1px solid #2b3440;background:#121a24;color:#e9eef2;border-radius:10px;padding:8px 10px;">
              <option value="tip">TIP</option>
              <option value="top">TOP</option>
            </select>
          </div>
          <textarea id="idea-text" rows="5" placeholder="Schrijf je idee..."
            style="width:100%;min-height:120px;border:1px solid #2b3440;background:#121a24;color:#e9eef2;border-radius:10px;padding:10px"></textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
            <button id="idea-cancel">Sluiten</button>
            <button id="idea-send">Verstuur</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.style.display='none';
      modal.addEventListener('click',e=>{ if(e.target===modal) modal.style.display='none'; });
      modal.querySelector('#idea-cancel').addEventListener('click',()=> modal.style.display='none');
      modal.querySelector('#idea-send').addEventListener('click',async()=>{
        const alias=(document.getElementById('idea-alias').value||'').trim().slice(0,24);
        const kind=document.getElementById('idea-type').value;
        const text=(document.getElementById('idea-text').value||'').trim();
        try{
          const r=await fetch('/api/ideas',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias,kind,text})});
          if(!r.ok) throw new Error('HTTP '+r.status);
        }catch(_){}
        modal.style.display='none';
      });
      window.openIdeas = ()=>{ modal.style.display='grid'; };
    }

    // Fit op "LUIE" — zodra er ruimte is
    const tgt = document.getElementById('center-title');
    if(tgt){ const doFit=()=> fitLuie(tgt,'LUIE',0.01,12,220); doFit(); window.addEventListener('resize', doFit); }
  }

  window.addEventListener('load', ensureBlocks);
})();
