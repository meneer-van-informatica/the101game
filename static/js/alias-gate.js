(function () {
  function getCookie(name){ const m=document.cookie.match('(?:^|;)\\s*'+name+'=([^;]*)'); return m?decodeURIComponent(m[1]):''; }
  function setCookie(name,val,days){ document.cookie = name+'='+encodeURIComponent(val)+'; Max-Age='+(days*86400)+'; Path=/; SameSite=Lax; Secure'; }
  async function sendAlias(alias){ try{ await fetch('/api/alias',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({alias})}); }catch(e){} }
  async function promptAlias(){
    let a=(getCookie('alias')||'').toUpperCase();
    if(a && /^[A-Z0-9]{4}$/.test(a)){ sendAlias(a); return; }
    while(true){
      a=(window.prompt('Voer je alias (4 tekens), bijv. LUCA:', 'LUCA')||'').trim().toUpperCase();
      if(!a) return;
      if(/^[A-Z0-9]{4}$/.test(a)){ setCookie('alias',a,365); await sendAlias(a); break; }
      alert('Alias moet exact 4 tekens (A–Z/0–9). Probeer opnieuw.');
    }
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',promptAlias); } else { promptAlias(); }
})();
