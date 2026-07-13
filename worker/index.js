// Egen service worker-kode som next-pwa importerer inn i den genererte
// sw.js (customWorkerSrc). Håndterer push-varsler og klikk på dem.
// eslint-disable-next-line no-restricted-globals
self.addEventListener("push", (event) => {
  let data = { title: "Heim", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Ikke-JSON payload — behold standardverdiene.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Heim", {
      body: data.body,
      icon: "/heim-192.png",
      badge: "/heim-192.png",
      data: { url: data.url || "/app" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
