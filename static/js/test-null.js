(function(){
  // alleen draaien op pagina 0001
  if (!window.PageCtx || window.PageCtx.index !== 1) return;

  const root = document.getElementById('run') || document.body;
  const wrap = document.createElement('div');
  wrap.style.padding = '12px';

  const h = (tag, attrs, html)=>{ const n=document.createElement(tag); for(const k in (attrs||{})) n.setAttribute(k, attrs[k]); if(html) n.innerHTML=html; return n; };

  const form = h('form', { id:'test-null-form', autocomplete:'off' });
  form.innerHTML = `
    <h2>TEST NULL</h2>
    <p>Wat is je mailadres?</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input id="tn-email" type="email" placeholder="jij@school.nl" required
             style="min-width:260px;padding:.6rem .7rem;border-radius:10px;border:1px solid #2b3440;background:#121a24;color:#e9eef2">
      <button type="submit" style="padding:.6rem 1rem;border-radius:10px;border:1px solid #2b3440;background:#182333;color:#e9eef2;cursor:pointer">
        Verstuur
      </button>
    </div>
    <div id="tn-msg" style="margin-top:10px;opacity:.9"></div>
  `;

  async function status(alias){
    const r = await fetch(`/api/test/null/status?alias=${encodeURIComponent(alias)}`);
    return r.ok ? r.json() : { ok:false };
  }
  async function submit(alias,email){
    const r = await fetch('/api/test/null/submit', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ alias, email })
    });
    return r;
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const alias = localStorage.getItem('the101game.alias') || '';
    const email = document.getElementById('tn-email').value.trim();
    const msg = document.getElementById('tn-msg');

    if (!alias){ msg.textContent = 'Geen alias gevonden. Stel eerst je alias in.'; return; }
    msg.textContent = 'Bezig…';
    const res = await submit(alias,email);
    if (res.status === 429){
      msg.textContent = 'Te veel pogingen. Probeer later opnieuw (rate limit).';
      return;
    }
    const j = await res.json();
    msg.textContent = j.ok ? 'Opgeslagen ✅' : `Mislukt: ${j.error||res.status}`;
  });

  wrap.appendChild(form);
  root.innerHTML = ''; // maak paneel schoon
  root.appendChild(wrap);

  // status tonen (al ingevuld?)
  const alias = localStorage.getItem('the101game.alias') || '';
  if (alias){
    status(alias).then(j=>{
      if (j?.hasEmail){
        const m = document.getElementById('tn-msg');
        m.textContent = 'We hebben al een mailadres. Je kunt later aanpassen.';
      }
    }).catch(()=>{});
  }
})();
