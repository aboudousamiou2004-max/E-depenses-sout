-- Migration : notifications de fan-out pour l'allocation et la confirmation
-- de réception d'un budget de secteur (allouerOuReviserBudget /
-- validerReceptionBudget dans src/store/dataStore.js), sur le même modèle
-- que trg_notifier_nouvelle_depense / trg_notifier_statut_depense déjà en
-- place pour le circuit d'autorisation des dépenses (voir schema.sql).
--
-- Couvre le circuit demandé :
--  1. Un membre de l'administration (PAU/GE/DIRECTEUR/super_admin) alloue ou
--     révise un budget → lui-même et tous les autres membres de
--     l'administration reçoivent une notification (et la notification push
--     navigateur associée, via la Service Worker déjà en place — voir
--     src/lib/push.js), et le(s) gérant(s) du secteur reçoivent une
--     notification dédiée à confirmer.
--  2. Le gérant confirme la réception (validerReceptionBudget) → tout le
--     personnel du secteur (tous les profils dont `secteur` = ce secteur)
--     reçoit une notification de confirmation.
--
-- L'alarme « secteurs en alerte / dépassé » sur le tableau de bord et le
-- circuit demande d'autorisation → notification de retour existent déjà
-- (secteursEnAlerte dans src/lib/logic.js, affiché sur Dashboard.jsx et
-- Recettes.jsx ; trg_notifier_nouvelle_depense / trg_notifier_statut_depense
-- dans schema.sql) — rien à ajouter de ce côté.

create or replace function public.notifier_budget()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_secteur_nom text;
  v_auteur_nom text;
  v_montant numeric;
  v_est_confirmation boolean;
  v_nouvelle_proposition boolean;
  v_allocation_directe boolean;
  r record;
begin
  -- Le gérant (ou un membre à accès total) vient de confirmer la réception
  -- d'un montant précédemment proposé : montant_propose retombe à null et
  -- montant prend exactement la valeur qui était proposée.
  v_est_confirmation := tg_op = 'UPDATE'
    and old.montant_propose is not null
    and new.montant_propose is null
    and new.montant is not distinct from old.montant_propose;

  -- Nouvelle proposition (ou révision de la proposition) en attente de
  -- confirmation par le secteur.
  v_nouvelle_proposition := new.montant_propose is not null
    and (tg_op = 'INSERT' or new.montant_propose is distinct from old.montant_propose);

  -- Allocation/révision appliquée directement (secteur sans confirmation
  -- requise, cf. `requiertValidation` côté client).
  v_allocation_directe := not v_est_confirmation and not v_nouvelle_proposition
    and new.montant_propose is null and new.montant > 0
    and (tg_op = 'INSERT' or new.montant is distinct from old.montant);

  if not v_est_confirmation and not v_nouvelle_proposition and not v_allocation_directe then
    return new;
  end if;

  select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
  select nom into v_auteur_nom from public.profiles where id = auth.uid();

  if v_est_confirmation then
    for r in select id from public.profiles where secteur = new.secteur_id and actif loop
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (r.id, 'success', 'Budget reçu — ' || coalesce(v_secteur_nom, new.secteur_id),
              'Réception de ' || new.montant || ' FCFA confirmée par ' || coalesce(v_auteur_nom, 'le gérant') || '.',
              '/depense/recettes');
    end loop;
    return new;
  end if;

  v_montant := coalesce(new.montant_propose, new.montant);

  for r in select id from public.profiles where role in ('pau','ge','directeur','super_admin') and actif loop
    insert into public.notifications (destinataire_id, type, titre, message, lien)
    values (r.id, 'info', 'Budget alloué — ' || coalesce(v_secteur_nom, new.secteur_id),
            coalesce(v_auteur_nom, 'Un administrateur') || ' a alloué ' || v_montant || ' FCFA à ' || coalesce(v_secteur_nom, new.secteur_id) || '.',
            '/depense/recettes');
  end loop;

  if v_nouvelle_proposition then
    for r in select id from public.profiles where role = 'gerant' and secteur = new.secteur_id and actif loop
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (r.id, 'warning', 'Budget à confirmer',
              v_montant || ' FCFA alloués à ' || coalesce(v_secteur_nom, new.secteur_id) || ' : confirme la réception.',
              '/depense/recettes');
    end loop;
  end if;

  return new;
end;
$$;

create trigger trg_notifier_budget
after insert or update on public.budgets
for each row execute function public.notifier_budget();
