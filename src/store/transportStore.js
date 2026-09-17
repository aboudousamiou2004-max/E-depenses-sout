import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// Volet « Transport », partagé par tout secteur avec `transport: true` dans
// PRESETS (MAXI LOGISTIQUE, E-BRIQUETERIE — voir lib/modules.js), table
// commune filtrée par secteur_id : suivi opérationnel des courses (client,
// heure de départ obligatoire, heure d'arrivée renseignée au clic sur
// « Arrivé » ou modifiable à la main, véhicule, chauffeur, date, montant).
// Seuls l'heure de départ et le montant sont obligatoires — l'arrivée n'est
// pas toujours connue à l'avance. Même convention que besoinsStore.js /
// comStore.js.

export const STATUTS_TRANSPORT = [
  { id: "planifie", label: "Planifié", tone: "ink" },
  { id: "en_cours", label: "En cours", tone: "accent" },
  { id: "termine", label: "Terminé", tone: "mint" },
  { id: "annule", label: "Annulé", tone: "coral" },
];
export const statutTransportLabel = (id) => STATUTS_TRANSPORT.find((s) => s.id === id)?.label || id;

const mapTransport = (r) => ({
  id: r.id, secteurId: r.secteur_id, client: r.client || "", depart: r.depart || "", arrivee: r.arrivee || "",
  vehicule: r.vehicule || "", chauffeur: r.chauffeur || "", montant: Number(r.montant) || 0,
  statut: r.statut, date: r.date, note: r.note || "", createdAt: r.created_at,
});

export const useTransportStore = create((set, get) => ({
  transports: [],

  reset: () => set({ transports: [] }),

  chargerTransports: async (secteurId) => {
    const { data } = await supabase.from("logistique_transports").select("*").eq("secteur_id", secteurId).order("date", { ascending: false });
    set({ transports: (data || []).map(mapTransport) });
  },

  ajouterTransport: async (secteurId, form) => {
    const { data, error } = await supabase.from("logistique_transports").insert({
      secteur_id: secteurId, client: form.client || "", depart: form.depart || "", arrivee: form.arrivee || null,
      vehicule: form.vehicule || "", chauffeur: form.chauffeur || "", montant: Number(form.montant) || 0,
      statut: form.statut || "planifie", date: form.date || new Date().toISOString().slice(0, 10), note: form.note || "",
    }).select().single();
    if (error) return { ok: false, error: error.message };
    await get().chargerTransports(secteurId);
    return { ok: true, id: data.id };
  },

  modifierTransport: async (id, form) => {
    const { error } = await supabase.from("logistique_transports").update({
      client: form.client || "", depart: form.depart || "", arrivee: form.arrivee || null,
      vehicule: form.vehicule || "", chauffeur: form.chauffeur || "", montant: Number(form.montant) || 0,
      statut: form.statut, date: form.date, note: form.note || "",
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ transports: get().transports.map((t) => (t.id === id ? { ...t, ...form, arrivee: form.arrivee || "", montant: Number(form.montant) || 0 } : t)) });
    return { ok: true };
  },

  changerStatutTransport: async (id, statut) => {
    const { error } = await supabase.from("logistique_transports").update({ statut }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ transports: get().transports.map((t) => (t.id === id ? { ...t, statut } : t)) });
    return { ok: true };
  },

  // Bouton « Arrivé » : enregistre l'heure actuelle comme heure d'arrivée et
  // clôt automatiquement la course, sans passer par le formulaire complet.
  marquerArriveeTransport: async (id) => {
    const heure = new Date().toTimeString().slice(0, 5);
    const { error } = await supabase.from("logistique_transports").update({ arrivee: heure, statut: "termine" }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ transports: get().transports.map((t) => (t.id === id ? { ...t, arrivee: heure, statut: "termine" } : t)) });
    return { ok: true };
  },

  supprimerTransport: async (id) => {
    const { error } = await supabase.from("logistique_transports").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ transports: get().transports.filter((t) => t.id !== id) });
    return { ok: true };
  },
}));
