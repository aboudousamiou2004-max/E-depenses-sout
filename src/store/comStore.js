import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// MAXI COM — volet « Campagnes », spécifique à ce secteur (voir
// PRESETS["maxi-com"] dans lib/modules.js) : suivi par campagne (client,
// budget, statut, période), en complément des dépenses/recettes déjà
// génériques à tous les secteurs. Même convention que besoinsStore.js.

export const STATUTS_CAMPAGNE = [
  { id: "a_venir", label: "À venir", tone: "ink" },
  { id: "en_cours", label: "En cours", tone: "accent" },
  { id: "terminee", label: "Terminée", tone: "mint" },
  { id: "annulee", label: "Annulée", tone: "coral" },
];
export const statutCampagneLabel = (id) => STATUTS_CAMPAGNE.find((s) => s.id === id)?.label || id;
export const statutCampagneTone = (id) => STATUTS_CAMPAGNE.find((s) => s.id === id)?.tone || "ink";

const mapCampagne = (r) => ({
  id: r.id, secteurId: r.secteur_id, nom: r.nom, client: r.client || "",
  budget: Number(r.budget) || 0, statut: r.statut, dateDebut: r.date_debut, dateFin: r.date_fin,
  description: r.description || "", createdAt: r.created_at,
});

export const useComStore = create((set, get) => ({
  campagnes: [],

  reset: () => set({ campagnes: [] }),

  chargerCampagnes: async (secteurId) => {
    const { data } = await supabase.from("com_campagnes").select("*").eq("secteur_id", secteurId).order("date_debut", { ascending: false });
    set({ campagnes: (data || []).map(mapCampagne) });
  },

  ajouterCampagne: async (secteurId, form) => {
    const { error } = await supabase.from("com_campagnes").insert({
      secteur_id: secteurId, nom: form.nom.trim(), client: form.client || "",
      budget: Number(form.budget) || 0, statut: form.statut || "a_venir",
      date_debut: form.dateDebut || null, date_fin: form.dateFin || null, description: form.description || "",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerCampagnes(secteurId);
    return { ok: true };
  },

  modifierCampagne: async (id, form) => {
    const { error } = await supabase.from("com_campagnes").update({
      nom: form.nom.trim(), client: form.client || "", budget: Number(form.budget) || 0,
      statut: form.statut, date_debut: form.dateDebut || null, date_fin: form.dateFin || null,
      description: form.description || "",
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ campagnes: get().campagnes.map((c) => (c.id === id ? {
      ...c, nom: form.nom.trim(), client: form.client || "", budget: Number(form.budget) || 0,
      statut: form.statut, dateDebut: form.dateDebut || null, dateFin: form.dateFin || null,
      description: form.description || "",
    } : c)) });
    return { ok: true };
  },

  changerStatutCampagne: async (id, statut) => {
    const { error } = await supabase.from("com_campagnes").update({ statut }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ campagnes: get().campagnes.map((c) => (c.id === id ? { ...c, statut } : c)) });
    return { ok: true };
  },

  supprimerCampagne: async (id) => {
    const { error } = await supabase.from("com_campagnes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ campagnes: get().campagnes.filter((c) => c.id !== id) });
    return { ok: true };
  },
}));
