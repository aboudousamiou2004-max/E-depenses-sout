import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// Santé & Infirmerie E-GARDERIE — incidents (accident, maladie, allergie…)
// et soins courants (médicament, température, bobo…), simplifiés depuis
// termitiere-platform/src/modules/garderie/Incidents.jsx : pas de niveaux
// d'alarme, pas de carnet de vaccination.

const mapIncident = (r) => ({
  id: r.id, enfantId: r.enfant_id, type: r.type, gravite: r.gravite, date: r.date,
  description: r.description, mesuresPrises: r.mesures_prises,
  parentPrevenu: r.parent_prevenu, resolu: r.resolu,
});
const mapSoin = (r) => ({
  id: r.id, enfantId: r.enfant_id, type: r.type, date: r.date, description: r.description,
  temperature: r.temperature, medicament: r.medicament, dosage: r.dosage,
  autorisationParent: r.autorisation_parent, parentPrevenu: r.parent_prevenu, aSuivre: r.a_suivre, notes: r.notes,
});

export const useSanteGarderieStore = create((set, get) => ({
  incidents: [],
  soins: [],

  chargerSante: async () => {
    const [incidents, soins] = await Promise.all([
      supabase.from("garderie_incidents").select("*").order("date", { ascending: false }),
      supabase.from("garderie_soins").select("*").order("date", { ascending: false }),
    ]);
    set({ incidents: (incidents.data || []).map(mapIncident), soins: (soins.data || []).map(mapSoin) });
  },

  reset: () => set({ incidents: [], soins: [] }),

  ajouterIncident: async (form, user) => {
    const { error } = await supabase.from("garderie_incidents").insert({
      enfant_id: form.enfantId, type: form.type, gravite: form.gravite, date: form.date,
      description: form.description, mesures_prises: form.mesuresPrises, parent_prevenu: !!form.parentPrevenu,
      cree_par: user?.uid || null,
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerSante();
    return { ok: true };
  },

  modifierIncident: async (id, form) => {
    const { error } = await supabase.from("garderie_incidents").update({
      type: form.type, gravite: form.gravite, date: form.date, description: form.description,
      mesures_prises: form.mesuresPrises, parent_prevenu: !!form.parentPrevenu, resolu: !!form.resolu,
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerSante();
    return { ok: true };
  },

  marquerIncidentResolu: async (id) => {
    const { error } = await supabase.from("garderie_incidents").update({ resolu: true }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? { ...i, resolu: true } : i)) }));
    return { ok: true };
  },

  ajouterSoin: async (form, user) => {
    const { error } = await supabase.from("garderie_soins").insert({
      enfant_id: form.enfantId, type: form.type, date: form.date, description: form.description,
      temperature: form.temperature ? Number(form.temperature) : null, medicament: form.medicament || "", dosage: form.dosage || "",
      autorisation_parent: !!form.autorisationParent, parent_prevenu: !!form.parentPrevenu, a_suivre: !!form.aSuivre, notes: form.notes || "",
      cree_par: user?.uid || null,
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerSante();
    return { ok: true };
  },

  modifierSoin: async (id, form) => {
    const { error } = await supabase.from("garderie_soins").update({
      type: form.type, date: form.date, description: form.description,
      temperature: form.temperature ? Number(form.temperature) : null, medicament: form.medicament || "", dosage: form.dosage || "",
      autorisation_parent: !!form.autorisationParent, parent_prevenu: !!form.parentPrevenu, a_suivre: !!form.aSuivre, notes: form.notes || "",
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerSante();
    return { ok: true };
  },
}));
