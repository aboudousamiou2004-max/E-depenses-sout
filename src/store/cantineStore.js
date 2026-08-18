import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// Cantine & Repas E-GARDERIE — menu du jour + appétit par enfant,
// simplifié depuis termitiere-platform/src/modules/garderie/Cantine.jsx
// (pas de distinction menu/spécial/apporté ni de suivi biberon).

const mapMenu = (r) => ({ date: r.date, petitDejeuner: r.petit_dejeuner, dejeuner: r.dejeuner, gouter: r.gouter });
const mapRepas = (r) => ({ id: r.id, date: r.date, enfantId: r.enfant_id, appetit: r.appetit, notes: r.notes });

export const useCantineStore = create((set) => ({
  menus: [],
  repas: [],

  chargerCantine: async () => {
    const [menus, repas] = await Promise.all([
      supabase.from("garderie_menus").select("*").order("date", { ascending: false }),
      supabase.from("garderie_repas").select("*").order("date", { ascending: false }),
    ]);
    set({ menus: (menus.data || []).map(mapMenu), repas: (repas.data || []).map(mapRepas) });
  },

  reset: () => set({ menus: [], repas: [] }),

  enregistrerMenu: async (date, payload) => {
    const { error } = await supabase.from("garderie_menus").upsert(
      { date, petit_dejeuner: payload.petitDejeuner || "", dejeuner: payload.dejeuner || "", gouter: payload.gouter || "" },
      { onConflict: "date" }
    );
    if (error) return { ok: false, error: error.message };
    set((s) => {
      const idx = s.menus.findIndex((m) => m.date === date);
      const entry = { date, petitDejeuner: payload.petitDejeuner || "", dejeuner: payload.dejeuner || "", gouter: payload.gouter || "" };
      const next = [...s.menus];
      if (idx >= 0) next[idx] = entry; else next.push(entry);
      return { menus: next };
    });
    return { ok: true };
  },

  enregistrerAppetit: async (date, enfantId, appetit, notes) => {
    const { error } = await supabase.from("garderie_repas").upsert(
      { date, enfant_id: enfantId, appetit, notes: notes || "" },
      { onConflict: "date,enfant_id" }
    );
    if (error) return { ok: false, error: error.message };
    set((s) => {
      const idx = s.repas.findIndex((r) => r.date === date && r.enfantId === enfantId);
      const entry = { date, enfantId, appetit, notes: notes || "" };
      const next = [...s.repas];
      if (idx >= 0) next[idx] = { ...next[idx], ...entry }; else next.push(entry);
      return { repas: next };
    });
    return { ok: true };
  },
}));
