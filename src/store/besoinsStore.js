import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import { useDataStore } from "./dataStore";

// Besoins — volet transversal disponible dans tous les modules métier.
// Porté (simplifié) depuis
// termitiere-platform/src/shared/besoins/SectorBesoins.jsx. Le montant,
// statut, validation et demandeur sont recalculés/forcés côté serveur (voir
// migration_besoins.sql) — ce store ne fait que lire le résultat et
// déclencher les écritures brutes, même convention que dataStore.js.

export const CATEGORIES_BESOIN = [
  { id: "main_oeuvre", label: "Main d'œuvre" },
  { id: "materiaux", label: "Matériaux" },
  { id: "equipement", label: "Équipement" },
  { id: "financier", label: "Financier" },
  { id: "transport", label: "Transport" },
  { id: "autre", label: "Autre" },
];
export const catLabelBesoin = (id) => CATEGORIES_BESOIN.find((c) => c.id === id)?.label || id;

const mapBesoin = (r) => ({
  id: r.id, secteurId: r.secteur_id, titre: r.titre, categorie: r.categorie,
  quantite: Number(r.quantite) || 0, unite: r.unite, prixUnitaire: Number(r.prix_unitaire) || 0,
  montant: Number(r.montant) || 0, priorite: r.priorite, dateSouhaitee: r.date_souhaitee, note: r.note,
  statut: r.statut, validation: r.validation, motifRefus: r.motif_refus,
  observationAdmin: r.observation_admin, observationParNom: r.observation_par_nom, observationLe: r.observation_le,
  valideParNom: r.valide_par_nom, valideLe: r.valide_le, refuseParNom: r.refuse_par_nom, refuseLe: r.refuse_le,
  depenseId: r.depense_id, demandeParUid: r.demande_par, demandeParNom: r.demande_par_nom, createdAt: r.created_at,
});

export const useBesoinsStore = create((set, get) => ({
  besoins: [],

  chargerBesoins: async () => {
    const { data } = await supabase.from("besoins").select("*").order("created_at", { ascending: false });
    set({ besoins: (data || []).map(mapBesoin) });
  },

  reset: () => set({ besoins: [] }),

  ajouterBesoin: async (secteurId, form) => {
    const { error } = await supabase.from("besoins").insert({
      secteur_id: secteurId, titre: form.titre.trim(), categorie: form.categorie,
      quantite: Number(form.quantite) || 0, unite: form.unite || "", prix_unitaire: Number(form.prixUnitaire) || 0,
      priorite: form.priorite, date_souhaitee: form.dateSouhaitee || null, note: form.note || "",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerBesoins();
    return { ok: true };
  },

  modifierBesoin: async (id, form) => {
    const { error } = await supabase.from("besoins").update({
      titre: form.titre.trim(), categorie: form.categorie, quantite: Number(form.quantite) || 0,
      unite: form.unite || "", prix_unitaire: Number(form.prixUnitaire) || 0, priorite: form.priorite,
      date_souhaitee: form.dateSouhaitee || null, note: form.note || "",
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerBesoins();
    return { ok: true };
  },

  supprimerBesoin: async (id) => {
    const { error } = await supabase.from("besoins").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerBesoins();
    return { ok: true };
  },

  changerStatutBesoin: async (id, statut) => {
    const { error } = await supabase.from("besoins").update({ statut }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerBesoins();
    return { ok: true };
  },

  // Valider crée aussitôt une dépense réelle (même circuit d'autorisation que
  // toute autre dépense) puis marque le besoin validé — même logique que
  // creerDemandeDecaissement() sur la vraie plateforme.
  validerBesoin: async (besoin, user) => {
    const resDepense = await useDataStore.getState().addDepense({
      secteurId: besoin.secteurId, categorie: catLabelBesoin(besoin.categorie), montant: besoin.montant,
      date: new Date().toISOString().slice(0, 10), description: besoin.titre, natureFlux: "exploitation",
      sourceFinancement: "entreprise", beneficiaireNom: besoin.demandeParNom || "", besoinId: besoin.id,
    }, user);
    if (!resDepense.ok) return resDepense;
    const { error } = await supabase.from("besoins").update({
      validation: "valide", valide_par_nom: user?.nom || "—", valide_le: new Date().toISOString(), depense_id: resDepense.depense.id,
    }).eq("id", besoin.id);
    if (error) return { ok: false, error: error.message };
    await get().chargerBesoins();
    return { ok: true };
  },

  refuserBesoin: async (id, motif, user) => {
    const { error } = await supabase.from("besoins").update({
      validation: "refuse", motif_refus: motif || "", statut: "annule",
      refuse_par_nom: user?.nom || "—", refuse_le: new Date().toISOString(),
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerBesoins();
    return { ok: true };
  },

  enregistrerObservation: async (id, texte, user) => {
    const { error } = await supabase.from("besoins").update({
      observation_admin: texte.trim(), observation_par_nom: user?.nom || "—", observation_le: new Date().toISOString(),
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerBesoins();
    return { ok: true };
  },
}));
