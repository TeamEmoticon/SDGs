const CACHE_NAME = "ansimgle-shell-v1";
const OFFLINE_RESPONSE = "인터넷 연결을 확인한 뒤 다시 시도해 주세요.";

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(OFFLINE_RESPONSE, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          status: 503,
        }),
    ),
  );
});
