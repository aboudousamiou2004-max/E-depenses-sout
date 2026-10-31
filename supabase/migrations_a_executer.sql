-- Migrations à exécuter dans Supabase (SQL Editor), en une seule fois.
-- Script RELANÇABLE : chaque étape supprime d'abord l'objet qu'elle recrée,
-- donc il est sans danger même si une étape a déjà été exécutée.

-- ----------------------------------------------------------------------------
-- 1. Recettes : modification ouverte à tout utilisateur du module (+ GRANT UPDATE manquant)
-- ----------------------------------------------------------------------------
drop policy if exists "modification recette reservee aux roles a acces total" on public.recettes;

drop policy if exists "recettes modifiables selon accès module" on public.recettes;

create policy "recettes modifiables selon accès module" on public.recettes
  for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));

grant update on public.recettes to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Suppression réservée à l'administration sur les 19 tables métiers
-- ----------------------------------------------------------------------------
drop policy if exists "campagnes supprimables selon accès module" on public.com_campagnes;

drop policy if exists "campagnes supprimables par les rôles à accès total" on public.com_campagnes;

create policy "campagnes supprimables par les rôles à accès total" on public.com_campagnes
  for delete using (public.is_full_access());

drop policy if exists "besoins supprimables selon accès module" on public.besoins;

drop policy if exists "besoins supprimables par les rôles à accès total" on public.besoins;

create policy "besoins supprimables par les rôles à accès total" on public.besoins
  for delete using (public.is_full_access());

drop policy if exists "garderie journaliers supprimables" on public.garderie_journaliers;

drop policy if exists "garderie journaliers supprimables par les rôles à accès total" on public.garderie_journaliers;

create policy "garderie journaliers supprimables par les rôles à accès total" on public.garderie_journaliers
  for delete using (public.is_full_access());

drop policy if exists "garderie enfants supprimables" on public.garderie_enfants;

drop policy if exists "garderie enfants supprimables par les rôles à accès total" on public.garderie_enfants;

create policy "garderie enfants supprimables par les rôles à accès total" on public.garderie_enfants
  for delete using (public.is_full_access());

drop policy if exists "garderie paiements supprimables" on public.garderie_paiements;

drop policy if exists "garderie paiements supprimables par les rôles à accès total" on public.garderie_paiements;

create policy "garderie paiements supprimables par les rôles à accès total" on public.garderie_paiements
  for delete using (public.is_full_access());

drop policy if exists "foncier dossiers supprimables" on public.foncier_dossiers;

drop policy if exists "foncier dossiers supprimables par les rôles à accès total" on public.foncier_dossiers;

create policy "foncier dossiers supprimables par les rôles à accès total" on public.foncier_dossiers
  for delete using (public.is_full_access());

drop policy if exists "foncier frais supprimables" on public.foncier_frais;

drop policy if exists "foncier frais supprimables par les rôles à accès total" on public.foncier_frais;

create policy "foncier frais supprimables par les rôles à accès total" on public.foncier_frais
  for delete using (public.is_full_access());

drop policy if exists "clients gym supprimables selon accès module" on public.gym_clients;

drop policy if exists "clients gym supprimables par les rôles à accès total" on public.gym_clients;

create policy "clients gym supprimables par les rôles à accès total" on public.gym_clients
  for delete using (public.is_full_access());

drop policy if exists "coachs gym supprimables selon accès module" on public.gym_coachs;

drop policy if exists "coachs gym supprimables par les rôles à accès total" on public.gym_coachs;

create policy "coachs gym supprimables par les rôles à accès total" on public.gym_coachs
  for delete using (public.is_full_access());

drop policy if exists "abonnements gym supprimables selon accès module" on public.gym_abonnements;

drop policy if exists "abonnements gym supprimables par les rôles à accès total" on public.gym_abonnements;

create policy "abonnements gym supprimables par les rôles à accès total" on public.gym_abonnements
  for delete using (public.is_full_access());

drop policy if exists "pointages gym supprimables selon accès module" on public.gym_pointages;

drop policy if exists "pointages gym supprimables par les rôles à accès total" on public.gym_pointages;

create policy "pointages gym supprimables par les rôles à accès total" on public.gym_pointages
  for delete using (public.is_full_access());

drop policy if exists "egpro projets supprimables" on public.egpro_projets;

drop policy if exists "egpro projets supprimables par les rôles à accès total" on public.egpro_projets;

create policy "egpro projets supprimables par les rôles à accès total" on public.egpro_projets
  for delete using (public.is_full_access());

drop policy if exists "egpro versements client supprimables" on public.egpro_versements_client;

drop policy if exists "egpro versements client supprimables par les rôles à accès total" on public.egpro_versements_client;

create policy "egpro versements client supprimables par les rôles à accès total" on public.egpro_versements_client
  for delete using (public.is_full_access());

drop policy if exists "egpro taches supprimables" on public.egpro_taches;

drop policy if exists "egpro taches supprimables par les rôles à accès total" on public.egpro_taches;

create policy "egpro taches supprimables par les rôles à accès total" on public.egpro_taches
  for delete using (public.is_full_access());

drop policy if exists "agro sante supprimable" on public.agro_sante;

drop policy if exists "agro sante supprimable par les rôles à accès total" on public.agro_sante;

create policy "agro sante supprimable par les rôles à accès total" on public.agro_sante
  for delete using (public.is_full_access());

drop policy if exists "agro vaccins supprimables" on public.agro_vaccins;

drop policy if exists "agro vaccins supprimables par les rôles à accès total" on public.agro_vaccins;

create policy "agro vaccins supprimables par les rôles à accès total" on public.agro_vaccins
  for delete using (public.is_full_access());

drop policy if exists "mouvements animaux supprimables" on public.mouvements_animaux;

drop policy if exists "mouvements animaux supprimables par les rôles à accès total" on public.mouvements_animaux;

create policy "mouvements animaux supprimables par les rôles à accès total" on public.mouvements_animaux
  for delete using (public.is_full_access());

drop policy if exists "transports supprimables selon accès module" on public.logistique_transports;

drop policy if exists "transports supprimables par les rôles à accès total" on public.logistique_transports;

create policy "transports supprimables par les rôles à accès total" on public.logistique_transports
  for delete using (public.is_full_access());

drop policy if exists "mouvements bancaires supprimables selon accès module" on public.banque_mouvements;

drop policy if exists "mouvements bancaires supprimables par les rôles à accès total" on public.banque_mouvements;

create policy "mouvements bancaires supprimables par les rôles à accès total" on public.banque_mouvements
  for delete using (public.is_full_access());

-- ----------------------------------------------------------------------------
-- 3. Volet Caisse (table, sécurité, journal)
-- ----------------------------------------------------------------------------
create table if not exists public.caisse_mouvements (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('entree','sortie')),
  libelle text not null default '',
  secteur_id text references public.secteurs(id) on delete set null,
  categorie text not null default '',
  beneficiaire text not null default '',
  montant numeric not null check (montant >= 0),
  ouverture boolean not null default false,
  cree_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists caisse_une_seule_ouverture on public.caisse_mouvements (ouverture) where ouverture;

-- Justificatif joint à un mouvement (fichier sérialisé en JSON, comme depenses.piece)
alter table public.caisse_mouvements add column if not exists piece text not null default '';

alter table public.caisse_mouvements enable row level security;

drop policy if exists "caisse lisible selon accès module" on public.caisse_mouvements;

create policy "caisse lisible selon accès module" on public.caisse_mouvements
  for select using (public.has_module('depense'));

drop policy if exists "caisse créée selon accès module" on public.caisse_mouvements;

create policy "caisse créée selon accès module" on public.caisse_mouvements
  for insert with check (public.has_module('depense'));

drop policy if exists "caisse modifiable selon accès module" on public.caisse_mouvements;

create policy "caisse modifiable selon accès module" on public.caisse_mouvements
  for update using (public.has_module('depense')) with check (public.has_module('depense'));

drop policy if exists "caisse supprimable par les rôles à accès total" on public.caisse_mouvements;

create policy "caisse supprimable par les rôles à accès total" on public.caisse_mouvements
  for delete using (public.is_full_access());

grant select, insert, update, delete on public.caisse_mouvements to authenticated;

create or replace function public.renseigner_auteur_caisse()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.cree_par := auth.uid();

return new;

end;

$$;

drop trigger if exists trg_renseigner_auteur_caisse on public.caisse_mouvements;

create trigger trg_renseigner_auteur_caisse
before insert on public.caisse_mouvements
for each row execute function public.renseigner_auteur_caisse();

create or replace function public.journaliser_caisse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_type text;

begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();

v_type := coalesce(new.type, old.type);

v_action := case tg_op
    when 'INSERT' then case when v_type = 'sortie' then 'Dépense de caisse enregistrée' else 'Dotation de caisse enregistrée' end
    when 'UPDATE' then 'Mouvement de caisse modifié'
    when 'DELETE' then 'Mouvement de caisse supprimé' end;

insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action,
          coalesce(new.libelle, old.libelle, '') || ' : ' || coalesce(new.montant, old.montant, 0) || ' FCFA');

return coalesce(new, old);

end;

$$;

drop trigger if exists trg_journaliser_caisse on public.caisse_mouvements;

create trigger trg_journaliser_caisse
after insert or update or delete on public.caisse_mouvements
for each row execute function public.journaliser_caisse();

-- Recharge le cache de schéma de l'API pour que la nouvelle table soit visible tout de suite.
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 4. Comptes rendus de la caisse (bouton « Compte effectué »)
-- ----------------------------------------------------------------------------
-- Migration : comptes rendus de la caisse (bouton « Compte effectué »), à la
-- demande explicite de l'utilisateur (2026-10-31).
--
-- Un compte par jour. `montant` reste NULL tant que le compte suit le total des
-- dépenses de caisse de ce jour (calculé côté application, donc mis à jour
-- automatiquement quand une dépense change) ; une valeur saisie à la main le fige.
--
-- Mêmes règles d'accès que caisse_mouvements : lecture, saisie et modification
-- pour tout utilisateur ayant accès au module E-DÉPENSES, suppression réservée
-- aux rôles à accès total. Script relançable sans risque.

create table if not exists public.caisse_comptes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  montant numeric check (montant is null or montant >= 0),
  note text not null default '',
  cree_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists caisse_comptes_une_par_date on public.caisse_comptes (date);

alter table public.caisse_comptes enable row level security;

drop policy if exists "comptes caisse lisibles selon accès module" on public.caisse_comptes;
create policy "comptes caisse lisibles selon accès module" on public.caisse_comptes
  for select using (public.has_module('depense'));

drop policy if exists "comptes caisse créés selon accès module" on public.caisse_comptes;
create policy "comptes caisse créés selon accès module" on public.caisse_comptes
  for insert with check (public.has_module('depense'));

drop policy if exists "comptes caisse modifiables selon accès module" on public.caisse_comptes;
create policy "comptes caisse modifiables selon accès module" on public.caisse_comptes
  for update using (public.has_module('depense')) with check (public.has_module('depense'));

drop policy if exists "comptes caisse supprimables par les rôles à accès total" on public.caisse_comptes;
create policy "comptes caisse supprimables par les rôles à accès total" on public.caisse_comptes
  for delete using (public.is_full_access());

grant select, insert, update, delete on public.caisse_comptes to authenticated;

-- L'auteur est toujours posé par le serveur.
create or replace function public.renseigner_auteur_caisse_compte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.cree_par := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_renseigner_auteur_caisse_compte on public.caisse_comptes;
create trigger trg_renseigner_auteur_caisse_compte
before insert on public.caisse_comptes
for each row execute function public.renseigner_auteur_caisse_compte();

-- Journal d'audit.
create or replace function public.journaliser_caisse_compte()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_montant numeric; v_date date;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_date := coalesce(new.date, old.date);
  v_montant := coalesce(new.montant, old.montant);
  v_action := case tg_op
    when 'INSERT' then 'Compte de caisse effectué'
    when 'UPDATE' then 'Compte de caisse modifié'
    when 'DELETE' then 'Compte de caisse supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action,
          to_char(v_date, 'DD/MM/YYYY') || ' : ' ||
          case when v_montant is null then 'reste en caisse du jour' else v_montant || ' FCFA' end);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_journaliser_caisse_compte on public.caisse_comptes;
create trigger trg_journaliser_caisse_compte
after insert or update or delete on public.caisse_comptes
for each row execute function public.journaliser_caisse_compte();

notify pgrst, 'reload schema';
