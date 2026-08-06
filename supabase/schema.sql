-- ============================================================================
-- E-DÉPENSES — Schéma Supabase (Postgres) + RLS + triggers + données de référence
--
-- À exécuter EN UNE FOIS dans Supabase → SQL Editor → New query, sur un projet
-- neuf. L'ordre des sections compte (tables avant policies avant triggers).
--
-- Ne contient QUE les données de référence (secteurs, référentiels de stock et
-- leurs quantités de départ) — pas d'historique de dépenses/recettes factice :
-- à partir d'ici, les données sont réelles et créées par l'usage de l'app.
-- Le premier compte super-administrateur se crée séparément (voir le fichier
-- supabase/README.md fourni à côté de ce script).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

create table public.secteurs (
  id text primary key,
  nom text not null,
  label text,
  color text,
  created_at timestamptz not null default now()
);

-- Profil applicatif, 1:1 avec auth.users — Supabase Auth possède les
-- identifiants (auth.users), cette table ne contient jamais de mot de passe.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login text not null unique,
  nom text not null,
  role text not null check (role in ('super_admin','pau','ge','directeur','superviseur','gerant','agent')),
  secteur text references public.secteurs(id),
  poste text not null default '',
  telephone text not null default '',
  actif boolean not null default true,
  modules text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  annee int not null,
  mois int not null check (mois between 0 and 11),
  montant numeric not null,
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (secteur_id, annee, mois)
);

create table public.depenses (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  categorie text not null,
  montant numeric not null check (montant > 0),
  date date not null,
  description text not null default '',
  nature_flux text check (nature_flux in ('exploitation','investissement','perte')),
  source_financement text check (source_financement in ('entreprise','pau')),
  beneficiaire_nom text not null default '',
  piece text not null default '',
  -- statut/seuil/cree_par sont recalculés côté serveur par trigger (trg_compute_depense_statut) —
  -- les valeurs par défaut ci-dessous ne servent que de filet, le client ne les contrôle jamais.
  statut text not null default 'en_attente' check (statut in ('en_attente','approuvee','refusee','decaissee')),
  seuil numeric not null default 30000,
  cree_par uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.recettes (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  montant numeric not null check (montant > 0),
  date date not null,
  origine text check (origine in ('Vente','Prestation','Facturation client','Subvention')),
  cree_par uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Journal d'audit — écrit exclusivement par des triggers (jamais d'INSERT client
-- direct), pour qu'aucun client ne puisse forger une entrée au nom d'un autre.
create table public.journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  user_nom text,
  role text,
  module text,
  action text,
  details text,
  "timestamp" timestamptz not null default now()
);

-- Notifications — écrites exclusivement par des triggers (fan-out PAU/GE, retour
-- au demandeur). Aucune policy d'INSERT client : sinon un client pourrait
-- spammer des notifications à n'importe quel destinataire.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire_id uuid not null references public.profiles(id),
  lu boolean not null default false,
  "timestamp" timestamptz not null default now(),
  type text check (type in ('warning','info','success','danger')),
  titre text,
  message text,
  lien text
);

-- Stock — MAXI LOGISTIQUE (matériel)
create table public.referentiel_materiel (
  id text primary key,
  nom text not null,
  cat text,
  unite text not null default 'unités',
  cout_achat numeric not null default 0,
  init_quantite numeric not null default 0
);

create table public.mouvements_materiel (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  article_id text not null references public.referentiel_materiel(id),
  type text not null check (type in ('achat','sortie','retour_ok','retour_casse','retour_perdu')),
  quantite numeric not null check (quantite > 0),
  motif text not null default '',
  agent_id uuid references public.profiles(id),
  agent_nom text,
  created_at timestamptz not null default now()
);

-- Stock — E-BRIQUETERIE matières premières
create table public.referentiel_matieres (
  id text primary key,
  nom text not null,
  unite text,
  init_quantite numeric not null default 0
);

create table public.mouvements_matieres (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  matiere_id text not null references public.referentiel_matieres(id),
  type text not null check (type in ('arrivage','consommation')),
  quantite numeric not null check (quantite > 0),
  agent_id uuid references public.profiles(id),
  agent_nom text,
  created_at timestamptz not null default now()
);

-- Stock — E-BRIQUETERIE briques (dérivé d'un journal, comme les 3 autres
-- domaines de stock — voir v_stock_briques plus bas pour la justification)
create table public.types_briques (
  id text primary key,
  nom text not null,
  tarif_vente numeric not null default 0
);

create table public.stock_briques_init (
  type_id text not null references public.types_briques(id),
  etat text not null check (etat in ('appatam','sechage','pret','caillasses')),
  quantite numeric not null default 0,
  primary key (type_id, etat)
);

create table public.journal_briques (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type_id text not null references public.types_briques(id),
  action text not null check (action in ('production','transition','vente')),
  etat_de text check (etat_de in ('appatam','sechage','pret','caillasses')),
  etat_vers text check (etat_vers in ('appatam','sechage','pret','caillasses')),
  quantite numeric not null check (quantite > 0),
  agent_id uuid references public.profiles(id),
  agent_nom text,
  created_at timestamptz not null default now()
);

-- Stock — MAXI AGRO (cheptel)
create table public.referentiel_animaux (
  id text primary key,
  nom text not null,
  cat text,
  init_quantite numeric not null default 0
);

create table public.mouvements_animaux (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  espece_id text not null references public.referentiel_animaux(id),
  type text not null check (type in ('achat','naissance','vente','deces','perte')),
  quantite numeric not null, -- signée (positive ou négative selon le type), comme côté client aujourd'hui
  motif text not null default '',
  agent_id uuid references public.profiles(id),
  agent_nom text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Vues de solde — dérivées des journaux de mouvements, jamais mutées
--    directement (mêmes formules que src/store/stockStore.js aujourd'hui).
-- ----------------------------------------------------------------------------

create view public.v_stock_materiel with (security_invoker = true) as
select
  r.id as article_id,
  greatest(0, r.init_quantite + coalesce(sum(
    case m.type
      when 'achat' then m.quantite
      when 'retour_ok' then m.quantite
      when 'sortie' then -m.quantite
      else 0
    end
  ), 0)) as solde
from public.referentiel_materiel r
left join public.mouvements_materiel m on m.article_id = r.id
group by r.id, r.init_quantite;

create view public.v_stock_matieres with (security_invoker = true) as
select
  r.id as matiere_id,
  greatest(0, r.init_quantite + coalesce(sum(
    case m.type when 'arrivage' then m.quantite else -m.quantite end
  ), 0)) as solde
from public.referentiel_matieres r
left join public.mouvements_matieres m on m.matiere_id = r.id
group by r.id, r.init_quantite;

create view public.v_effectif_animaux with (security_invoker = true) as
select
  r.id as espece_id,
  greatest(0, r.init_quantite + coalesce(sum(m.quantite), 0)) as effectif
from public.referentiel_animaux r
left join public.mouvements_animaux m on m.espece_id = r.id
group by r.id, r.init_quantite;

-- Solde des briques par (type, état) : état initial + productions + entrées de
-- transition − sorties de transition − ventes (uniquement depuis "pret").
create view public.v_stock_briques with (security_invoker = true) as
with mouvements as (
  select type_id, 'appatam'::text as etat,
    sum(case when action = 'production' then quantite
             when action = 'transition' and etat_vers = 'appatam' then quantite
             when action = 'transition' and etat_de = 'appatam' then -quantite
             else 0 end) as delta
  from public.journal_briques group by type_id
  union all
  select type_id, 'sechage',
    sum(case when action = 'transition' and etat_vers = 'sechage' then quantite
             when action = 'transition' and etat_de = 'sechage' then -quantite
             else 0 end)
  from public.journal_briques group by type_id
  union all
  select type_id, 'pret',
    sum(case when action = 'transition' and etat_vers = 'pret' then quantite
             when action = 'transition' and etat_de = 'pret' then -quantite
             when action = 'vente' then -quantite
             else 0 end)
  from public.journal_briques group by type_id
  union all
  select type_id, 'caillasses',
    sum(case when action = 'transition' and etat_vers = 'caillasses' then quantite else 0 end)
  from public.journal_briques group by type_id
)
select
  i.type_id,
  i.etat,
  greatest(0, i.quantite + coalesce(m.delta, 0)) as quantite
from public.stock_briques_init i
left join mouvements m on m.type_id = i.type_id and m.etat = i.etat;

-- ----------------------------------------------------------------------------
-- 3. Fonctions helper pour les policies RLS — centralisent en SQL les mêmes
--    règles que src/lib/modules.js (accesModule / ROLES_ACCES_TOTAL).
--    security definer + search_path fixé : nécessaire pour interroger
--    `profiles` sans provoquer de récursion RLS infinie sur profiles lui-même.
-- ----------------------------------------------------------------------------

-- NULL si le compte n'existe pas OU est désactivé (actif = false) — un jeton
-- encore valide pour un compte désactivé en cours de session ne doit donner
-- aucun droit, pas seulement empêcher une nouvelle connexion.
create or replace function public.current_role_name()
returns text language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid() and actif;
$$;

create or replace function public.is_full_access()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(public.current_role_name() in ('super_admin','pau','ge','directeur'), false);
$$;

create or replace function public.has_module(p_module text)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_full_access() or exists (
    select 1 from public.profiles where id = auth.uid() and actif and p_module = any(modules)
  );
$$;

create or replace function public.is_approbateur()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(public.current_role_name() in ('pau','ge','super_admin','directeur'), false);
$$;

-- ----------------------------------------------------------------------------
-- 4. Triggers métier
-- ----------------------------------------------------------------------------

-- Le statut/seuil d'une dépense est calculé côté serveur, jamais accepté tel
-- que soumis par le client — sinon un appel API direct pourrait insérer une
-- dépense déjà "décaissée" en contournant le circuit d'autorisation.
create or replace function public.compute_depense_statut()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seuil numeric := 30000;
begin
  new.seuil := v_seuil;
  new.statut := case when new.montant >= v_seuil then 'en_attente' else 'decaissee' end;
  new.cree_par := auth.uid();
  return new;
end;
$$;

create trigger trg_compute_depense_statut
before insert on public.depenses
for each row execute function public.compute_depense_statut();

-- Machine à états serveur pour les transitions de statut (en plus de la policy
-- RLS qui restreint QUI peut faire l'UPDATE — ceci restreint QUELLES
-- transitions sont valides, ce que RLS seul ne peut pas exprimer facilement).
create or replace function public.valider_transition_statut()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.statut = 'en_attente' and new.statut not in ('approuvee','refusee') then
    raise exception 'Transition de statut invalide : % → %', old.statut, new.statut;
  elsif old.statut = 'approuvee' and new.statut not in ('decaissee','refusee') then
    raise exception 'Transition de statut invalide : % → %', old.statut, new.statut;
  elsif old.statut in ('decaissee','refusee') then
    raise exception 'Cette dépense est déjà soldée (%).', old.statut;
  end if;
  return new;
end;
$$;

create trigger trg_valider_transition_statut
before update on public.depenses
for each row when (old.statut is distinct from new.statut)
execute function public.valider_transition_statut();

-- Fan-out de notification à la création d'une dépense au-dessus du seuil.
create or replace function public.notifier_nouvelle_depense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_secteur_nom text;
  v_motif text;
  r record;
begin
  if new.statut = 'en_attente' then
    select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
    v_motif := coalesce(nullif(trim(new.description), ''), 'Aucun motif renseigné');
    for r in select id from public.profiles where role in ('pau','ge') and actif loop
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (r.id, 'warning', 'Demande d''autorisation — ' || coalesce(v_secteur_nom, new.secteur_id),
              new.categorie || ' · ' || new.montant || ' FCFA · ' || v_motif,
              '/depense/autorisations');
    end loop;
    if new.cree_par is not null then
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (new.cree_par, 'info', 'Demande envoyée',
              new.categorie || ' · ' || new.montant || ' FCFA — en attente de la décision du PAU ou de la GE.',
              '/depense/depenses');
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_notifier_nouvelle_depense
after insert on public.depenses
for each row execute function public.notifier_nouvelle_depense();

-- Notification retour au demandeur à chaque changement de statut.
create or replace function public.notifier_statut_depense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text;
  v_titre text;
  v_message text;
  v_auteur_nom text;
begin
  if new.cree_par is null or old.statut = new.statut then
    return new;
  end if;
  select nom into v_auteur_nom from public.profiles where id = auth.uid();
  if new.statut = 'approuvee' then
    v_type := 'success'; v_titre := 'Dépense approuvée';
    v_message := new.categorie || ' · ' || new.montant || ' FCFA — approuvée par ' || coalesce(v_auteur_nom, 'le PAU/GE') || ', décaissement possible.';
  elsif new.statut = 'refusee' then
    v_type := 'danger'; v_titre := 'Dépense refusée';
    v_message := new.categorie || ' · ' || new.montant || ' FCFA — refusée par ' || coalesce(v_auteur_nom, 'le PAU/GE') || '.';
  elsif new.statut = 'decaissee' then
    v_type := 'success'; v_titre := 'Dépense décaissée';
    v_message := new.categorie || ' · ' || new.montant || ' FCFA — décaissement effectué.';
  else
    return new;
  end if;
  insert into public.notifications (destinataire_id, type, titre, message, lien)
  values (new.cree_par, v_type, v_titre, v_message, '/depense/depenses');
  return new;
end;
$$;

create trigger trg_notifier_statut_depense
after update on public.depenses
for each row execute function public.notifier_statut_depense();

-- Clamp serveur pour les mouvements de briques (transition/vente) — reproduit
-- le Math.min(quantite, disponible) fait côté client aujourd'hui, mais
-- réellement appliqué même via un appel API direct.
create or replace function public.clamp_journal_briques()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  disponible numeric;
begin
  if new.action in ('transition', 'vente') and new.etat_de is not null then
    select quantite into disponible from public.v_stock_briques
      where type_id = new.type_id and etat = new.etat_de;
    if disponible is null then disponible := 0; end if;
    if new.quantite > disponible then
      new.quantite := disponible;
    end if;
  end if;
  if new.quantite <= 0 then
    raise exception 'Quantité disponible insuffisante pour ce mouvement.';
  end if;
  return new;
end;
$$;

create trigger trg_clamp_journal_briques
before insert on public.journal_briques
for each row execute function public.clamp_journal_briques();

-- Journal d'audit — un trigger par table source, jamais d'INSERT client direct
-- dans `journal` (impossible à forger, toujours attribué au vrai auth.uid()).
create or replace function public.journaliser_depense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_secteur_nom text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = coalesce(new.secteur_id, old.secteur_id);
  if tg_op = 'INSERT' then
    insert into public.journal (user_id, user_nom, role, module, action, details)
    values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', 'Saisie dépense',
            new.categorie || ' — ' || coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant || ' FCFA');
  elsif tg_op = 'UPDATE' and old.statut is distinct from new.statut then
    v_action := case new.statut
      when 'approuvee' then 'Approbation dépense'
      when 'refusee' then 'Refus dépense'
      when 'decaissee' then 'Décaissement'
      else 'Modification dépense' end;
    insert into public.journal (user_id, user_nom, role, module, action, details)
    values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action,
            'Dépense ' || new.id || ' — ' || new.montant || ' FCFA');
  end if;
  return new;
end;
$$;

create trigger trg_journaliser_depense
after insert or update on public.depenses
for each row execute function public.journaliser_depense();

create or replace function public.journaliser_recette()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_secteur_nom text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', 'Saisie recette',
          new.origine || ' — ' || coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant || ' FCFA');
  return new;
end;
$$;

create trigger trg_journaliser_recette
after insert on public.recettes
for each row execute function public.journaliser_recette();

create or replace function public.journaliser_budget()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', 'Définition budget',
          new.secteur_id || ' — ' || (new.mois + 1) || '/' || new.annee || ' — ' || new.montant || ' FCFA');
  return new;
end;
$$;

create trigger trg_journaliser_budget
after insert or update on public.budgets
for each row execute function public.journaliser_budget();

create or replace function public.journaliser_secteur()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', 'Ajout secteur', 'Nouveau secteur créé : ' || new.nom);
  return new;
end;
$$;

create trigger trg_journaliser_secteur
after insert on public.secteurs
for each row execute function public.journaliser_secteur();

-- Note : auth.uid() n'est pas résolu pendant le trigger handle_new_user (l'INSERT
-- dans auth.users passe par le service interne de Supabase Auth, pas par
-- PostgREST) — la ligne de journal pour un AJOUT d'utilisateur retombe donc sur
-- le nom du nouveau profil lui-même en fallback ; l'UPDATE (modification
-- d'accès), elle, passe par une vraie requête authentifiée et est correctement
-- attribuée.
create or replace function public.journaliser_profil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    insert into public.journal (user_id, user_nom, role, module, action, details)
    values (auth.uid(), coalesce(v_nom, new.nom), coalesce(v_role, 'admin'), 'E-DÉPENSES', 'Ajout utilisateur',
            new.nom || ' (' || new.login || ') — accès : ' || array_to_string(new.modules, ', '));
  elsif tg_op = 'UPDATE' and old.modules is distinct from new.modules then
    insert into public.journal (user_id, user_nom, role, module, action, details)
    values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', 'Modification accès',
            new.nom || ' — accès : ' || array_to_string(new.modules, ', '));
  end if;
  return new;
end;
$$;

create trigger trg_journaliser_profil
after insert or update on public.profiles
for each row execute function public.journaliser_profil();

-- Création automatique du profil applicatif à la création d'un compte Auth —
-- les infos (login, nom, rôle...) sont passées via signUp({ options: { data } }).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, login, nom, role, secteur, poste, telephone, actif, modules)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'login', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    nullif(new.raw_user_meta_data->>'secteur', ''),
    coalesce(new.raw_user_meta_data->>'poste', ''),
    coalesce(new.raw_user_meta_data->>'telephone', ''),
    coalesce((new.raw_user_meta_data->>'actif')::boolean, true),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(new.raw_user_meta_data->'modules')),
      '{}'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. Row Level Security — seule vraie barrière puisque le client (navigateur)
--    appelle l'API Supabase directement avec la clé publique anon.
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.secteurs enable row level security;
alter table public.budgets enable row level security;
alter table public.depenses enable row level security;
alter table public.recettes enable row level security;
alter table public.journal enable row level security;
alter table public.notifications enable row level security;
alter table public.referentiel_materiel enable row level security;
alter table public.mouvements_materiel enable row level security;
alter table public.referentiel_matieres enable row level security;
alter table public.mouvements_matieres enable row level security;
alter table public.types_briques enable row level security;
alter table public.stock_briques_init enable row level security;
alter table public.journal_briques enable row level security;
alter table public.referentiel_animaux enable row level security;
alter table public.mouvements_animaux enable row level security;

-- profiles : lecture ouverte aux connectés (besoin d'afficher les noms
-- partout) ; écriture réservée aux rôles à accès total ; INSERT bloqué
-- côté client (seul le trigger handle_new_user, security definer, insère).
create policy "profils lisibles par tous les connectés" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profils modifiables par les rôles à accès total" on public.profiles
  for update using (public.is_full_access()) with check (public.is_full_access());

-- secteurs
create policy "secteurs lisibles par tous les connectés" on public.secteurs
  for select using (auth.role() = 'authenticated');
create policy "création de secteur réservée aux rôles à accès total" on public.secteurs
  for insert with check (public.is_full_access());

-- budgets
create policy "budgets lisibles selon accès module" on public.budgets
  for select using (public.has_module(secteur_id));
create policy "budgets créés selon accès module" on public.budgets
  for insert with check (public.has_module(secteur_id));
create policy "budgets mis à jour selon accès module" on public.budgets
  for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));

-- depenses
create policy "depenses lisibles selon accès module" on public.depenses
  for select using (public.has_module(secteur_id));
create policy "depenses créées selon accès module" on public.depenses
  for insert with check (public.has_module(secteur_id));
create policy "statut dépense modifiable par les approbateurs" on public.depenses
  for update using (public.is_approbateur() and public.has_module(secteur_id))
  with check (public.is_approbateur() and public.has_module(secteur_id));

-- recettes
create policy "recettes lisibles selon accès module" on public.recettes
  for select using (public.has_module(secteur_id));
create policy "recettes créées selon accès module" on public.recettes
  for insert with check (public.has_module(secteur_id));

-- journal : lecture réservée aux rôles à accès total, écriture uniquement
-- via triggers (aucune policy insert pour les rôles authenticated).
create policy "journal lisible par les rôles à accès total" on public.journal
  for select using (public.is_full_access());

-- notifications : chacun ne voit et ne modifie que les siennes ; aucune
-- policy insert (seuls les triggers, security definer, en créent).
create policy "notifications visibles par leur destinataire" on public.notifications
  for select using (destinataire_id = auth.uid());
create policy "notification marquée lue par son destinataire" on public.notifications
  for update using (destinataire_id = auth.uid()) with check (destinataire_id = auth.uid());

-- Stock — chaque table scopée au module métier propriétaire.
create policy "referentiel materiel lisible" on public.referentiel_materiel for select using (public.has_module('logistique'));
create policy "referentiel materiel modifiable" on public.referentiel_materiel for insert with check (public.has_module('logistique'));
create policy "mouvements materiel lisibles" on public.mouvements_materiel for select using (public.has_module('logistique'));
create policy "mouvements materiel créés" on public.mouvements_materiel for insert with check (public.has_module('logistique'));

create policy "referentiel matieres lisible" on public.referentiel_matieres for select using (public.has_module('briqueterie'));
create policy "mouvements matieres lisibles" on public.mouvements_matieres for select using (public.has_module('briqueterie'));
create policy "mouvements matieres créés" on public.mouvements_matieres for insert with check (public.has_module('briqueterie'));

create policy "types briques lisibles" on public.types_briques for select using (public.has_module('briqueterie'));
create policy "stock briques init lisible" on public.stock_briques_init for select using (public.has_module('briqueterie'));
create policy "journal briques lisible" on public.journal_briques for select using (public.has_module('briqueterie'));
create policy "journal briques créé" on public.journal_briques for insert with check (public.has_module('briqueterie'));

create policy "referentiel animaux lisible" on public.referentiel_animaux for select using (public.has_module('agro'));
create policy "referentiel animaux modifiable" on public.referentiel_animaux for insert with check (public.has_module('agro'));
create policy "mouvements animaux lisibles" on public.mouvements_animaux for select using (public.has_module('agro'));
create policy "mouvements animaux créés" on public.mouvements_animaux for insert with check (public.has_module('agro'));

-- ----------------------------------------------------------------------------
-- 6. Droits d'accès aux tables — RLS filtre les LIGNES, ces GRANT autorisent
--    d'abord la TABLE elle-même pour le rôle "authenticated" (sans ça,
--    PostgREST refuse la requête avant même d'évaluer les policies).
--    Rien n'est accordé à "anon" : tout est derrière l'authentification.
-- ----------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.secteurs to authenticated;
grant select, insert, update on public.budgets to authenticated;
grant select, insert, update on public.depenses to authenticated;
grant select, insert on public.recettes to authenticated;
grant select on public.journal to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert on public.referentiel_materiel to authenticated;
grant select, insert on public.mouvements_materiel to authenticated;
grant select on public.referentiel_matieres to authenticated;
grant select, insert on public.mouvements_matieres to authenticated;
grant select on public.types_briques to authenticated;
grant select on public.stock_briques_init to authenticated;
grant select, insert on public.journal_briques to authenticated;
grant select, insert on public.referentiel_animaux to authenticated;
grant select, insert on public.mouvements_animaux to authenticated;
grant select on public.v_stock_materiel to authenticated;
grant select on public.v_stock_matieres to authenticated;
grant select on public.v_stock_briques to authenticated;
grant select on public.v_effectif_animaux to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Données de référence (secteurs + référentiels de stock + quantités de
--    départ) — reprises telles quelles de src/data/seed.js et
--    src/data/stockData.js. Aucun historique de dépenses/recettes/budgets :
--    la base démarre vide sur ces tables, alimentée par l'usage réel.
-- ----------------------------------------------------------------------------

insert into public.secteurs (id, nom, label, color) values
  ('btp', 'MAXI BAT', 'Bâtiment & Travaux Publics', '#0A84FF'),
  ('agro', 'MAXI AGRO', 'Agro-élevage', '#30D158'),
  ('logistique', 'MAXI LOGISTIQUE', 'Logistique & Transport', '#FF9F0A'),
  ('briqueterie', 'E-BRIQUETERIE', 'Production de briques', '#BF5AF2'),
  ('foncier', 'E-FONCIER', 'Gestion foncière', '#64D2FF'),
  ('garderie', 'E-GARDERIE', 'Garderie LA TERMITIÈRE', '#FF453A');

insert into public.referentiel_materiel (id, nom, cat, unite, cout_achat, init_quantite) values
  ('tente_10x10', 'Tente 10x10', 'TENTES & STRUCTURES', 'unités', 85000, 3),
  ('table_ronde', 'Table ronde', 'TABLES', 'unités', 10000, 15),
  ('chaise_pliante', 'Chaise pliante', 'CHAISES', 'unités', 3000, 80),
  ('sono_pack', 'Pack sonorisation', 'SONORISATION', 'unités', 55000, 2),
  ('projecteur', 'Projecteur LED', 'ÉCLAIRAGE', 'unités', 8000, 8),
  ('nappe', 'Nappe de table', 'DÉCORATION', 'unités', 1800, 25),
  ('assiette', 'Assiette (lot de 10)', 'VAISSELLE & SERVICE', 'lots', 3500, 12);

insert into public.referentiel_matieres (id, nom, unite, init_quantite) values
  ('ciment', 'Ciment', 'sacs', 80),
  ('concasse', 'Concassé', 'm³', 30),
  ('sable', 'Sable', 'm³', 45);

insert into public.types_briques (id, nom, tarif_vente) values
  ('b12_creux', 'Brique 12 creux', 150),
  ('b15_creux', 'Brique 15 creux', 175),
  ('b20_creux', 'Brique 20 creux', 225),
  ('b12_plein', 'Brique 12 pleine', 200);

insert into public.stock_briques_init (type_id, etat, quantite) values
  ('b12_creux','appatam',400), ('b12_creux','sechage',1200), ('b12_creux','pret',2200), ('b12_creux','caillasses',60),
  ('b15_creux','appatam',200), ('b15_creux','sechage',600),  ('b15_creux','pret',1200), ('b15_creux','caillasses',30),
  ('b20_creux','appatam',100), ('b20_creux','sechage',300),  ('b20_creux','pret',600),  ('b20_creux','caillasses',15),
  ('b12_plein','appatam',0),   ('b12_plein','sechage',150),  ('b12_plein','pret',350),  ('b12_plein','caillasses',10);

insert into public.referentiel_animaux (id, nom, cat, init_quantite) values
  ('ovins', 'Ovins (moutons)', 'OVINS', 85),
  ('bovins', 'Bovins (bœufs, vaches)', 'BOVINS', 32),
  ('caprins', 'Caprins (chèvres)', 'CAPRINS', 60),
  ('poulets', 'Poulets', 'POULETS', 420),
  ('pintades', 'Pintades', 'PINTADES', 140);

-- ============================================================================
-- Fin du script. Étape suivante : créer le premier compte super-administrateur
-- (voir supabase/README.md) avant de connecter l'application.
-- ============================================================================
