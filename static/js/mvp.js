(function(){
  // Page counter (CLAP #5)
  var idx = 0; // MVP: lobby
  var s = String(Math.max(0, Math.min(5200, idx))).padStart(4,'0');
  var pc = document.getElementById('pageCounter'); if (pc) pc.textContent = s + ' / 5200';

  const $ = sel => document.querySelector(sel);
  const aliasInput = $('#aliasInput');
  const aliasBtn   = $('#aliasBtn');
  const aliasMsg   = $('#aliasMsg');
  const helloSec   = $('#helloSection');
  const hello      = $('#hello');
  const kukelLbl   = $('#mobKukel');
  const kukelBtn   = $('#kukelBtn');

  function cleanAlias(v){ return String(v||'').trim().slice(0,3); }

  aliasInput && aliasInput.addEventListener('input', e=>{
    e.target.value = cleanAlias(e.target.value);
  });

  async function claim(alias){
    const r = await fetch('/api/alias/claim', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ alias })
    });
    if (!r.ok){
      if (r.status===429) throw new Error('Te vaak geprobeerd (max 3 per uur).');
      throw new Error('Alias claim mislukt');
    }
    return r.json();
  }

  async function kukel(alias){
    const r = await fetch('/api/kukel/click', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ alias })
    });
    if (!r.ok) throw new Error('Kukel klik mislukt');
    return r.json();
  }

  aliasBtn && aliasBtn.addEventListener('click', async ()=>{
    const a = cleanAlias(aliasInput.value);
    if (!a){ aliasMsg.textContent = 'Alias vereist (max 3 tekens)'; return; }
    try{
      aliasMsg.textContent = 'Bezig…';
      await claim(a);
      aliasMsg.textContent = '';
      helloSec.style.display = '';
      hello.textContent = `Hoi ${a},`;
      kukelLbl.textContent = 'Je hebt 0.0 kukel…';

      // optioneel eerste klik verbergen of tonen:
      kukelBtn.addEventListener('click', async ()=>{
        try{
          const j = await kukel(a);
          kukelLbl.textContent = `Je hebt ${(+j.kukel).toFixed(1)} kukel…`;
        }catch(e){ console.error(e); }
      }, { once:false });

    }catch(e){
      aliasMsg.textContent = e.message || 'Er ging iets mis.';
    }
  });
})();
