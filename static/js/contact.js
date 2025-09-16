(async function(){
  try{
    const r = await fetch('/api/config/contact-to');
    const { to=[] } = await r.json();
    const txt = to.join(' of ');
    // Plaatsen in elementen met data-contact-to
    document.querySelectorAll('[data-contact-to]').forEach(el => { el.textContent = txt; });
    // Eventueel anchors opbouwen
    document.querySelectorAll('[data-contact-to-links]').forEach(el => {
      el.innerHTML = to.map(m => `<a href="mailto:${m}">${m}</a>`).join(' of ');
    });
  }catch(e){ /* stilhouden */ }
})();
