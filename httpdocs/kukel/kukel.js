(function(){
  function ensureMount(){
    if (document.getElementById('kukel-wrap')) return;
    var div = document.createElement('div');
    div.id = 'kukel-wrap';
    div.innerHTML = "<a id='kukel-link' href='/blockchain'>kukel</a><span id='kukel-count'>: +0</span>";
    document.body.appendChild(div);
  }

  function updateKukel(){
    var url = "/api/chain.php?op=append&path=" + encodeURIComponent(location.pathname);
    fetch(url, {credentials:'same-origin'}).then(r=>r.json()).then(j=>{
      if (!j || !j.ok) return;
      var n = typeof j.length==='number' ? j.length : 0;
      var span = document.getElementById('kukel-count');
      if (span) span.textContent = ": +" + n;
    }).catch(()=>{});
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') { ensureMount(); updateKukel(); }
  else document.addEventListener('DOMContentLoaded', function(){ ensureMount(); updateKukel(); }, {once:true});
})();
