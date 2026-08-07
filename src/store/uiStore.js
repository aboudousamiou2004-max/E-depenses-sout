import { create } from "zustand";

export const useUIStore = create((set) => ({
  secteurFiltre: "tous",
  setSecteurFiltre: (v) => set({ secteurFiltre: v }),

  // `jour` reste `null` en vue mensuelle (comportement historique) ; une
  // valeur 1-31 bascule tous les calculs de KPI/graphiques sur une seule
  // journée au lieu du mois entier — voir lib/logic.js `matchPeriode`.
  periode: { annee: 2026, mois: 6, jour: null }, // juillet 2026 (0-indexé)
  setPeriode: (p) => set((s) => ({ periode: { ...s.periode, ...p } })),

  // Recherche globale de la TopBar — consommée par les pages qui listent des
  // dépenses/recettes (Depenses.jsx, Recettes.jsx et leurs équivalents
  // modules métiers), inerte ailleurs.
  recherche: "",
  setRecherche: (v) => set({ recherche: v }),
}));
