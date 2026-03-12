/* ============================================================
   SERVICE WORKER — TEXT EDITOR PRO ULTRA
   Usa paths RELATIVOS para funcionar em qualquer subpasta
   do GitHub Pages (ex: usuario.github.io/editor-ultra/)
   ============================================================ */
const V         = 'v5';
const CACHE_APP = 'app-' + V;
const CACHE_CDN = 'cdn-' + V;

// Todos os arquivos locais — paths relativos à localização do sw.js
const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './tabs.js',
  './editor.js',
  './terminal.js',
  './backup.js',
  './crypto.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const CDN_FILES = [
  'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(CACHE_APP).then(c =>
      Promise.allSettled(APP_FILES.map(u => c.add(u).catch(err => console.warn('[SW] skip:', u, err.message))))
    ),
    caches.open(CACHE_CDN).then(c =>
      Promise.allSettled(CDN_FILES.map(u => c.add(u).catch(err => console.warn('[SW] skip CDN:', u))))
    )
  ]));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_APP && k !== CACHE_CDN).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.startsWith('chrome-extension:') || url.includes('hot-update')) return;

  const isCDN = url.includes('cdnjs.') || url.includes('fonts.google') || url.includes('fonts.gstatic');

  e.respondWith(
    caches.open(isCDN ? CACHE_CDN : CACHE_APP).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached && !isCDN) return cached; // cache-first para app
        // network-first para CDN, fallback para cache
        return fetch(e.request)
          .then(res => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cached || new Response('Offline - recurso não disponível', { status: 503 }));
      })
    )
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
