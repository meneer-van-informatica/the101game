const c='the101game-cache-v20250912141619';
const assets=['/','/index.html','/manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(c).then(cache=>cache.addAll(assets)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==c&&caches.delete(k)))))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});




