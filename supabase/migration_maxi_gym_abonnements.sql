-- Migration : MAXI GYM — refonte du volet « Abonnements » pour reproduire
-- exactement la plateforme réelle (voir capture d'écran fournie par
-- l'utilisateur, 2026-09-14) : cycle de vie complet de l'abonnement (date de
-- souscription, début, durée, fin), pointage des arrivées (bouton
-- « Pointer » + historique des jours pointés), et traçabilité de qui l'a
-- enregistré. Remplace l'ancienne implémentation qui stockait juste
-- l'abonnement comme une ligne de `recettes` sans ces informations.
--
-- Un abonnement crée toujours une recette liée (comptabilité déjà en place,
-- Mouvements/Analyses/Dashboard) via `recettes.abonnement_id` — mais
-- l'abonnement lui-même vit dans sa propre table, seule façon de porter la
-- durée/fin/téléphone/pointages qu'une simple recette ne peut pas modéliser.

create table public.gym_abonnements (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  client text not null,
  telephone text not null default '',
  niveau text not null check (niveau in ('simple','classique','vip')),
  date_souscription date not null default current_date,
  date_debut date not null default current_date,
  duree_jours integer not null default 30,
  date_fin date not null,
  montant numeric not null default 0,
  note text not null default '',
  -- Cache de la dernière date de pointage, mis à jour à chaque « Pointer »
  -- (évite de recalculer max(gym_pointages.date) à chaque affichage de liste).
  derniere_arrivee date,
  cree_par_nom text not null default '',
  created_at timestamptz not null default now()
);

-- Un pointage par jour et par abonnement (bouton « Pointer » quand le client
-- arrive à la salle) — l'historique alimente le bouton calendrier de la liste.
create table public.gym_pointages (
  id uuid primary key default gen_random_uuid(),
  abonnement_id uuid not null references public.gym_abonnements(id) on delete cascade,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (abonnement_id, date)
);

alter table public.recettes add column if not exists abonnement_id uuid references public.gym_abonnements(id) on delete set null;

alter table public.gym_abonnements enable row level security;
alter table public.gym_pointages enable row level security;

create policy "abonnements gym lisibles selon accès module" on public.gym_abonnements for select using (public.has_module(secteur_id));
create policy "abonnements gym créés selon accès module" on public.gym_abonnements for insert with check (public.has_module(secteur_id));
create policy "abonnements gym modifiables selon accès module" on public.gym_abonnements for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));
create policy "abonnements gym supprimables selon accès module" on public.gym_abonnements for delete using (public.has_module(secteur_id));

create policy "pointages gym lisibles selon accès module" on public.gym_pointages for select using (
  exists (select 1 from public.gym_abonnements a where a.id = gym_pointages.abonnement_id and public.has_module(a.secteur_id))
);
create policy "pointages gym créés selon accès module" on public.gym_pointages for insert with check (
  exists (select 1 from public.gym_abonnements a where a.id = gym_pointages.abonnement_id and public.has_module(a.secteur_id))
);
create policy "pointages gym supprimables selon accès module" on public.gym_pointages for delete using (
  exists (select 1 from public.gym_abonnements a where a.id = gym_pointages.abonnement_id and public.has_module(a.secteur_id))
);

grant select, insert, update, delete on public.gym_abonnements to authenticated;
grant select, insert, delete on public.gym_pointages to authenticated;

create or replace function public.journaliser_gym_abonnement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_secteur_nom text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = coalesce(new.secteur_id, old.secteur_id);
  v_action := case tg_op when 'INSERT' then 'Abonnement créé'
                          when 'UPDATE' then 'Abonnement modifié'
                          when 'DELETE' then 'Abonnement supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, coalesce(v_secteur_nom, 'MAXI GYM'), v_action, coalesce(new.client, old.client, ''));
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_gym_abonnement
after insert or update or delete on public.gym_abonnements
for each row execute function public.journaliser_gym_abonnement();
