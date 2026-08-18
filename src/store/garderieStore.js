import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// Enfants + Paiements E-GARDERIE — moteur de revenu récurrent (tarif par
// enfant, historique de paiements, détection des impayés), avec suivi
// d'inscription (mensuel/annuel/court séjour) et frais de cantine.

const mapEnfant = (r) => ({
  id: r.id, nom: r.nom, prenom: r.prenom, dateNaissance: r.date_naissance,
  typeAbonnement: r.type_abonnement, tarif: Number(r.tarif) || 0, statut: r.statut,
  dateInscription: r.date_inscription, dureeSemaines: r.duree_semaines != null ? Number(r.duree_semaines) : null,
  fraisCantine: Number(r.frais_cantine) || 0,
});
const mapPaiement = (r) => ({
  id: r.id, enfantId: r.enfant_id, mois: r.mois, montant: Number(r.montant) || 0, date: r.date,
  modePaiement: r.mode_paiement, montantCantine: Number(r.montant_cantine) || 0,
});

export const useGarderieStore = create((set, get) => ({
  enfants: [],
  paiements: [],

  chargerGarderie: async () => {
    const [enfants, paiements] = await Promise.all([
      supabase.from("garderie_enfants").select("*").order("nom"),
      supabase.from("garderie_paiements").select("*").order("date", { ascending: false }),
    ]);
    set({ enfants: (enfants.data || []).map(mapEnfant), paiements: (paiements.data || []).map(mapPaiement) });
  },

  reset: () => set({ enfants: [], paiements: [] }),

  ajouterEnfant: async (form, user) => {
    const { error } = await supabase.from("garderie_enfants").insert({
      nom: form.nom.trim(), prenom: form.prenom.trim(), date_naissance: form.dateNaissance || null,
      type_abonnement: form.typeAbonnement, tarif: Number(form.tarif) || 0, statut: "actif", cree_par: user?.uid || null,
      date_inscription: form.dateInscription || new Date().toISOString().slice(0, 10),
      duree_semaines: form.typeAbonnement === "court_sejour" ? Math.max(2, parseInt(form.dureeSemaines) || 2) : null,
      frais_cantine: Number(form.fraisCantine) || 0,
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerGarderie();
    return { ok: true };
  },

  modifierEnfant: async (id, form) => {
    const { error } = await supabase.from("garderie_enfants").update({
      nom: form.nom.trim(), prenom: form.prenom.trim(), date_naissance: form.dateNaissance || null,
      type_abonnement: form.typeAbonnement, tarif: Number(form.tarif) || 0, statut: form.statut,
      date_inscription: form.dateInscription || new Date().toISOString().slice(0, 10),
      duree_semaines: form.typeAbonnement === "court_sejour" ? Math.max(2, parseInt(form.dureeSemaines) || 2) : null,
      frais_cantine: Number(form.fraisCantine) || 0,
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerGarderie();
    return { ok: true };
  },

  supprimerEnfant: async (id) => {
    const { error } = await supabase.from("garderie_enfants").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerGarderie();
    return { ok: true };
  },

  ajouterPaiement: async (form) => {
    const { error } = await supabase.from("garderie_paiements").insert({
      enfant_id: form.enfantId, mois: form.mois, montant: Number(form.montant) || 0, date: form.date,
      mode_paiement: form.modePaiement, montant_cantine: Number(form.montantCantine) || 0,
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerGarderie();
    return { ok: true };
  },

  supprimerPaiement: async (id) => {
    const { error } = await supabase.from("garderie_paiements").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerGarderie();
    return { ok: true };
  },
}));
