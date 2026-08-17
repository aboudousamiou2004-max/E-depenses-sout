import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// Dossiers fonciers E-FONCIER — dossier + frais catégorisés (traçabilité des
// coûts). Même convention que les autres stores métier.

const mapDossier = (r) => ({
  id: r.id, numero: r.numero, type: r.type, commune: r.commune, proprietaire: r.proprietaire,
  dateOuverture: r.date_ouverture, statut: r.statut, notes: r.notes, creeParNom: r.cree_par_nom,
});
const mapFrais = (r) => ({ id: r.id, dossierId: r.dossier_id, categorie: r.categorie, libelle: r.libelle, montant: Number(r.montant) || 0, date: r.date });

export const useFoncierStore = create((set, get) => ({
  dossiers: [],
  frais: [],

  chargerFoncier: async () => {
    const [dossiers, frais] = await Promise.all([
      supabase.from("foncier_dossiers").select("*").order("date_ouverture", { ascending: false }),
      supabase.from("foncier_frais").select("*").order("date"),
    ]);
    set({ dossiers: (dossiers.data || []).map(mapDossier), frais: (frais.data || []).map(mapFrais) });
  },

  reset: () => set({ dossiers: [], frais: [] }),

  ajouterDossier: async (form, user) => {
    const numero = `FON-${String(get().dossiers.length + 1).padStart(3, "0")}`;
    const { data, error } = await supabase.from("foncier_dossiers").insert({
      numero, type: form.type, commune: form.commune, proprietaire: form.proprietaire,
      date_ouverture: form.dateOuverture, statut: "ouvert", notes: form.notes || "",
      cree_par: user?.uid || null, cree_par_nom: user?.nom || "—",
    }).select().single();
    if (error) return { ok: false, error: error.message };
    await get().chargerFoncier();
    return { ok: true, dossier: mapDossier(data) };
  },

  modifierDossier: async (id, form) => {
    const { error } = await supabase.from("foncier_dossiers").update({
      type: form.type, commune: form.commune, proprietaire: form.proprietaire,
      date_ouverture: form.dateOuverture, statut: form.statut, notes: form.notes || "",
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerFoncier();
    return { ok: true };
  },

  supprimerDossier: async (id) => {
    const { error } = await supabase.from("foncier_dossiers").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerFoncier();
    return { ok: true };
  },

  ajouterFrais: async (dossierId, form) => {
    const { error } = await supabase.from("foncier_frais").insert({
      dossier_id: dossierId, categorie: form.categorie, libelle: form.libelle || "", montant: Number(form.montant) || 0, date: form.date,
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerFoncier();
    return { ok: true };
  },

  supprimerFrais: async (id) => {
    const { error } = await supabase.from("foncier_frais").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerFoncier();
    return { ok: true };
  },
}));
