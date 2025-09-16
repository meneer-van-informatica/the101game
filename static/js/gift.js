(function(){
  const aliasKey='the101game.alias';
  const me = localStorage.getItem(aliasKey) || 'Player';

  // appbar
  const bar = document.createElement('div');
  bar.className='appbar';
  bar.innerHTML = `
    <a class="btn" id="btn-build" href="https://github.com/meneer-van-informatica/the101game" target="_blank" rel="noopener">BOUW MEE</a>
    <button class="btn" id="btn-gift" type="button">GIFT</button>
  `;
  document.body.appendChild(bar);

  // toast
  const toast = document.createElement('div'); toast.id='toast'; document.body.appendChild(toast);
  function showToast(msg){ toast.textContent = msg; toast.style.display='block'; setTimeout(()=> toast.style.display='none', 2200); }

  // modal
  const modal = document.createElement('div'); modal.id='gift-modal';
  modal.innerHTML = `
    <div id="gift-panel">
      <h3>Gift KUKEL</h3>
      <div class="row"><input id="gift-from" placeholder="van (alias)" value="${me}"></div>
      <div class="row"><select id="gift-to"></select></div>
      <div class="row"><input id="gift-amt" type="number" min="1" step="1" placeholder="aantal kukel (min 1)"></div>
      <div class="actions">
        <button id="gift-cancel">Sluiten</button>
        <button id="gift-send">Verstuur</button>
      </div>
      <small style="opacity:.75">Alleen hele getallen. Zichtbare gebruikers (online of bekend) staan in de lijst.</small>
    </div>`;
  document.body.appendChild(modal);

  function openModal(){ modal.style.display='grid'; loadAliases(); }
  function closeModal(){ modal.style.display='none'; }
  modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });
  document.getElementById('btn-gift').addEventListener('click', openModal);
  modal.querySelector('#gift-cancel').addEventListener('click', closeModal);

  async function loadAliases(){
    try{
      const r = await fetch('/api/aliases', {cache:'no-store'}); const j = await r.json();
      const sel = modal.querySelector('#gift-to'); sel.innerHTML='';
      const list = (j.aliases || [])
        .map(a=>a.alias)
        .filter(a=>a && a!== (modal.querySelector('#gift-from').value||me))
        .sort((a,b)=> a.localeCompare(b, undefined, {sensitivity:'base'}));
      for (const a of list){
        const o = document.createElement('option'); o.value=a; o.textContent=a; sel.appendChild(o);
      }
    }catch{ /* ignore */ }
  }

  async function sendGift(){
    const from = modal.querySelector('#gift-from').value.trim() || me;
    const to = modal.querySelector('#gift-to').value;
    const amt = Math.max(1, parseInt(modal.querySelector('#gift-amt').value,10)||0);
    if (!to) return showToast('Kies een ontvanger');
    try{
      const r = await fetch('/api/kukel/gift', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ from, to, amount: amt })
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'gift failed');
      // update saldo badge als aanwezig
      const bEl = document.getElementById('kukel-balance');
      if (bEl && j.balances && j.balances[from]!=null) bEl.textContent = j.balances[from];
      showToast(`Gift OK: ${amt} → ${to}`);
      closeModal();
    }catch(e){ showToast(e.message || String(e)); }
  }
  modal.querySelector('#gift-send').addEventListener('click', sendGift);
})();
