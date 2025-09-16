// Client API helpers
window.API = (function(){
  const j = (url, body) => fetch(url, {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify(body||{})
  }).then(r=>r.json());

  function hello(alias, page, consentOnline){ return j('/api/profile/hello', { alias, page, consentOnline }); }
  function page(alias, p){ return j('/api/profile/page', { alias, page:p }); }
  function online(alias, consentOnline){ return j('/api/profile/online', { alias, consentOnline }); }
  function logout(alias){ return j('/api/profile/logout', { alias }); }
  function ping(alias, page){ return j('/api/profile/ping', { alias, page }); }
  function getProfile(alias){ return fetch(`/api/profile?alias=${encodeURIComponent(alias)}`, { cache:'no-store' }).then(r=>r.json()); }

  // beacon-style (best-effort)
  function beaconLogout(alias){
    try {
      navigator.sendBeacon('/api/profile/logout', new Blob([JSON.stringify({ alias })],{type:'application/json'}));
    } catch { /* noop */ }
  }

  return { hello, page, online, logout, ping, getProfile, beaconLogout };
})();

