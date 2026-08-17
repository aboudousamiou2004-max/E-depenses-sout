-- Migration : fonctionnalités portées depuis termitiere-platform (module
-- dépenses) — bénéficiaire, justificatif (déjà des colonnes existantes,
-- simplement câblées côté UI), dépense imprévue, dépense récurrente, et
-- réintroduction d'un SEUIL FIXE dans le circuit d'autorisation.
--
-- ⚠️ Ce dernier point ANNULE INTENTIONNELLEMENT une partie de la décision prise
-- dans migration_circuit_autorisation_budget.sql (2026-08-08), qui avait retiré
-- le seuil fixe pour ne garder que le dépassement de budget. Décision reprise
-- explicitement à la demande de l'utilisateur (2026-08-17) : le circuit
-- d'autorisation combine désormais TROIS déclencheurs indépendants, un seul
-- suffit à faire passer la dépense en attente d'approbation — même logique que
-- `raisonAutorisation()` dans termitiere-platform/src/modules/depense/depenseActions.js :
--   1. Montant ≥ seuil fixe (20 000 FCFA), quel que soit le budget.
--   2. Dépense marquée « imprévue » par la personne qui saisit.
--   3. Dépassement du budget alloué au secteur pour le mois (ou aucun budget défini).
--
-- La colonne `seuil` continue de stocker le budget applicable au moment de la
-- saisie (traçabilité), pas le seuil fixe — celui-ci est une constante du code
-- (voir SEUIL_APPROBATION_FIXE dans src/lib/logic.js), pas une valeur par ligne.

alter table public.depenses add column if not exists imprevue boolean not null default false;
alter table public.depenses add column if not exists recurrente boolean not null default false;

create or replace function public.compute_depense_statut()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seuil_fixe numeric := 20000;
  v_budget numeric;
  v_annee int;
  v_mois int;
  v_deja_depense numeric;
  v_depasse_budget boolean;
begin
  v_annee := extract(year from new.date)::int;
  v_mois := extract(month from new.date)::int - 1; -- 0-indexé, cohérent avec le reste de l'application

  select montant into v_budget from public.budgets
    where secteur_id = new.secteur_id and annee = v_annee and mois = v_mois;
  v_budget := coalesce(v_budget, 0);

  select coalesce(sum(montant), 0) into v_deja_depense from public.depenses
    where secteur_id = new.secteur_id
      and statut <> 'refusee'
      and extract(year from date)::int = v_annee
      and extract(month from date)::int - 1 = v_mois;

  v_depasse_budget := (v_budget = 0) or ((v_deja_depense + new.montant) > v_budget);

  new.seuil := v_budget;
  new.statut := case
    when new.montant >= v_seuil_fixe then 'en_attente'
    when coalesce(new.imprevue, false) then 'en_attente'
    when v_depasse_budget then 'en_attente'
    else 'decaissee'
  end;
  new.cree_par := auth.uid();
  return new;
end;
$$;

-- Droits déjà accordés sur la table (grant select, insert, update sur depenses
-- dans schema.sql) : les nouvelles colonnes en héritent automatiquement, aucun
-- GRANT supplémentaire nécessaire. Les policies RLS existantes (has_module /
-- is_approbateur) portent sur la LIGNE, pas sur des colonnes précises.
