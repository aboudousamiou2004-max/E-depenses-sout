-- Migration : le circuit d'autorisation n'a plus qu'UN SEUL déclencheur —
-- à la demande explicite de l'utilisateur (2026-09-17) : « le seuil des
-- 20000 ne doit plus exister, la demande est déclenchée une fois que la
-- dépense saisie est supérieure au montant alloué au secteur ». Annule la
-- décision prise le 2026-08-17 (migration_fonctionnalites_depense.sql) qui
-- avait réintroduit un seuil fixe (20 000 FCFA) et le flag « imprévue »
-- comme déclencheurs indépendants du budget.
--
-- Le flag `imprevue` reste en base et dans le formulaire de saisie (donnée
-- informative, utile pour le suivi), il ne déclenche simplement plus
-- l'autorisation à lui seul.
create or replace function public.compute_depense_statut()
returns trigger language plpgsql security definer set search_path = public as $$
declare
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
  new.statut := case when v_depasse_budget then 'en_attente' else 'decaissee' end;
  new.cree_par := auth.uid();
  return new;
end;
$$;
