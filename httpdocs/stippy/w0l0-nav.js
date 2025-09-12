(function(){
  const KEY='w0l0_clicks';
  const LIMIT=10;
  function get(){ return parseInt(localStorage.getItem(KEY)||'0',10) }
  function set(v){ localStorage.setItem(KEY,String(v)) }
  function reset(){ localStorage.removeItem(KEY) }
  function bump(){
    const c=get()+1; set(c);
    if(c>=LIMIT){ reset(); location.assign('/w0l0.html') }
  }
  window.addEventListener('click', e=>{
    if(!e.isTrusted) return;            // echte userclicks
    if(e.target && e.target.closest && e.target.closest('#stippy')) return; // stippy zelf telt niet
    bump();
  }, {passive:true});
})();
