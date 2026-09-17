-- Migration : MAXI GYM — volets « Nos forfaits » et « Clients », spécifiques
-- à ce secteur (voir PRESETS["maxi-gym"] dans src/lib/modules.js).
--
-- Nos forfaits : les 3 formules (Simple / Classique / VIP) qui servent de
-- base de prix à la facturation des séances et abonnements. Une seule ligne
-- par niveau et par secteur — le store applicatif (gymStore.js) les amorce
-- automatiquement avec les tarifs communiqués par l'utilisateur au premier
-- accès à l'écran si la table est encore vide pour ce secteur, donc aucune
-- donnée n'est insérée ici.
--
-- Clients : suivi de qui est abonné, à quel forfait — les paiements eux-
-- mêmes restent saisis depuis Prestations (facturation), comme pour tous
-- les autres secteurs ; cet écran ne fait que le suivi des personnes.

create table public.gym_forfaits (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  niveau text not null check (niveau in ('simple','classique','vip')),
  description text not null default '',
  prix_seance numeric,
  prix_abonnement numeric,
  duree_abonnement_texte text not null default '',
  seance_proposee boolean not null default true,
  features text[] not null default '{}',
  unique (secteur_id, niveau)
);

create table public.gym_clients (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  nom text not null,
  telephone text not null default '',
  forfait_niveau text not null default 'simple' check (forfait_niveau in ('simple','classique','vip')),
  date_debut date not null default current_date,
  actif boolean not null default true,
  -- Distingue un client individuel d'une entreprise partenaire (volet
  -- « Clients partenaires ») — même table, un simple indicateur.
  est_partenaire boolean not null default false,
  entreprise text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.gym_coachs (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  nom text not null,
  telephone text not null default '',
  specialite text not null default '',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.gym_forfaits enable row level security;
alter table public.gym_clients enable row level security;
alter table public.gym_coachs enable row level security;

create policy "forfaits gym lisibles selon accès module" on public.gym_forfaits for select using (public.has_module(secteur_id));
create policy "forfaits gym créés selon accès module" on public.gym_forfaits for insert with check (public.has_module(secteur_id));
create policy "forfaits gym modifiables selon accès module" on public.gym_forfaits for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));

create policy "clients gym lisibles selon accès module" on public.gym_clients for select using (public.has_module(secteur_id));
create policy "clients gym créés selon accès module" on public.gym_clients for insert with check (public.has_module(secteur_id));
create policy "clients gym modifiables selon accès module" on public.gym_clients for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));
create policy "clients gym supprimables selon accès module" on public.gym_clients for delete using (public.has_module(secteur_id));

create policy "coachs gym lisibles selon accès module" on public.gym_coachs for select using (public.has_module(secteur_id));
create policy "coachs gym créés selon accès module" on public.gym_coachs for insert with check (public.has_module(secteur_id));
create policy "coachs gym modifiables selon accès module" on public.gym_coachs for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));
create policy "coachs gym supprimables selon accès module" on public.gym_coachs for delete using (public.has_module(secteur_id));

grant select, insert, update on public.gym_forfaits to authenticated;
grant select, insert, update, delete on public.gym_clients to authenticated;
grant select, insert, update, delete on public.gym_coachs to authenticated;

create or replace function public.journaliser_gym_client()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_secteur_nom text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = coalesce(new.secteur_id, old.secteur_id);
  v_action := case tg_op when 'INSERT' then 'Client créé'
                          when 'UPDATE' then 'Client modifié'
                          when 'DELETE' then 'Client supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, coalesce(v_secteur_nom, 'MAXI GYM'), v_action, coalesce(new.nom, old.nom, ''));
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_gym_client
after insert or update or delete on public.gym_clients
for each row execute function public.journaliser_gym_client();
