// Edge Function "send-push" — appelée par le trigger Postgres
// public.trigger_push_notification() à chaque nouvelle ligne insérée dans
// public.notifications. Envoie une vraie notification navigateur (Web Push)
// à chaque abonnement enregistré du destinataire, via le protocole VAPID.
//
// Ne fait jamais confiance au client : le secret partagé x-push-secret
// prouve que l'appel vient bien du trigger Postgres, et la clé
// SUPABASE_SERVICE_ROLE_KEY (jamais exposée au navigateur) permet de lire
// notifications/push_subscriptions en contournant volontairement la RLS,
// puisque cette fonction agit pour le compte du système, pas d'un utilisateur.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com";
const PUSH_TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== PUSH_TRIGGER_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let notificationId: string | undefined;
  try {
    ({ notification_id: notificationId } = await req.json());
  } catch {
    return new Response("corps de requête invalide", { status: 400 });
  }
  if (!notificationId) {
    return new Response("notification_id manquant", { status: 400 });
  }

  const { data: notif, error: notifErr } = await supabase
    .from("notifications")
    .select("id, destinataire_id, type, titre, message, lien")
    .eq("id", notificationId)
    .single();

  if (notifErr || !notif) {
    return new Response("notification introuvable", { status: 404 });
  }

  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notif.destinataire_id);

  if (subsErr) {
    return new Response(`erreur lecture abonnements : ${subsErr.message}`, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const payload = JSON.stringify({
    title: notif.titre || "E-DÉPENSES",
    body: notif.message || "",
    lien: notif.lien || "/",
    type: notif.type || "info",
  });

  let sent = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent += 1;
      } catch (err) {
        // Abonnement expiré ou révoqué côté navigateur : on le retire pour
        // ne pas continuer à essayer de pousser vers une adresse morte.
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }),
  );

  return new Response(JSON.stringify({ sent, total: subs.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
