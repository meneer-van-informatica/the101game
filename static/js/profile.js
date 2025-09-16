(function(){
  const qs = new URLSearchParams(location.search);
  const alias = decodeURIComponent(location.pathname.split('/').pop() || '').trim() || qs.get('alias') || 'Player';
  document.getElementById('title').textContent = '@' + alias;

  function fmtTime(ms){
    const s = Math.floor((ms||0)/1000);
    const m = Math.floor(s/60), r = s%60;
    if (m >= 60) { const h = Math.floor(m/60); const mm = m%60; return `${h}h ${mm}m`; }
    return `${m}m ${r}s`;
  }
  function fmtDate(d){
    if (!d) return '–';
    const t = new Date(d); if (isNaN(+t)) return '–';
    return t.toLocaleString();
  }

  fetch(`/api/profile?alias=${encodeURIComponent(alias)}`, { cache:'no-store' })
    .then(r=>r.json()).then(j=>{
      const p = j.profile || {};
      document.getElementById('k-page').textContent     = `${p.lastPage ?? 0} / 101`;
      document.getElementById('k-kukel').textContent    = `${p.kukel ?? 0}`;
      document.getElementById('k-online').textContent   = p.consentOnline ? 'ON' : 'OFF';
      document.getElementById('k-sessions').textContent = `${p.sessions ?? 0}`;
      const totalMs = (p.totalMs || 0) + (p.sessionStartAt ? (Date.now()-new Date(p.sessionStartAt)) : 0);
      document.getElementById('k-time').textContent     = fmtTime(totalMs);
      document.getElementById('k-seen').textContent     = fmtDate(p.lastSeenAt || p.lastLoginAt);
      document.getElementById('k-created').textContent  = fmtDate(p.createdAt);
    }).catch(()=>{
      document.getElementById('k-page').textContent='–';
    });
})();

