/* Tirvo — service worker: app instalável, funciona com internet fraca e recebe notificações. */
const VERSION = "tirvo-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const IMG_CACHE = `${VERSION}-img`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/favicon.svg", "/icon-192.png", "/icon-512.png", "/brand/tirvo-logo-para-fundo-escuro.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/")) return;

  // Arquivos do build: cache primeiro (têm hash no nome).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Imagens de produtos: cache primeiro, atualiza em segundo plano.
  if (url.pathname.startsWith("/uploads/")) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok) c.put(req, res.clone()).then(() => trim(IMG_CACHE, 300));
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  // Páginas: rede primeiro; sem internet, mostra a última versão ou a página offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(PAGES_CACHE).then((c) => c.put(req, copy).then(() => trim(PAGES_CACHE, 40)));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE_URL))),
    );
  }
});

// Notificações push (promoções e avisos)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Tirvo", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Tirvo";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/favicon-32.png",
    image: data.image || undefined,
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url === target && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
