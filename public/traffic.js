/* the101game — traffic beacon */
(function(){
  const KEY="the101.did";
  let did = localStorage.getItem(KEY);
  try { if(!did){ did = (crypto.randomUUID? crypto.randomUUID() : (Date.now()+"-"+Math.random().toString(16).slice(2))); localStorage.setItem(KEY,did); } } catch(e) {}
  const p = location.pathname + location.search;
  const url = "/t/ingest?did="+encodeURIComponent(did||"na")+"&p="+encodeURIComponent(p);
  if(navigator.sendBeacon){ try{ navigator.sendBeacon(url); return; }catch(e){} }
  fetch(url, {method:"GET", mode:"no-cors", keepalive:true}).catch(()=>{});
})();
