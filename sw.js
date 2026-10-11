/**
 * 画面ファイルを端末に保存しておく仕組み（サービスワーカー）
 *
 * ・開くときは保存済みのファイルを即座に使い、裏で最新版を取りに行く
 *   （更新した画面は「次に開いたとき」に反映される）
 * ・電波が無くても画面を開いて入力できる
 * ・GASとの通信（POST）には一切手を出さない
 */
const CACHE = 'kakeibo-v1';
const CORE = ['./', './index.html', './manifest.json', './icon.svg'];
const CHART_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';

// 初回：画面の基本ファイルを保存する
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

// 新しい版になったら古い保存分を消す
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// 読み込み：保存分があればすぐ返し、裏で最新版に差し替えておく
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isOwn = url.origin === self.location.origin;
  if (!isOwn && req.url !== CHART_URL) return;

  const cachedPromise = caches.match(req, { ignoreSearch: isOwn });
  const networkPromise = fetch(req)
    .then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
      }
      return res;
    })
    .catch(() => null);

  event.waitUntil(networkPromise);
  event.respondWith(
    cachedPromise.then(cached => cached || networkPromise.then(res => res || Response.error()))
  );
});
