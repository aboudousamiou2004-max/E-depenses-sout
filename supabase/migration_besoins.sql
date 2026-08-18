-- Migration : Besoins — volet transversal disponible dans TOUS les modules
-- métier, à la demande explicite de l'utilisateur (2026-08-18) : "ajoute un
-- volet besoins au niveau de tous les modules, ces besoins sont reçus par
-- les directeurs et les membres de l'administration". Porté (simplifié)
-- depuis termitiere-platform/src/shared/besoins/SectorBesoins.jsx.
--
-- "Les directeurs et les membres de l'administration" = exactement les
-- rôles déjà couverts par public.is_approbateur() (pau, ge, super_admin,
-- directeur) — mêmes rôles qui approuvent déjà les dépenses. Valider un
-- besoin crée une dépense réelle (circuit d'autorisation normal, cf.
-- depenses.besoin_id ci-dessous), exactement comme sur la vraie plateforme.
--
-- Simplifié par rapport à termitiere-platform : pas de pièces jointes (pas
-- d'infrastructure de fichiers dans ce projet), pas de regroupement par
-- ouvrage/devis (spécifique aux projets BTP), pas de validation/refus en
-- masse. Le mécanisme central conservé : demande → notification directe aux
-- rôles d'administration → validation (crée une dépense) ou refus, avec
-- observation de retour au demandeur.

create table public.besoins (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  titre text not null,
  categorie text not null default 'materiaux' check (categorie in ('main_oeuvre','materiaux','equipement','financier','transport','autre')),
  quantite numeric not null check (quantite > 0),
  unite text not null default '',
  prix_unitaire numeric not null default 0,
  montant numeric not null default 0,
  priorite text not null default 'normale' check (priorite in ('basse','normale','haute','urgente')),
  date_souhaitee date,
  note text not null default '',
  -- Suivi opérationnel (à traiter → en cours → satisfait/annulé), distinct de
  -- la validation par l'administration ci-dessous.
  statut text not null default 'a_traiter' check (statut in ('a_traiter','en_cours','satisfait','annule')),
  validation text not null default 'en_attente' check (validation in ('en_attente','valide','refuse')),
  motif_refus text not null default '',
  observation_admin text not null default '',
  observation_par_nom text,
  observation_le timestamptz,
  valide_par_nom text,
  valide_le timestamptz,
  refuse_par_nom text,
  refuse_le timestamptz,
  depense_id uuid references public.depenses(id) on delete set null,
  demande_par uuid references public.profiles(id),
  demande_par_nom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un besoin validé crée une dépense réelle qui reste traçable jusqu'à lui —
-- même mécanisme que projet_id/tache_id sur depenses (cf.
-- migration_projets_taches_egpro.sql).
alter table public.depenses add column besoin_id uuid references public.besoins(id) on delete set null;

alter table public.besoins enable row level security;

create policy "besoins lisibles selon accès module" on public.besoins for select using (public.has_module(secteur_id));
create policy "besoins créés selon accès module" on public.besoins for insert with check (public.has_module(secteur_id));
create policy "besoins modifiables selon accès module" on public.besoins for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));
create policy "besoins supprimables selon accès module" on public.besoins for delete using (public.has_module(secteur_id));

grant select, insert, update, delete on public.besoins to authenticated;

-- Le montant, le statut, la validation et le demandeur sont recalculés/forcés
-- côté serveur à la création — jamais acceptés tels que soumis par le client,
-- même logique que compute_depense_statut() pour les dépenses.
create or replace function public.avant_insert_besoin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text;
begin
  new.montant := coalesce(new.quantite, 0) * coalesce(new.prix_unitaire, 0);
  new.statut := 'a_traiter';
  new.validation := 'en_attente';
  new.demande_par := auth.uid();
  select nom into v_nom from public.profiles where id = auth.uid();
  new.demande_par_nom := coalesce(v_nom, '—');
  return new;
end;
$$;

create trigger trg_avant_insert_besoin
before insert on public.besoins
for each row execute function public.avant_insert_besoin();

-- Recalcule le montant à chaque modification (jamais accepté tel quel), et
-- verrouille validation/observation_admin aux seuls rôles d'administration —
-- une simple policy RLS ne peut pas distinguer "modifier le titre" de
-- "valider le besoin" sur la même ligne, d'où ce trigger.
create or replace function public.avant_update_besoin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.montant := coalesce(new.quantite, 0) * coalesce(new.prix_unitaire, 0);
  if (new.validation is distinct from old.validation or new.observation_admin is distinct from old.observation_admin)
     and not public.is_approbateur() then
    raise exception 'Seuls les directeurs et l''administration peuvent valider, refuser ou répondre à un besoin.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_avant_update_besoin
before update on public.besoins
for each row execute function public.avant_update_besoin();

-- Un besoin déjà validé a généré une dépense réelle — ce n'est plus une
-- simple demande mais un engagement, on ne le supprime plus depuis ici
-- (la dépense reste consultable/gérable dans E-DÉPENSES).
create or replace function public.empecher_suppression_besoin_valide()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.validation = 'valide' then
    raise exception 'Ce besoin a déjà été validé — il est désormais un engagement réel dans E-DÉPENSES, impossible de le supprimer ici.';
  end if;
  return old;
end;
$$;

create trigger trg_empecher_suppression_besoin_valide
before delete on public.besoins
for each row execute function public.empecher_suppression_besoin_valide();

-- Fan-out à la création : tout nouveau besoin remonte aux directeurs et à
-- l'administration (mêmes rôles que is_approbateur — pau, ge, super_admin,
-- directeur), plus un accusé de réception au demandeur.
create or replace function public.notifier_nouveau_besoin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_secteur_nom text;
  r record;
begin
  select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
  for r in select id from public.profiles where role in ('pau','ge','super_admin','directeur') and actif and id is distinct from new.demande_par loop
    insert into public.notifications (destinataire_id, type, titre, message, lien)
    values (r.id, 'warning', 'Nouveau besoin — ' || coalesce(v_secteur_nom, new.secteur_id),
            new.titre || ' · ' || new.montant || ' FCFA · demandé par ' || coalesce(new.demande_par_nom, '—'),
            '/secteur/' || new.secteur_id || '/besoins');
  end loop;
  if new.demande_par is not null then
    insert into public.notifications (destinataire_id, type, titre, message, lien)
    values (new.demande_par, 'info', 'Besoin envoyé',
            new.titre || ' — en attente de validation par l''administration.',
            '/secteur/' || new.secteur_id || '/besoins');
  end if;
  return new;
end;
$$;

create trigger trg_notifier_nouveau_besoin
after insert on public.besoins
for each row execute function public.notifier_nouveau_besoin();

-- Retour au demandeur à la décision (validation/refus) ou à une observation.
create or replace function public.notifier_decision_besoin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text;
  v_titre text;
  v_message text;
begin
  if new.demande_par is null or new.demande_par = auth.uid() then
    return new;
  end if;
  if new.validation = 'valide' and old.validation is distinct from new.validation then
    v_type := 'success'; v_titre := 'Besoin validé';
    v_message := new.titre || ' — envoyé en dépense (' || new.montant || ' FCFA).';
  elsif new.validation = 'refuse' and old.validation is distinct from new.validation then
    v_type := 'danger'; v_titre := 'Besoin refusé';
    v_message := new.titre || case when new.motif_refus <> '' then ' — ' || new.motif_refus else '' end;
  elsif new.observation_admin <> '' and old.observation_admin is distinct from new.observation_admin then
    v_type := 'info'; v_titre := 'Réponse à votre besoin';
    v_message := new.titre || ' — ' || new.observation_admin;
  else
    return new;
  end if;
  insert into public.notifications (destinataire_id, type, titre, message, lien)
  values (new.demande_par, v_type, v_titre, v_message, '/secteur/' || new.secteur_id || '/besoins');
  return new;
end;
$$;

create trigger trg_notifier_decision_besoin
after update on public.besoins
for each row execute function public.notifier_decision_besoin();

create or replace function public.journaliser_besoin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_secteur_nom text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = coalesce(new.secteur_id, old.secteur_id);
  v_action := case tg_op when 'INSERT' then 'Besoin créé'
                          when 'UPDATE' then 'Besoin modifié'
                          when 'DELETE' then 'Besoin supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, coalesce(v_secteur_nom, 'Besoins'), v_action, coalesce(new.titre, old.titre, ''));
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_besoin
after insert or update or delete on public.besoins
for each row execute function public.journaliser_besoin();
