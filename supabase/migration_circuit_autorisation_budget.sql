-- Migration : le circuit d'autorisation se déclenche désormais par
-- dépassement du budget alloué du secteur, et non plus par un seuil fixe.
-- Déjà appliquée en base par Claude via connexion directe (psql) le
-- 2026-08-08 — ce fichier documente le changement dans l'historique du
-- dépôt, il n'a pas besoin d'être réexécuté.
--
-- Ancienne règle : statut = 'en_attente' si montant >= seuil configurable
-- (panneau Paramètres, 30 000 FCFA par défaut).
--
-- Nouvelle règle : statut = 'en_attente' si, en ajoutant la dépense
-- soumise, le cumul des dépenses déjà enregistrées pour ce secteur sur le
-- mois (hors dépenses refusées, y compris celles encore en attente —
-- pour éviter que plusieurs saisies simultanées ne contournent le budget)
-- dépasserait le budget alloué à ce secteur pour ce mois. Si aucun budget
-- n'est défini pour le secteur/mois, la dépense passe systématiquement en
-- attente (impossible de vérifier un dépassement sans référence).
--
-- La colonne `seuil` sur chaque dépense conserve, à titre de traçabilité,
-- le budget applicable au moment de la saisie plutôt qu'un seuil fixe.
--
-- Le panneau « Seuil d'autorisation » de Paramètres devient sans objet et a
-- été retiré de l'interface (voir commit associé) ; la table `app_config`
-- reste en base, inutilisée, sans risque à la conserver.
create or replace function public.compute_depense_statut()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_budget numeric;
  v_annee int;
  v_mois int;
  v_deja_depense numeric;
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

  new.seuil := v_budget;
  new.statut := case
    when v_budget = 0 then 'en_attente'
    when (v_deja_depense + new.montant) > v_budget then 'en_attente'
    else 'decaissee'
  end;
  new.cree_par := auth.uid();
  return new;
end;
$$;
