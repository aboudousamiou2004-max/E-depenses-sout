-- Migration : allocation/révision de budget par secteur, avec historique et
-- circuit propose→confirme — porté depuis termitiere-platform
-- (src/modules/depense/RecettesDepenses.jsx), à la demande explicite de
-- l'utilisateur ("fait comme c'est fait exactement dans termitière
-- plateforme", 2026-08-17).
--
-- Constat de départ : `budgets` existait déjà (schema.sql) et `setBudget()`
-- était bien câblé dans dataStore.js, mais AUCUN écran ne l'appelait — il
-- n'y avait donc aucun moyen d'allouer un budget dans ce projet. Ce n'est
-- pas juste « ajouter un bouton » : termitiere-platform trace chaque
-- allocation/révision (qui, quand, montant avant/après, motif) et, pour un
-- secteur ayant une équipe identifiable, exige une confirmation de
-- réception avant que le nouveau montant ne devienne actif.
--
-- Contrairement à termitiere-platform, qui code en dur la liste des secteurs
-- « avec équipe » (agro/logistique/evenementiel/garderie), ce projet permet
-- de créer des secteurs à la volée (Paramètres → Secteurs) : on calcule donc
-- dynamiquement si un secteur a une « équipe identifiable » (au moins un
-- profil dont `modules` contient ce secteur) plutôt que de coder une liste
-- fixe — même finalité, adapté à ce projet.

alter table public.budgets add column if not exists revisions jsonb not null default '[]'::jsonb;
alter table public.budgets add column if not exists montant_propose numeric;
alter table public.budgets add column if not exists motif_propose text;
alter table public.budgets add column if not exists statut_validation text check (statut_validation is null or statut_validation = 'en_attente');
alter table public.budgets add column if not exists propose_par_text text;
alter table public.budgets add column if not exists propose_par_uid uuid references public.profiles(id);
alter table public.budgets add column if not exists propose_le timestamptz;

-- Le budget existant n'avait qu'une policy UPDATE globale (has_module) sans
-- policy DELETE — la suppression d'un budget (retour à « Non défini »,
-- fonctionnalité de termitiere-platform) en avait besoin.
create policy "budgets supprimables selon accès module" on public.budgets
  for delete using (public.has_module(secteur_id));
grant delete on public.budgets to authenticated;

-- Notifie l'équipe du secteur (profils dont `modules` contient secteur_id)
-- quand un budget est proposé et attend confirmation de réception.
create or replace function public.notifier_budget_propose()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_secteur_nom text;
  r record;
begin
  if new.statut_validation = 'en_attente' and (old.statut_validation is distinct from new.statut_validation) then
    select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
    for r in select id from public.profiles where new.secteur_id = any(modules) and actif loop
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (r.id, 'warning', '💰 Budget proposé — ' || coalesce(v_secteur_nom, new.secteur_id),
              new.montant_propose || ' FCFA — confirmez la réception pour l''activer.', '/depense/recettes');
    end loop;
  end if;
  -- Confirmation de réception → notifie l'administration (rôles à accès total).
  if old.statut_validation = 'en_attente' and new.statut_validation is null then
    select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
    for r in select id from public.profiles where public.is_full_access() or role in ('super_admin','pau','ge','directeur') loop
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (r.id, 'success', '✅ Budget confirmé reçu — ' || coalesce(v_secteur_nom, new.secteur_id),
              new.montant || ' FCFA confirmés.', '/depense/recettes');
    end loop;
  end if;
  return new;
end;
$$;

create trigger trg_notifier_budget_propose
after update on public.budgets
for each row execute function public.notifier_budget_propose();

-- Remplace l'ancien trigger générique (schema.sql), qui journalisait un
-- « Définition budget » identique à chaque INSERT/UPDATE sans distinguer
-- allocation / révision / proposition / confirmation — doublonnerait avec
-- la journalisation plus précise ci-dessous.
drop trigger if exists trg_journaliser_budget on public.budgets;

create or replace function public.journaliser_budget_revision()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_secteur_nom text; v_action text; v_details text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
  if tg_op = 'INSERT' then
    v_action := 'Budget alloué'; v_details := coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant || ' FCFA';
  elsif new.statut_validation = 'en_attente' and (old.statut_validation is distinct from new.statut_validation) then
    v_action := 'Budget proposé'; v_details := coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant_propose || ' FCFA proposés';
  elsif old.statut_validation = 'en_attente' and new.statut_validation is null then
    v_action := 'Réception budget confirmée'; v_details := coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant || ' FCFA confirmés';
  elsif old.montant is distinct from new.montant and new.statut_validation is null then
    v_action := 'Budget révisé';
    v_details := coalesce(v_secteur_nom, new.secteur_id) || ' — ' || old.montant || ' → ' || new.montant || ' FCFA';
  else
    return new;
  end if;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action, v_details);
  return new;
end;
$$;

create trigger trg_journaliser_budget_revision
after insert or update on public.budgets
for each row execute function public.journaliser_budget_revision();
