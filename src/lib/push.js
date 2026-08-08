import { supabase } from "./supabaseClient";

// Clé VAPID publique — publique par nature (comme la clé anon Supabase), elle
// finit dans le bundle JS livré au navigateur ; c'est la clé privée
// correspondante, gardée côté Edge Function, qui protège réellement l'envoi.
export const VAPID_PUBLIC_KEY =
  "BBKdoMQGwo6qahR6hyFtVoH8JRi8B9eoa6Bj5HA-T3vXMWg23zVNLrpw8NyTx0QD5hXG9Ymv_55aJeGaagjdJuI";

export const pushSupporte =
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// "non-supporte" | "refuse" | "inactif" | "actif" — utilisé pour savoir quel
// libellé/action proposer dans la cloche de notifications.
export async function statutAbonnementPush() {
  if (!pushSupporte) return "non-supporte";
  if (Notification.permission === "denied") return "refuse";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? "actif" : "inactif";
}

export async function activerNotificationsPush(userId) {
  if (!pushSupporte) {
    return { ok: false, error: "Ce navigateur ne prend pas en charge les notifications push." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      error: "Autorisation refusée — active les notifications depuis les réglages du navigateur pour ce site.",
    };
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function desactiverNotificationsPush() {
  if (!pushSupporte) return { ok: true };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return { ok: true };
}
