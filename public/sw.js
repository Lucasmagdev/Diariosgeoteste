// Service Worker para PWA - Geoteste
//
// v1 cacheava "/" e "/index.html" com estrategia cache-first sem nunca
// expirar: uma vez visitado, o navegador ficava preso pra sempre no HTML
// (e portanto no bundle JS com hash) da visita, porque o cache nunca era
// invalidado entre deploys (nome de cache fixo) e o fetch handler nunca
// ia na rede se ja tinha algo em cache. Todo deploy novo ficava invisivel
// pra quem ja tinha aberto o site antes.
//
// v2: HTML/navegacao sempre busca rede primeiro (cai pro cache soh se
// estiver offline). So os assets com hash no nome (imutaveis por build,
// em /assets/) usam cache-first.
const CACHE_NAME = 'geoteste-v2';
const PRECACHE_URLS = [
  '/logogeoteste.png',
  '/logogeoteste.jpeg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const isNavigation = request.mode === 'navigate' || request.destination === 'document';
  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request.clone()).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return response;
      });
    })
  );
});
