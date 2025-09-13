/* SW autogen  */
const CACHE_NAME = 'the101game-';
self.addEventListener('install', e => { e.waitUntil((async()=>{ self.skipWaiting(); await caches.open(CACHE_NAME); })()); });
self.addEventListener('activate', e => { e.waitUntil((async()=>{ for (const k of await caches.keys()) { if (k!==CACHE_NAME) await caches.delete(k); } await self.clients.claim(); })()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  e.respondWith((async()=>{
    try { const net = await fetch(req); try{const c=await caches.open(CACHE_NAME); c.put(req, net.clone());}catch{} return net; }
    catch { const hit = await caches.match(req); if (hit) return hit; throw new Error('offline and not cached'); }
  })());
});
