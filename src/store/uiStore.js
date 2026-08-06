import { create } from "zustand";

export const useUIStore = create((set) => ({
  secteurFiltre: "tous",
  setSecteurFiltre: (v) => set({ secteurFiltre: v }),
  periode: { annee: 2026, mois: 6 }, // juillet 2026 (0-indexé)
}));
