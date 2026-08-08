// Service worker minimal — sa seule responsabilité est d'afficher les
// notifications push reçues et de gérer le clic dessus (focus/ouverture de
// l'app sur la page liée). Pas de mise en cache : l'app reste servie
// normalement par Vite/Netlify, ce worker ne fait qu'écouter push/click.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "E-DÉPENSES";
  const options = {
    body: data.body || "",
    icon: "/logo_termitiere.png",
    badge: "/logo_termitiere.png",
    data: { lien: data.lien || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const lien = event.notification.data?.lien || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(lien);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(lien);
    }),
  );
});
