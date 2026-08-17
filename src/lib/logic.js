// Règles métier du module E-DÉPENSES (cf. mémoire, Deuxième partie, chapitre 3).

export function fmtFCFA(n) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " FCFA";
}

export function fmtCompact(n) {
  const v = Math.round(n || 0);
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + " M";
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + " k";
  return String(v);
}

export function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

// `periode` = { annee, mois, jour } — `jour` à null compare le mois entier
// (comportement historique), une valeur 1-31 restreint à cette seule journée.
export function matchPeriode(date, periode) {
  const dt = new Date(date);
  if (dt.getFullYear() !== periode.annee || dt.getMonth() !== periode.mois) return false;
  return periode.jour ? dt.getDate() === periode.jour : true;
}

export function budgetSecteurMois(budgets, secteurId, annee, mois) {
  return budgets.find((b) => b.secteurId === secteurId && b.annee === annee && b.mois === mois)?.montant ?? 0;
}

export function depensesSecteurMois(depenses, secteurId, annee, mois, jour = null) {
  return depenses.filter((d) => {
    if (d.secteurId !== secteurId || d.statut === "refusee") return false;
    return matchPeriode(d.date, { annee, mois, jour });
  });
}

export function recettesSecteurPeriode(recettes, secteurId, periode) {
  return recettes.filter((r) => r.secteurId === secteurId && matchPeriode(r.date, periode));
}

export function totalMontant(list) {
  return list.reduce((s, x) => s + x.montant, 0);
}

export function tauxConsommation(depense, budget) {
  if (!budget) return 0;
  return depense / budget;
}

export function statutBudget(taux) {
  if (taux >= 1) return { label: "Dépassé", tone: "coral" };
  if (taux >= 0.8) return { label: "Attention", tone: "amber" };
  return { label: "Dans le budget", tone: "mint" };
}

export function secteursEnAlerte(secteurs, depenses, budgets, annee, mois, jour = null) {
  return secteurs
    .map((s) => {
      const budget = budgetSecteurMois(budgets, s.id, annee, mois);
      const depense = totalMontant(depensesSecteurMois(depenses, s.id, annee, mois, jour));
      const taux = tauxConsommation(depense, budget);
      return { ...s, budget, depense, taux, ...statutBudget(taux) };
    })
    .filter((s) => s.taux >= 0.8)
    .sort((a, b) => b.taux - a.taux);
}

export function tableauSecteurs(secteurs, depenses, budgets, annee, mois, jour = null) {
  return secteurs.map((s) => {
    const budget = budgetSecteurMois(budgets, s.id, annee, mois);
    const depense = totalMontant(depensesSecteurMois(depenses, s.id, annee, mois, jour));
    const taux = tauxConsommation(depense, budget);
    return { ...s, budget, depense, taux, ...statutBudget(taux) };
  });
}

export function soldesFluxMois(depenses, recettes, annee, mois) {
  const recMois = recettes.filter((r) => {
    const dt = new Date(r.date);
    return dt.getFullYear() === annee && dt.getMonth() === mois;
  });
  const depMois = depenses.filter((d) => {
    const dt = new Date(d.date);
    return dt.getFullYear() === annee && dt.getMonth() === mois && d.statut !== "refusee";
  });
  const totalRec = totalMontant(recMois);
  const exploitation = totalMontant(depMois.filter((d) => d.natureFlux === "exploitation"));
  const investissement = totalMontant(depMois.filter((d) => d.natureFlux === "investissement"));
  const perte = totalMontant(depMois.filter((d) => d.natureFlux === "perte"));
  return { totalRec, exploitation, investissement, perte, solde: totalRec - exploitation - investissement - perte };
}

export function croissance(actuel, precedent) {
  if (!precedent) return 0;
  return (actuel - precedent) / precedent;
}

// Seuil fixe du circuit d'autorisation — porté depuis termitiere-platform
// (SEUIL_APPROBATION_PAU). Au-delà de ce montant, une dépense passe en attente
// d'approbation même si elle reste dans le budget alloué. Doit rester
// synchronisé avec `v_seuil_fixe` dans compute_depense_statut() côté serveur
// (voir supabase/migration_fonctionnalites_depense.sql) — celui-ci reste seul
// juge côté serveur, cette constante ne sert qu'à l'indication affichée dans
// le formulaire de saisie.
export const SEUIL_APPROBATION_FIXE = 20000;

// Reproduit côté client, pour l'indication affichée dans le formulaire de
// saisie, la même règle que le trigger serveur `compute_depense_statut` :
// TROIS déclencheurs indépendants, un seul suffit — seuil fixe, dépense
// imprévue, ou dépassement du budget alloué au secteur pour le mois. Le
// trigger reste seul juge côté serveur — ceci n'est qu'un indicateur, jamais
// appliqué tel quel.
export function evaluationAutorisation(depenses, budgets, secteurId, annee, mois, montantSaisi, imprevue = false) {
  const budget = budgetSecteurMois(budgets, secteurId, annee, mois);
  const dejaDepense = totalMontant(depensesSecteurMois(depenses, secteurId, annee, mois));
  const montant = Number(montantSaisi) || 0;
  const depasseBudget = budget === 0 || dejaDepense + montant > budget;
  const depasseSeuil = montant >= SEUIL_APPROBATION_FIXE;
  const declenche = depasseBudget || depasseSeuil || !!imprevue;
  return { declenche, budget, dejaDepense, restant: Math.max(0, budget - dejaDepense), depasseBudget, depasseSeuil, imprevue: !!imprevue };
}

export function statutLabel(statut) {
  return {
    en_attente: { label: "En attente", tone: "amber" },
    approuvee: { label: "Approuvée", tone: "accent" },
    decaissee: { label: "Décaissée", tone: "mint" },
    refusee: { label: "Refusée", tone: "coral" },
  }[statut] || { label: statut, tone: "ink" };
}

export function last12Months(refDate = new Date(2026, 6, 27)) {
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
    out.push({ annee: d.getFullYear(), mois: d.getMonth(), label: d.toLocaleDateString("fr-FR", { month: "short" }) });
  }
  return out;
}
