import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// Projets & Tâches E-G.PRO — porté (simplifié) depuis
// termitiere-platform/src/modules/projet/{Projets,Taches}.jsx. Les
// versements à un prestataire (tâche) créent une dépense réelle via
// dataStore.addDepense (voir Taches.jsx) — ce store ne gère que
// projets/tâches/versements client.

const mapProjet = (r) => ({
  id: r.id, num: r.num, nom: r.nom, type: r.type, statut: r.statut, priorite: r.priorite,
  responsable: r.responsable, budget: Number(r.budget) || 0,
  dateDebut: r.date_debut, dateFin: r.date_fin, dureeIndeterminee: !!r.duree_indeterminee,
  pourClient: r.pour_client !== false, clientNom: r.client_nom, clientTelephone: r.client_telephone,
  montantContrat: Number(r.montant_contrat) || 0, usageInterne: r.usage_interne,
  description: r.description, creeParNom: r.cree_par_nom, createdAt: r.created_at,
});
const mapTache = (r) => ({
  id: r.id, projetId: r.projet_id, titre: r.titre, phase: r.phase, assignee: r.assignee,
  priorite: r.priorite, statut: r.statut, dateDebut: r.date_debut, echeance: r.echeance,
  montantPrevu: r.montant_prevu != null ? Number(r.montant_prevu) : null, note: r.note,
  prestataireNom: r.prestataire_nom, prestataireMetier: r.prestataire_metier, prestataireTelephone: r.prestataire_telephone,
  createdAt: r.created_at,
});
const mapVersementClient = (r) => ({
  id: r.id, projetId: r.projet_id, montant: Number(r.montant) || 0, date: r.date, note: r.note,
  creeParNom: r.cree_par_nom, createdAt: r.created_at,
});

export const useEgproStore = create((set, get) => ({
  projets: [],
  taches: [],
  versementsClient: [],

  chargerEgpro: async () => {
    const [projets, taches, versementsClient] = await Promise.all([
      supabase.from("egpro_projets").select("*").order("created_at", { ascending: false }),
      supabase.from("egpro_taches").select("*").order("created_at", { ascending: false }),
      supabase.from("egpro_versements_client").select("*").order("date", { ascending: false }),
    ]);
    set({
      projets: (projets.data || []).map(mapProjet),
      taches: (taches.data || []).map(mapTache),
      versementsClient: (versementsClient.data || []).map(mapVersementClient),
    });
  },

  reset: () => set({ projets: [], taches: [], versementsClient: [] }),

  ajouterProjet: async (form, user) => {
    const num = `EGP-${String(get().projets.length + 1).padStart(3, "0")}`;
    const { data, error } = await supabase.from("egpro_projets").insert({
      num, nom: form.nom, type: form.type, priorite: form.priorite, responsable: form.responsable || "",
      budget: Number(form.budget) || 0, date_debut: form.dateDebut || null, date_fin: form.dureeIndeterminee ? null : (form.dateFin || null),
      duree_indeterminee: !!form.dureeIndeterminee, pour_client: !!form.pourClient,
      client_nom: form.pourClient ? (form.clientNom || "") : "", client_telephone: form.pourClient ? (form.clientTelephone || "") : "",
      montant_contrat: form.pourClient ? (Number(form.montantContrat) || 0) : 0, usage_interne: !form.pourClient ? (form.usageInterne || "") : "",
      description: form.description || "", cree_par: user?.uid || null, cree_par_nom: user?.nom || "—",
    }).select().single();
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true, projet: mapProjet(data) };
  },

  modifierProjet: async (id, form) => {
    const { error } = await supabase.from("egpro_projets").update({
      nom: form.nom, type: form.type, priorite: form.priorite, responsable: form.responsable || "",
      budget: Number(form.budget) || 0, date_debut: form.dateDebut || null, date_fin: form.dureeIndeterminee ? null : (form.dateFin || null),
      duree_indeterminee: !!form.dureeIndeterminee, pour_client: !!form.pourClient,
      client_nom: form.pourClient ? (form.clientNom || "") : "", client_telephone: form.pourClient ? (form.clientTelephone || "") : "",
      montant_contrat: form.pourClient ? (Number(form.montantContrat) || 0) : 0, usage_interne: !form.pourClient ? (form.usageInterne || "") : "",
      description: form.description || "", updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true };
  },

  supprimerProjet: async (id) => {
    const { error } = await supabase.from("egpro_projets").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true };
  },

  demarrerProjet: async (projet) => {
    const { error } = await supabase.from("egpro_projets").update({
      statut: "en_cours", date_debut: projet.dateDebut || new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString(),
    }).eq("id", projet.id);
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true };
  },

  terminerProjet: async (id) => {
    const { error } = await supabase.from("egpro_projets").update({ statut: "termine", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true };
  },

  ajouterVersementClient: async (projetId, form, user) => {
    const { error } = await supabase.from("egpro_versements_client").insert({
      projet_id: projetId, montant: Number(form.montant) || 0, date: form.date, note: form.note || "", cree_par_nom: user?.nom || "—",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true };
  },

  supprimerVersementClient: async (id) => {
    const { error } = await supabase.from("egpro_versements_client").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true };
  },

  ajouterTache: async (form) => {
    const { data, error } = await supabase.from("egpro_taches").insert({
      projet_id: form.projetId, titre: form.titre, phase: form.phase || "", assignee: form.assignee || "",
      priorite: form.priorite, statut: form.statut || "a_faire", date_debut: form.dateDebut || null, echeance: form.echeance || null,
      montant_prevu: form.montantPrevu !== "" ? Number(form.montantPrevu) : null, note: form.note || "",
      prestataire_nom: form.prestataireNom || "", prestataire_metier: form.prestataireMetier || "", prestataire_telephone: form.prestataireTelephone || "",
    }).select().single();
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true, tache: mapTache(data) };
  },

  modifierTache: async (id, form) => {
    const { error } = await supabase.from("egpro_taches").update({
      projet_id: form.projetId, titre: form.titre, phase: form.phase || "", assignee: form.assignee || "",
      priorite: form.priorite, statut: form.statut, date_debut: form.dateDebut || null, echeance: form.echeance || null,
      montant_prevu: form.montantPrevu !== "" ? Number(form.montantPrevu) : null, note: form.note || "",
      prestataire_nom: form.prestataireNom || "", prestataire_metier: form.prestataireMetier || "", prestataire_telephone: form.prestataireTelephone || "",
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true };
  },

  supprimerTache: async (id) => {
    const { error } = await supabase.from("egpro_taches").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true };
  },

  avancerTache: async (tache) => {
    const progression = { a_faire: "en_cours", en_cours: "en_revision", en_revision: "terminee" };
    const next = progression[tache.statut];
    if (!next) return { ok: false, error: "Aucune progression possible" };
    const { error } = await supabase.from("egpro_taches").update({ statut: next, updated_at: new Date().toISOString() }).eq("id", tache.id);
    if (error) return { ok: false, error: error.message };
    await get().chargerEgpro();
    return { ok: true };
  },
}));
