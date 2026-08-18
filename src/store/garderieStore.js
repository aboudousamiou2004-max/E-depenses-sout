import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// Enfants + Paiements E-GARDERIE — moteur de revenu récurrent (tarif par
// enfant, historique de paiements, détection des impayés), avec fiche
// d'inscription complète (identité, groupe/programme, parent/tuteur,
// santé) et frais de cantine.

const mapEnfant = (r) => ({
  id: r.id, nom: r.nom, prenom: r.prenom, dateNaissance: r.date_naissance, ageSaisi: r.age_saisi || "",
  sexe: r.sexe || "F", programme: r.programme || "", groupe: r.groupe || "",
  typeAbonnement: r.type_abonnement, tarif: Number(r.tarif) || 0, statut: r.statut,
  dateInscription: r.date_inscription, dureeSemaines: r.duree_semaines != null ? Number(r.duree_semaines) : null,
  fraisCantine: Number(r.frais_cantine) || 0,
  allergies: r.allergies || "", infoMedicale: r.info_medicale || "",
  parentNom: r.parent_nom || "", parentContact: r.parent_contact || "", parentContact2: r.parent_contact2 || "",
  parentProfession: r.parent_profession || "", adresse: r.adresse || "", notes: r.notes || "",
});
const mapPaiement = (r) => ({
  id: r.id, enfantId: r.enfant_id, mois: r.mois, montant: Number(r.montant) || 0, date: r.date,
  modePaiement: r.mode_paiement, montantCantine: Number(r.montant_cantine) || 0,
});

// Payload commun insert/update — un seul endroit à mettre à jour si un
// champ de la fiche d'inscription change.
const enfantColumns = (form) => ({
  nom: form.nom.trim(), prenom: form.prenom.trim(), date_naissance: form.dateNaissance || null, age_saisi: form.ageSaisi || "",
  sexe: form.sexe || "F", programme: form.programme || null, groupe: form.groupe || null,
  type_abonnement: form.typeAbonnement, tarif: Number(form.tarif) || 0,
  date_inscription: form.dateInscription || new Date().toISOString().slice(0, 10),
  duree_semaines: form.typeAbonnement === "court_sejour" ? Math.max(2, parseInt(form.dureeSemaines) || 2) : null,
  frais_cantine: Number(form.fraisCantine) || 0,
  allergies: form.allergies || "", info_medicale: form.infoMedicale || "",
  parent_nom: form.parentNom || "", parent_contact: form.parentContact || "", parent_contact2: form.parentContact2 || "",
  parent_profession: form.parentProfession || "", adresse: form.adresse || "", notes: form.notes || "",
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
    const { data, error } = await supabase
      .from("garderie_enfants")
      .insert({ ...enfantColumns(form), statut: "actif", cree_par: user?.uid || null })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await get().chargerGarderie();
    return { ok: true, enfant: mapEnfant(data) };
  },

  modifierEnfant: async (id, form) => {
    const { error } = await supabase.from("garderie_enfants").update({ ...enfantColumns(form), statut: form.statut }).eq("id", id);
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
