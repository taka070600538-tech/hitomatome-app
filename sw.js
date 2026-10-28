// manifest(manifest.json)はキャッシュしない: インストール判定に常に最新版を使わせるため
// (キャッシュ優先だと、一度取り込んだ古いmanifestが更新後も配信され続ける)
const CACHE_NAME = 'daily-summary-v15';
// Cache Storage は同じオリジンの他の PWA と共有なので、片付けは自分の接頭辞の箱だけにする
const CACHE_PREFIX = CACHE_NAME.replace(/v\d+$/, '');
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/timelineView.js',
  './js/settingsView.js',
  './js/syncUrl.js',
  './js/format.js',
  './js/idbRead.js',
  './js/mealSummary.js',
  './js/printRequest.js',
  './js/settings.js',
  './js/sheet.js',
  './js/sources.js',
  './js/timeline.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  // GitHub Pagesはmax-age=600で配信するため、通常のfetchだとブラウザのHTTPキャッシュに残った
  // 古いJSを新しいCACHE_NAMEのキャッシュに取り込んでしまう。cache:'reload'で必ずサーバーから取得する。
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    // start_url に付けた ?pwa=… のようなクエリを無視して './' のキャッシュに当てる
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || fetch(event.request))
  );
});
