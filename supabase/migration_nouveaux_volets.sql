-- Migration : nouveaux volets portés depuis termitiere-platform (module
-- dépenses) — Compte bancaire et Partenaires — pour que la navigation
-- E-DÉPENSES ait exactement les mêmes onglets des deux côtés, à la demande
-- explicite de l'utilisateur (2026-08-17).
--
-- Contient aussi un correctif d'une lacune découverte en marge de ce travail :
-- migration_suppression_depense_recette.sql (2026-08-07) a ajouté des
-- policies RLS "delete" sur depenses/recettes, mais jamais le GRANT DELETE au
-- niveau table — PostgREST refuse la requête avant même d'évaluer RLS sans ce
-- GRANT, donc la suppression d'une dépense/recette était restée impossible en
-- pratique malgré la policy. Corrigé ci-dessous.

-- ----------------------------------------------------------------------------
-- 1. Compte bancaire — mouvements de dépôts/retraits, miroir du relevé
--    bancaire. `ouverture = true` marque la ligne spéciale de solde initial
--    (au plus une par compte ; le client applique cette règle, pas de
--    contrainte unique ici pour rester simple).
-- ----------------------------------------------------------------------------

create table public.banque_mouvements (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('depot','retrait')),
  libelle text not null default '',
  origine text not null default '',
  personne text not null default '',
  montant numeric not null check (montant >= 0),
  ouverture boolean not null default false,
  cree_par uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.banque_mouvements enable row level security;

create policy "mouvements bancaires lisibles selon accès module" on public.banque_mouvements
  for select using (public.has_module('depense'));
create policy "mouvements bancaires créés selon accès module" on public.banque_mouvements
  for insert with check (public.has_module('depense'));
create policy "mouvements bancaires modifiables selon accès module" on public.banque_mouvements
  for update using (public.has_module('depense')) with check (public.has_module('depense'));
create policy "mouvements bancaires supprimables selon accès module" on public.banque_mouvements
  for delete using (public.has_module('depense'));

grant select, insert, update, delete on public.banque_mouvements to authenticated;

create or replace function public.journaliser_banque()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_action := case tg_op when 'INSERT' then 'Mouvement bancaire enregistré'
                          when 'UPDATE' then 'Mouvement bancaire modifié'
                          when 'DELETE' then 'Mouvement bancaire supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action,
          coalesce(new.libelle, old.libelle, '') || ' — ' || coalesce(new.montant, old.montant, 0) || ' FCFA');
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_banque
after insert or update or delete on public.banque_mouvements
for each row execute function public.journaliser_banque();

-- ----------------------------------------------------------------------------
-- 2. Partenaires — contacts externes (fournisseurs, prestataires…), pas des
--    employés. Écriture réservée aux rôles à accès total (sout n'a pas
--    l'équivalent du champ `gerePartenaires` par utilisateur de
--    termitiere-platform — is_full_access() suffit ici).
-- ----------------------------------------------------------------------------

create table public.partenaires (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  type text not null default '',
  contact text not null default '',
  created_at timestamptz not null default now()
);

alter table public.partenaires enable row level security;

create policy "partenaires lisibles selon accès module" on public.partenaires
  for select using (public.has_module('depense'));
create policy "partenaires modifiables par les rôles à accès total" on public.partenaires
  for insert with check (public.is_full_access());
create policy "partenaires mis à jour par les rôles à accès total" on public.partenaires
  for update using (public.is_full_access()) with check (public.is_full_access());
create policy "partenaires supprimables par les rôles à accès total" on public.partenaires
  for delete using (public.is_full_access());

grant select, insert, update, delete on public.partenaires to authenticated;

create or replace function public.journaliser_partenaire()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_action := case tg_op when 'INSERT' then 'Partenaire ajouté'
                          when 'UPDATE' then 'Partenaire modifié'
                          when 'DELETE' then 'Partenaire supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action, coalesce(new.nom, old.nom, ''));
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_partenaire
after insert or update or delete on public.partenaires
for each row execute function public.journaliser_partenaire();

-- ----------------------------------------------------------------------------
-- 3. Correctif : GRANT DELETE manquant depuis le 2026-08-07 sur depenses et
--    recettes (les policies RLS "delete" existaient déjà, mais sans le GRANT
--    au niveau table, PostgREST rejette la requête avant RLS — la
--    suppression était donc restée impossible en pratique).
-- ----------------------------------------------------------------------------

grant delete on public.depenses to authenticated;
grant delete on public.recettes to authenticated;
