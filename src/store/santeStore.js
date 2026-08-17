import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// Santé animale MAXI AGRO — interventions (vaccinations/traitements) et stock
// de vaccins/produits. Même convention que stockStore.js/dataStore.js.

const mapVaccin = (r) => ({
  id: r.id, nom: r.nom, type: r.type, quantite: Number(r.quantite) || 0,
  unite: r.unite, seuilAlerte: Number(r.seuil_alerte) || 0, peremption: r.peremption, note: r.note,
});
const mapFiche = (r) => ({
  id: r.id, date: r.date, especeId: r.espece_id, especeNom: r.espece_nom, type: r.type,
  produit: r.produit, produitStockId: r.produit_stock_id, quantiteUtilisee: Number(r.quantite_utilisee) || 0,
  dosage: r.dosage, veterinaire: r.veterinaire, nombreAnimaux: Number(r.nombre_animaux) || 0,
  animauxIds: r.animaux_ids, prochainRdv: r.prochain_rdv, rdvNote: r.rdv_note, rdvFait: !!r.rdv_fait,
  description: r.description, creeParNom: r.cree_par_nom,
});

export const useSanteStore = create((set, get) => ({
  fiches: [],
  vaccins: [],

  chargerSante: async () => {
    const [fiches, vaccins] = await Promise.all([
      supabase.from("agro_sante").select("*").order("date", { ascending: false }),
      supabase.from("agro_vaccins").select("*").order("nom"),
    ]);
    set({ fiches: (fiches.data || []).map(mapFiche), vaccins: (vaccins.data || []).map(mapVaccin) });
  },

  reset: () => set({ fiches: [], vaccins: [] }),

  ajouterIntervention: async (form, user) => {
    const stockItem = get().vaccins.find((v) => v.id === form.produitStockId);
    const produitNom = stockItem?.nom || form.produit.trim();
    const qteUtil = parseInt(form.quantiteUtilisee) || 0;

    const { error } = await supabase.from("agro_sante").insert({
      date: form.date, espece_id: form.especeId, espece_nom: form.especeNom, type: form.type,
      produit: produitNom, produit_stock_id: form.produitStockId || null, quantite_utilisee: qteUtil,
      dosage: form.dosage, veterinaire: form.veterinaire, nombre_animaux: parseInt(form.nombreAnimaux) || 0,
      animaux_ids: form.animauxIds.trim(), prochain_rdv: form.prochainRdv || null, rdv_note: form.rdvNote,
      description: form.description, cree_par: user?.uid || null, cree_par_nom: user?.nom || "—",
    });
    if (error) return { ok: false, error: error.message };

    if (stockItem && qteUtil > 0) {
      await supabase.from("agro_vaccins").update({ quantite: Math.max(0, stockItem.quantite - qteUtil) }).eq("id", stockItem.id);
    }
    await get().chargerSante();
    return { ok: true };
  },

  supprimerIntervention: async (id) => {
    const { error } = await supabase.from("agro_sante").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerSante();
    return { ok: true };
  },

  clorreRdv: async (id) => {
    const { error } = await supabase.from("agro_sante").update({ rdv_fait: true }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerSante();
    return { ok: true };
  },

  enregistrerVaccin: async (form) => {
    const data = {
      nom: form.nom.trim(), type: form.type, quantite: parseInt(form.quantite) || 0,
      unite: form.unite.trim() || "unités", seuil_alerte: parseInt(form.seuilAlerte) || 0,
      peremption: form.peremption || null, note: form.note || "",
    };
    const { error } = form.id
      ? await supabase.from("agro_vaccins").update(data).eq("id", form.id)
      : await supabase.from("agro_vaccins").insert(data);
    if (error) return { ok: false, error: error.message };
    await get().chargerSante();
    return { ok: true };
  },

  supprimerVaccin: async (id) => {
    const { error } = await supabase.from("agro_vaccins").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerSante();
    return { ok: true };
  },
}));
