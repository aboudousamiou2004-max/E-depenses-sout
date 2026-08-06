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

export function budgetSecteurMois(budgets, secteurId, annee, mois) {
  return budgets.find((b) => b.secteurId === secteurId && b.annee === annee && b.mois === mois)?.montant ?? 0;
}

export function depensesSecteurMois(depenses, secteurId, annee, mois) {
  return depenses.filter((d) => {
    const dt = new Date(d.date);
    return d.secteurId === secteurId && dt.getFullYear() === annee && dt.getMonth() === mois && d.statut !== "refusee";
  });
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

export function secteursEnAlerte(secteurs, depenses, budgets, annee, mois) {
  return secteurs
    .map((s) => {
      const budget = budgetSecteurMois(budgets, s.id, annee, mois);
      const depense = totalMontant(depensesSecteurMois(depenses, s.id, annee, mois));
      const taux = tauxConsommation(depense, budget);
      return { ...s, budget, depense, taux, ...statutBudget(taux) };
    })
    .filter((s) => s.taux >= 0.8)
    .sort((a, b) => b.taux - a.taux);
}

export function tableauSecteurs(secteurs, depenses, budgets, annee, mois) {
  return secteurs.map((s) => {
    const budget = budgetSecteurMois(budgets, s.id, annee, mois);
    const depense = totalMontant(depensesSecteurMois(depenses, s.id, annee, mois));
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

export function verifierSeuilApprobation(montant, seuil = 30000) {
  return montant >= seuil;
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
