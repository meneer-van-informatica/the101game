const VER = '20250912141740';
const CORE = ['/', '/index.html', '/w0l0.html', '/stippy/w0l0-nav.js', '/manifest.webmanifest'];
const STATIC_CACHE = 'the101game-static-' + VER;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(CORE)).catch(()=>{}));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('the101game-static-') && k !== STATIC_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isHtml(req){ return req.mode === 'navigate' || (req.headers && req.headers.get('accept') || '').includes('text/html'); }
function isHot(req){
  const u = new URL(req.url);
  return isHtml(req) || ['/stippy/w0l0-nav.js','/sw.js'].includes(u.pathname);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (isHot(req)) {
    // network-first for html + hot js
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(STATIC_CACHE);
        cache.put(req, fresh.clone()).catch(()=>{});
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || new Response('offline', { status: 503 });
      }
    })());
    return;
  }

  // stale-while-revalidate for other assets
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchPromise = fetch(req).then(res => {
      caches.open(STATIC_CACHE).then(c => c.put(req, res.clone())).catch(()=>{});
      return res;
    }).catch(()=>cached);
    return cached || fetchPromise;
  })());
});

// notify clients when updated sw takes control
self.addEventListener('message', async (e) => {
  if (e.data && e.data.type === 'GET_VER') {
    e.source.postMessage({ type: 'VER', ver: VER });
  }
});



































