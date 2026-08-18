import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import { TYPES_MOUVEMENT_ANIMAL } from "../data/stockData";

// Comme dataStore.js : les soldes de stock ne sont plus calculés en mémoire à
// partir d'un journal local, mais lus depuis les vues Postgres v_stock_* (voir
// supabase/schema.sql) qui font le même calcul côté serveur. Les fonctions
// stockArticle()/stockMatiere()/effectifEspece() restent des lectures
// synchrones d'un état déjà chargé — les composants qui les appellent en ligne
// (ex. `stockArticle(a.id)` dans un .map()) n'ont donc pas besoin de changer.

const nextId = (p) => `${p}_${crypto.randomUUID()}`;

const mapArticle = (r) => ({ id: r.id, nom: r.nom, cat: r.cat, unite: r.unite, coutAchat: Number(r.cout_achat), tarifLocation: Number(r.tarif_location) || 0 });
const mapMouvementMateriel = (r) => ({ id: r.id, date: r.date, articleId: r.article_id, type: r.type, quantite: Number(r.quantite), motif: r.motif, agentNom: r.agent_nom });
const mapMatiere = (r) => ({ id: r.id, nom: r.nom, unite: r.unite });
const mapMouvementMatiere = (r) => ({ id: r.id, date: r.date, matiereId: r.matiere_id, type: r.type, quantite: Number(r.quantite), agentNom: r.agent_nom });
const mapTypeBrique = (r) => ({ id: r.id, nom: r.nom, tarifVente: Number(r.tarif_vente), rendement: Number(r.rendement) || 0 });
const mapJournalBrique = (r) => ({
  id: r.id,
  date: r.date,
  typeId: r.type_id,
  action: r.action === "production" ? "Production" : r.action === "vente" ? "Vente" : `${r.etat_de} → ${r.etat_vers}`,
  quantite: Number(r.quantite),
  agentNom: r.agent_nom,
});
const mapEspece = (r) => ({ id: r.id, nom: r.nom, cat: r.cat, initQuantite: Number(r.init_quantite) || 0 });
const mapMouvementAnimal = (r) => ({ id: r.id, date: r.date, especeId: r.espece_id, type: r.type, quantite: Number(r.quantite), motif: r.motif, agentNom: r.agent_nom });
const mapArticleAgro = (r) => ({ id: r.id, nom: r.nom, cat: r.cat, unite: r.unite, initQuantite: Number(r.init_quantite) || 0 });
const mapMouvementArticleAgro = (r) => ({ id: r.id, date: r.date, articleId: r.article_id, type: r.type, quantite: Number(r.quantite), motif: r.motif, agentNom: r.agent_nom });
const mapAnimalIndividuel = (r) => ({
  id: r.id, especeId: r.espece_id, identifiant: r.identifiant, sexe: r.sexe,
  dateEntree: r.date_entree, statut: r.statut, dateSortie: r.date_sortie, motifSortie: r.motif_sortie, notes: r.notes,
  valeurMarchande: Number(r.valeur_marchande) || 0,
});
// Catégories dont les animaux sont identifiés individuellement (boucle/tag) —
// jamais la volaille, qui se gère par décompte agrégé en usage réel.
export const CAT_ANIMAUX_IDENTIFIES = ["BOVINS", "OVINS", "CAPRINS"];

export const useStockStore = create((set, get) => ({
  referentielMateriel: [],
  mouvementsMateriel: [],
  soldeMateriel: {},

  referentielMatieres: [],
  mouvementsMatieres: [],
  soldeMatieres: {},

  typesBriques: [],
  stockBriques: {},
  journalBriques: [],

  referentielAnimaux: [],
  mouvementsAnimaux: [],
  soldeAnimaux: {},
  maladesAnimaux: [], // [{ especeId, date, quantite }] — un par (espèce, jour)

  // Magasin MAXI AGRO — matériel/machines + aliments (silo), et registre
  // individuel des animaux identifiés (bovins/ovins/caprins).
  referentielMaterielAgro: [],
  mouvementsMaterielAgro: [],
  soldeMaterielAgro: {},
  referentielAliments: [],
  mouvementsAliments: [],
  soldeAliments: {},
  animauxIndividuels: [],

  prixSacCiment: 0,

  chargerTout: async () => {
    const [refMat, mvtMat, soldeMat, refMatieres, mvtMatieres, soldeMatieres, typesBriques, soldeBriques, journalBriques, refAnimaux, mvtAnimaux, soldeAnimaux, briqueterieConfig, maladesAnimaux, animauxIndividuels] =
      await Promise.all([
        supabase.from("referentiel_materiel").select("*"),
        supabase.from("mouvements_materiel").select("*").order("created_at", { ascending: false }),
        supabase.from("v_stock_materiel").select("*"),
        supabase.from("referentiel_matieres").select("*"),
        supabase.from("mouvements_matieres").select("*").order("created_at", { ascending: false }),
        supabase.from("v_stock_matieres").select("*"),
        supabase.from("types_briques").select("*"),
        supabase.from("v_stock_briques").select("*"),
        supabase.from("journal_briques").select("*").order("created_at", { ascending: false }),
        supabase.from("referentiel_animaux").select("*"),
        supabase.from("mouvements_animaux").select("*").order("created_at", { ascending: false }),
        supabase.from("v_effectif_animaux").select("*"),
        supabase.from("briqueterie_config").select("*").eq("id", "defaut").maybeSingle(),
        supabase.from("agro_malades").select("*"),
        supabase.from("agro_animaux_individuels").select("*"),
      ]);

    const stockBriques = {};
    (soldeBriques.data || []).forEach((r) => {
      stockBriques[r.type_id] = stockBriques[r.type_id] || {};
      stockBriques[r.type_id][r.etat] = Number(r.quantite);
    });

    set({
      referentielMateriel: (refMat.data || []).map(mapArticle),
      mouvementsMateriel: (mvtMat.data || []).map(mapMouvementMateriel),
      soldeMateriel: Object.fromEntries((soldeMat.data || []).map((r) => [r.article_id, Number(r.solde)])),
      referentielMatieres: (refMatieres.data || []).map(mapMatiere),
      mouvementsMatieres: (mvtMatieres.data || []).map(mapMouvementMatiere),
      soldeMatieres: Object.fromEntries((soldeMatieres.data || []).map((r) => [r.matiere_id, Number(r.solde)])),
      typesBriques: (typesBriques.data || []).map(mapTypeBrique),
      stockBriques,
      journalBriques: (journalBriques.data || []).map(mapJournalBrique),
      referentielAnimaux: (refAnimaux.data || []).map(mapEspece),
      mouvementsAnimaux: (mvtAnimaux.data || []).map(mapMouvementAnimal),
      soldeAnimaux: Object.fromEntries((soldeAnimaux.data || []).map((r) => [r.espece_id, Number(r.effectif)])),
      prixSacCiment: Number(briqueterieConfig.data?.prix_sac_ciment) || 0,
      maladesAnimaux: (maladesAnimaux.data || []).map((r) => ({ especeId: r.espece_id, date: r.date, quantite: Number(r.quantite) || 0 })),
      animauxIndividuels: (animauxIndividuels.data || []).map(mapAnimalIndividuel),
    });
  },

  reset: () =>
    set({
      referentielMateriel: [], mouvementsMateriel: [], soldeMateriel: {},
      referentielMatieres: [], mouvementsMatieres: [], soldeMatieres: {},
      typesBriques: [], stockBriques: {}, journalBriques: [],
      referentielAnimaux: [], mouvementsAnimaux: [], soldeAnimaux: {},
      prixSacCiment: 0, maladesAnimaux: [], animauxIndividuels: [],
      referentielMaterielAgro: [], mouvementsMaterielAgro: [], soldeMaterielAgro: {},
      referentielAliments: [], mouvementsAliments: [], soldeAliments: {},
    }),

  stockArticle: (articleId) => get().soldeMateriel[articleId] || 0,
  stockMatiere: (matiereId) => get().soldeMatieres[matiereId] || 0,
  effectifEspece: (especeId) => get().soldeAnimaux[especeId] || 0,
  stockArticleAgro: (articleId) => get().soldeMaterielAgro[articleId] || 0,
  stockAliment: (articleId) => get().soldeAliments[articleId] || 0,

  chargerStockMateriel: async () => {
    const [ref, mvt, solde] = await Promise.all([
      supabase.from("referentiel_materiel").select("*"),
      supabase.from("mouvements_materiel").select("*").order("created_at", { ascending: false }),
      supabase.from("v_stock_materiel").select("*"),
    ]);
    set({
      referentielMateriel: (ref.data || []).map(mapArticle),
      mouvementsMateriel: (mvt.data || []).map(mapMouvementMateriel),
      soldeMateriel: Object.fromEntries((solde.data || []).map((r) => [r.article_id, Number(r.solde)])),
    });
  },

  chargerStockMatieres: async () => {
    const [mvt, solde] = await Promise.all([
      supabase.from("mouvements_matieres").select("*").order("created_at", { ascending: false }),
      supabase.from("v_stock_matieres").select("*"),
    ]);
    set({
      mouvementsMatieres: (mvt.data || []).map(mapMouvementMatiere),
      soldeMatieres: Object.fromEntries((solde.data || []).map((r) => [r.matiere_id, Number(r.solde)])),
    });
  },

  chargerStockBriques: async () => {
    const [journal, solde] = await Promise.all([
      supabase.from("journal_briques").select("*").order("created_at", { ascending: false }),
      supabase.from("v_stock_briques").select("*"),
    ]);
    const stockBriques = {};
    (solde.data || []).forEach((r) => {
      stockBriques[r.type_id] = stockBriques[r.type_id] || {};
      stockBriques[r.type_id][r.etat] = Number(r.quantite);
    });
    set({ journalBriques: (journal.data || []).map(mapJournalBrique), stockBriques });
  },

  chargerStockAnimaux: async () => {
    const [ref, mvt, solde] = await Promise.all([
      supabase.from("referentiel_animaux").select("*"),
      supabase.from("mouvements_animaux").select("*").order("created_at", { ascending: false }),
      supabase.from("v_effectif_animaux").select("*"),
    ]);
    set({
      referentielAnimaux: (ref.data || []).map(mapEspece),
      mouvementsAnimaux: (mvt.data || []).map(mapMouvementAnimal),
      soldeAnimaux: Object.fromEntries((solde.data || []).map((r) => [r.espece_id, Number(r.effectif)])),
    });
  },

  ajouterArticleMateriel: async (payload) => {
    const { data, error } = await supabase
      .from("referentiel_materiel")
      .insert({ id: nextId("art"), nom: payload.nom, cat: payload.cat, unite: payload.unite || "unités", cout_achat: Number(payload.coutAchat) || 0, tarif_location: Number(payload.tarifLocation) || 0 })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await get().chargerStockMateriel();
    return { ok: true, article: mapArticle(data) };
  },

  addMouvementMateriel: async (payload, user) => {
    const { error } = await supabase.from("mouvements_materiel").insert({
      date: payload.date,
      article_id: payload.articleId,
      type: payload.type,
      quantite: Number(payload.quantite),
      motif: payload.motif || "",
      agent_id: user?.uid || null,
      agent_nom: user?.nom || "Agent",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerStockMateriel();
    return { ok: true };
  },

  addMouvementMatiere: async (payload, user) => {
    const { error } = await supabase.from("mouvements_matieres").insert({
      date: payload.date,
      matiere_id: payload.matiereId,
      type: payload.type,
      quantite: Number(payload.quantite),
      agent_id: user?.uid || null,
      agent_nom: user?.nom || "Agent",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerStockMatieres();
    return { ok: true };
  },

  ajouterProduction: async (typeId, quantite, user) => {
    const { error } = await supabase.from("journal_briques").insert({
      date: new Date().toISOString().slice(0, 10),
      type_id: typeId,
      action: "production",
      quantite: Number(quantite),
      agent_id: user?.uid || null,
      agent_nom: user?.nom || "Agent",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerStockBriques();
    return { ok: true };
  },

  transitionBrique: async (typeId, de, vers, quantite, user) => {
    const { error } = await supabase.from("journal_briques").insert({
      date: new Date().toISOString().slice(0, 10),
      type_id: typeId,
      action: "transition",
      etat_de: de,
      etat_vers: vers,
      quantite: Number(quantite),
      agent_id: user?.uid || null,
      agent_nom: user?.nom || "Agent",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerStockBriques();
    return { ok: true };
  },

  // Décrémente le stock "prêt" lors d'une vente facturée — appelé depuis
  // BusinessFacturation quand le type est "Vente de briques".
  venteBriques: async (typeId, quantite, user) => {
    const { error } = await supabase.from("journal_briques").insert({
      date: new Date().toISOString().slice(0, 10),
      type_id: typeId,
      action: "vente",
      etat_de: "pret",
      quantite: Number(quantite),
      agent_id: user?.uid || null,
      agent_nom: user?.nom || "Agent",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerStockBriques();
    return { ok: true };
  },

  enregistrerPrixSacCiment: async (prix) => {
    const { error } = await supabase.from("briqueterie_config").update({ prix_sac_ciment: Number(prix) || 0, updated_at: new Date().toISOString() }).eq("id", "defaut");
    if (error) return { ok: false, error: error.message };
    set({ prixSacCiment: Number(prix) || 0 });
    return { ok: true };
  },

  enregistrerRendement: async (typeId, rendement) => {
    const { error } = await supabase.from("types_briques").update({ rendement: Number(rendement) || 0 }).eq("id", typeId);
    if (error) return { ok: false, error: error.message };
    set((s) => ({ typesBriques: s.typesBriques.map((t) => (t.id === typeId ? { ...t, rendement: Number(rendement) || 0 } : t)) }));
    return { ok: true };
  },

  ajouterEspece: async (payload) => {
    const { data, error } = await supabase
      .from("referentiel_animaux")
      .insert({ id: nextId("esp"), nom: payload.nom, cat: payload.cat })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await get().chargerStockAnimaux();
    return { ok: true, espece: mapEspece(data) };
  },

  addMouvementAnimal: async (payload, user) => {
    const info = TYPES_MOUVEMENT_ANIMAL[payload.type];
    const { error } = await supabase.from("mouvements_animaux").insert({
      date: payload.date,
      espece_id: payload.especeId,
      type: payload.type,
      quantite: info.signe * Math.abs(Number(payload.quantite)),
      motif: payload.motif || "",
      agent_id: user?.uid || null,
      agent_nom: user?.nom || "Agent",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerStockAnimaux();
    return { ok: true };
  },

  supprimerMouvementAnimal: async (id) => {
    const { error } = await supabase.from("mouvements_animaux").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerStockAnimaux();
    return { ok: true };
  },

  // Décompte des animaux malades d'une espèce à une date — un enregistrement
  // par (espèce, jour), comme EF Initial/Final. Sert au calcul des taux de
  // létalité/morbidité du Dashboard MAXI AGRO.
  enregistrerMalades: async (especeId, date, quantite) => {
    const { error } = await supabase.from("agro_malades").upsert(
      { espece_id: especeId, date, quantite: Math.max(0, parseInt(quantite) || 0), updated_at: new Date().toISOString() },
      { onConflict: "espece_id,date" }
    );
    if (error) return { ok: false, error: error.message };
    set((s) => {
      const idx = s.maladesAnimaux.findIndex((m) => m.especeId === especeId && m.date === date);
      const entry = { especeId, date, quantite: Math.max(0, parseInt(quantite) || 0) };
      const next = [...s.maladesAnimaux];
      if (idx >= 0) next[idx] = entry; else next.push(entry);
      return { maladesAnimaux: next };
    });
    return { ok: true };
  },

  // ─────────── Magasin MAXI AGRO : matériel/machines ───────────
  chargerMagasinAgro: async () => {
    const [refMat, mvtMat, soldeMat, refAlim, mvtAlim, soldeAlim] = await Promise.all([
      supabase.from("agro_materiel").select("*"),
      supabase.from("agro_mouvements_materiel").select("*").order("created_at", { ascending: false }),
      supabase.from("v_agro_materiel").select("*"),
      supabase.from("agro_aliments").select("*"),
      supabase.from("agro_mouvements_aliments").select("*").order("created_at", { ascending: false }),
      supabase.from("v_agro_aliments").select("*"),
    ]);
    set({
      referentielMaterielAgro: (refMat.data || []).map(mapArticleAgro),
      mouvementsMaterielAgro: (mvtMat.data || []).map(mapMouvementArticleAgro),
      soldeMaterielAgro: Object.fromEntries((soldeMat.data || []).map((r) => [r.article_id, Number(r.solde)])),
      referentielAliments: (refAlim.data || []).map(mapArticleAgro),
      mouvementsAliments: (mvtAlim.data || []).map(mapMouvementArticleAgro),
      soldeAliments: Object.fromEntries((soldeAlim.data || []).map((r) => [r.article_id, Number(r.solde)])),
    });
  },

  ajouterMaterielAgro: async (payload) => {
    const { data, error } = await supabase
      .from("agro_materiel")
      .insert({ id: nextId("mat"), nom: payload.nom, cat: payload.cat, unite: payload.unite || "unités", init_quantite: Math.max(0, parseInt(payload.initQuantite) || 0) })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await get().chargerMagasinAgro();
    return { ok: true, article: mapArticleAgro(data) };
  },

  addMouvementMaterielAgro: async (payload, user) => {
    const { error } = await supabase.from("agro_mouvements_materiel").insert({
      date: payload.date, article_id: payload.articleId, type: payload.type,
      quantite: Math.abs(Number(payload.quantite)), motif: payload.motif || "",
      agent_id: user?.uid || null, agent_nom: user?.nom || "Agent",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerMagasinAgro();
    return { ok: true };
  },

  ajouterAliment: async (payload) => {
    const { data, error } = await supabase
      .from("agro_aliments")
      .insert({ id: nextId("alim"), nom: payload.nom, cat: payload.cat, unite: payload.unite || "kg", init_quantite: Math.max(0, parseInt(payload.initQuantite) || 0) })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await get().chargerMagasinAgro();
    return { ok: true, article: mapArticleAgro(data) };
  },

  addMouvementAliment: async (payload, user) => {
    const { error } = await supabase.from("agro_mouvements_aliments").insert({
      date: payload.date, article_id: payload.articleId, type: payload.type,
      quantite: Math.abs(Number(payload.quantite)), motif: payload.motif || "",
      agent_id: user?.uid || null, agent_nom: user?.nom || "Agent",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerMagasinAgro();
    return { ok: true };
  },

  // ─────────── Registre individuel (bovins/ovins/caprins) ───────────
  chargerAnimauxIndividuels: async () => {
    const { data } = await supabase.from("agro_animaux_individuels").select("*");
    set({ animauxIndividuels: (data || []).map(mapAnimalIndividuel) });
  },

  ajouterAnimalIndividuel: async (payload) => {
    const { data, error } = await supabase
      .from("agro_animaux_individuels")
      .insert({
        espece_id: payload.especeId, identifiant: payload.identifiant.trim(),
        sexe: payload.sexe || null, date_entree: payload.dateEntree || new Date().toISOString().slice(0, 10),
        notes: payload.notes || "",
      })
      .select()
      .single();
    if (error) return { ok: false, error: error.message.includes("duplicate") ? "Cet identifiant existe déjà pour cette espèce" : error.message };
    set((s) => ({ animauxIndividuels: [...s.animauxIndividuels, mapAnimalIndividuel(data)] }));
    return { ok: true, animal: mapAnimalIndividuel(data) };
  },

  // statut : 'vendu' | 'mort' | 'perdu'
  sortirAnimalIndividuel: async (id, statut, date, motif) => {
    const { error } = await supabase.from("agro_animaux_individuels")
      .update({ statut, date_sortie: date, motif_sortie: motif || "" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    set((s) => ({ animauxIndividuels: s.animauxIndividuels.map((a) => (a.id === id ? { ...a, statut, dateSortie: date, motifSortie: motif || "" } : a)) }));
    return { ok: true };
  },

  enregistrerValeurMarchande: async (id, valeur) => {
    const v = Math.max(0, Number(valeur) || 0);
    const { error } = await supabase.from("agro_animaux_individuels").update({ valeur_marchande: v }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set((s) => ({ animauxIndividuels: s.animauxIndividuels.map((a) => (a.id === id ? { ...a, valeurMarchande: v } : a)) }));
    return { ok: true };
  },
}));
