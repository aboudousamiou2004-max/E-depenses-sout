-- Migration : notifications push navigateur (Web Push / VAPID), en complément
-- de la cloche in-app déjà en place.
--
-- Principe : chaque abonnement navigateur (endpoint + clés de chiffrement)
-- d'un utilisateur est stocké dans push_subscriptions. Dès qu'une ligne est
-- insérée dans notifications (par notifier_nouvelle_depense ou
-- notifier_statut_depense, déjà existants — aucune modification requise
-- côté logique métier), un trigger appelle, via pg_net, l'Edge Function
-- "send-push" qui envoie effectivement la notification au(x) navigateur(s)
-- abonné(s) du destinataire.
--
-- Le trigger n'embarque aucun secret en dur : il lit un secret partagé
-- stocké dans Supabase Vault (vault.decrypted_secrets, nom "push_secret" —
-- ALTER DATABASE ... SET est refusé par Supabase hébergé sur le rôle
-- postgres.<ref>, Vault est l'alternative supportée). La valeur elle-même
-- est créée séparément via vault.create_secret(...), non commitée dans ce
-- fichier. L'Edge Function vérifie ce même secret dans l'en-tête
-- x-push-secret avant de traiter la requête.

create extension if not exists pg_net with schema extensions;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Chaque utilisateur gère uniquement ses propres abonnements (un par
-- navigateur/appareil sur lequel il a autorisé les notifications).
create policy "push_subscriptions gérées par leur propriétaire"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

create or replace function public.trigger_push_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret' limit 1;
  if v_secret is null then
    return new;
  end if;
  perform net.http_post(
    url := 'https://htmbqnpaujykwfsydaay.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
end;
$$;

create trigger notifications_push_trigger
  after insert on public.notifications
  for each row execute function public.trigger_push_notification();
