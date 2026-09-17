import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

// MAXI GYM — volets « Nos forfaits » et « Clients », spécifiques à ce
// secteur (voir PRESETS["maxi-gym"] dans lib/modules.js). Même convention
// que besoinsStore.js : ce store ne fait que lire/écrire les tables
// gym_forfaits / gym_clients (voir migration_maxi_gym.sql).

export const NIVEAUX_FORFAIT = [
  { id: "simple", label: "Simple" },
  { id: "classique", label: "Classique" },
  { id: "vip", label: "VIP" },
];
export const niveauLabel = (id) => NIVEAUX_FORFAIT.find((n) => n.id === id)?.label || id;

export const JOURS_SEMAINE = [
  { id: "lun", label: "Lun" }, { id: "mar", label: "Mar" }, { id: "mer", label: "Mer" },
  { id: "jeu", label: "Jeu" }, { id: "ven", label: "Ven" }, { id: "sam", label: "Sam" }, { id: "dim", label: "Dim" },
];
// JS Date.getDay() : 0 = dimanche ... 6 = samedi.
export const jourAujourdhui = () => JOURS_SEMAINE[(new Date().getDay() + 6) % 7].id;
export const heureActuelle = () => new Date().toTimeString().slice(0, 5);

// Valeurs de départ créées automatiquement pour un secteur MAXI GYM qui n'a
// encore aucun forfait en base (premier chargement) — reprennent les tarifs
// communiqués par l'utilisateur, modifiables ensuite depuis l'écran.
const FORFAITS_PAR_DEFAUT = [
  {
    niveau: "simple", description: "Accès salle — sans tapis roulant ni escalator",
    prix_seance: 1000, prix_abonnement: 10000, duree_abonnement_texte: "/ mois",
    seance_proposee: true, features: ["Accès salle de musculation", "Sans tapis roulant ni escalator"],
  },
  {
    niveau: "classique", description: "Durée et tarif définis à la saisie (abonnement uniquement)",
    prix_seance: null, prix_abonnement: null, duree_abonnement_texte: "Tarif et durée libres (min. 7 jours)",
    seance_proposee: false,
    features: ["Réservé aux abonnements — pas de séance ponctuelle", "Durée définie à la demande", "Minimum 7 jours (deux semaines)", "Tarif négocié à la souscription"],
  },
  {
    niveau: "vip", description: "Accès complet, avec tapis roulant et escalator",
    prix_seance: 1500, prix_abonnement: 15000, duree_abonnement_texte: "/ mois",
    seance_proposee: true, features: ["Accès complet à la salle", "Tapis roulant et escalator inclus"],
  },
];

const mapForfait = (r) => ({
  id: r.id, secteurId: r.secteur_id, niveau: r.niveau, description: r.description,
  prixSeance: r.prix_seance !== null ? Number(r.prix_seance) : null,
  prixAbonnement: r.prix_abonnement !== null ? Number(r.prix_abonnement) : null,
  dureeAbonnementTexte: r.duree_abonnement_texte || "", seanceProposee: r.seance_proposee !== false,
  features: r.features || [],
});
const mapClient = (r) => ({
  id: r.id, secteurId: r.secteur_id, nom: r.nom, telephone: r.telephone || "",
  forfaitNiveau: r.forfait_niveau, dateDebut: r.date_debut, actif: r.actif !== false,
  estPartenaire: r.est_partenaire || false, entreprise: r.entreprise || "",
  note: r.note || "", createdAt: r.created_at,
});
const mapCoach = (r) => ({
  id: r.id, secteurId: r.secteur_id, nom: r.nom, telephone: r.telephone || "",
  specialite: r.specialite || "", actif: r.actif !== false, createdAt: r.created_at,
  joursPresence: r.jours_presence || [], heureArrivee: (r.heure_arrivee || "").slice(0, 5),
});
const mapPointageCoach = (r) => ({ id: r.id, coachId: r.coach_id, date: r.date, heureReelle: r.heure_reelle, createdAt: r.created_at });

// Tant que migration_maxi_gym_coachs_presence.sql n'est pas exécutée,
// jours_presence/heure_arrivee n'existent pas encore en base — on retente
// alors sans ces deux champs plutôt que de casser l'ajout/la modification
// d'un coach en attendant (même mésaventure qu'avec `abonnement_id` sur
// `recettes`, voir dataStore.addRecette).
const colonneManquante = (error) => error?.code === "PGRST204" || /column .* of .* in the schema cache/i.test(error?.message || "");
const mapAbonnement = (r) => ({
  id: r.id, secteurId: r.secteur_id, client: r.client, telephone: r.telephone || "",
  niveau: r.niveau, dateSouscription: r.date_souscription, dateDebut: r.date_debut,
  dureeJours: r.duree_jours, dateFin: r.date_fin, montant: Number(r.montant) || 0,
  note: r.note || "", derniereArrivee: r.derniere_arrivee, creeParNom: r.cree_par_nom || "",
  createdAt: r.created_at,
});
const mapPointage = (r) => ({ id: r.id, abonnementId: r.abonnement_id, date: r.date, createdAt: r.created_at });

export const useGymStore = create((set, get) => ({
  forfaits: [],
  clients: [],
  coachs: [],
  abonnements: [],
  pointages: [], // pointages de l'abonnement actuellement ouvert (calendrier)
  pointagesCoachsAujourdhui: [],

  reset: () => set({ forfaits: [], clients: [], coachs: [], abonnements: [], pointages: [], pointagesCoachsAujourdhui: [] }),

  chargerForfaits: async (secteurId) => {
    const { data } = await supabase.from("gym_forfaits").select("*").eq("secteur_id", secteurId).order("niveau");
    if ((data || []).length === 0) {
      // Premier accès à MAXI GYM pour ce secteur : on amorce les 3 formules
      // par défaut plutôt que d'afficher un écran vide.
      await supabase.from("gym_forfaits").insert(FORFAITS_PAR_DEFAUT.map((f) => ({ ...f, secteur_id: secteurId })));
      const { data: data2 } = await supabase.from("gym_forfaits").select("*").eq("secteur_id", secteurId).order("niveau");
      set({ forfaits: (data2 || []).map(mapForfait) });
      return;
    }
    set({ forfaits: data.map(mapForfait) });
  },

  modifierForfait: async (id, form) => {
    const { error } = await supabase.from("gym_forfaits").update({
      description: form.description, prix_seance: form.prixSeance === "" ? null : Number(form.prixSeance),
      prix_abonnement: form.prixAbonnement === "" ? null : Number(form.prixAbonnement),
      duree_abonnement_texte: form.dureeAbonnementTexte || "", seance_proposee: !!form.seanceProposee,
      features: (form.features || []).filter((f) => f.trim()),
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ forfaits: get().forfaits.map((f) => (f.id === id ? {
      ...f, description: form.description, prixSeance: form.prixSeance === "" ? null : Number(form.prixSeance),
      prixAbonnement: form.prixAbonnement === "" ? null : Number(form.prixAbonnement),
      dureeAbonnementTexte: form.dureeAbonnementTexte || "", seanceProposee: !!form.seanceProposee,
      features: (form.features || []).filter((f2) => f2.trim()),
    } : f)) });
    return { ok: true };
  },

  chargerClients: async (secteurId) => {
    const { data } = await supabase.from("gym_clients").select("*").eq("secteur_id", secteurId).order("created_at", { ascending: false });
    set({ clients: (data || []).map(mapClient) });
  },

  // `estPartenaire` distingue un client individuel d'une entreprise
  // partenaire (volet « Clients partenaires ») — même table, un simple
  // indicateur, pour ne pas dupliquer le suivi des personnes.
  ajouterClient: async (secteurId, form) => {
    const { error } = await supabase.from("gym_clients").insert({
      secteur_id: secteurId, nom: form.nom.trim(), telephone: form.telephone || "",
      forfait_niveau: form.forfaitNiveau, date_debut: form.dateDebut || new Date().toISOString().slice(0, 10),
      est_partenaire: !!form.estPartenaire, entreprise: form.entreprise || "", note: form.note || "",
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerClients(secteurId);
    return { ok: true };
  },

  modifierClient: async (id, form) => {
    const { error } = await supabase.from("gym_clients").update({
      nom: form.nom.trim(), telephone: form.telephone || "", forfait_niveau: form.forfaitNiveau,
      date_debut: form.dateDebut, est_partenaire: !!form.estPartenaire, entreprise: form.entreprise || "", note: form.note || "",
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ clients: get().clients.map((c) => (c.id === id ? { ...c, ...form } : c)) });
    return { ok: true };
  },

  toggleActifClient: async (id, actif) => {
    const { error } = await supabase.from("gym_clients").update({ actif }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ clients: get().clients.map((c) => (c.id === id ? { ...c, actif } : c)) });
    return { ok: true };
  },

  supprimerClient: async (id) => {
    const { error } = await supabase.from("gym_clients").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ clients: get().clients.filter((c) => c.id !== id) });
    return { ok: true };
  },

  chargerCoachs: async (secteurId) => {
    const { data } = await supabase.from("gym_coachs").select("*").eq("secteur_id", secteurId).order("nom");
    set({ coachs: (data || []).map(mapCoach) });
  },

  ajouterCoach: async (secteurId, form) => {
    const base = { secteur_id: secteurId, nom: form.nom.trim(), telephone: form.telephone || "", specialite: form.specialite || "" };
    const complet = { ...base, jours_presence: form.joursPresence || [], heure_arrivee: (form.joursPresence || []).length ? form.heureArrivee || null : null };
    let { error } = await supabase.from("gym_coachs").insert(complet);
    let migrationRequise = false;
    if (error && colonneManquante(error)) {
      migrationRequise = true;
      ({ error } = await supabase.from("gym_coachs").insert(base));
    }
    if (error) return { ok: false, error: error.message };
    await get().chargerCoachs(secteurId);
    return { ok: true, migrationRequise };
  },

  modifierCoach: async (id, form) => {
    const base = { nom: form.nom.trim(), telephone: form.telephone || "", specialite: form.specialite || "" };
    const complet = { ...base, jours_presence: form.joursPresence || [], heure_arrivee: (form.joursPresence || []).length ? form.heureArrivee || null : null };
    let { error } = await supabase.from("gym_coachs").update(complet).eq("id", id);
    let migrationRequise = false;
    if (error && colonneManquante(error)) {
      migrationRequise = true;
      ({ error } = await supabase.from("gym_coachs").update(base).eq("id", id));
    }
    if (error) return { ok: false, error: error.message };
    set({ coachs: get().coachs.map((c) => (c.id === id ? { ...c, ...form } : c)) });
    return { ok: true, migrationRequise };
  },

  toggleActifCoach: async (id, actif) => {
    const { error } = await supabase.from("gym_coachs").update({ actif }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ coachs: get().coachs.map((c) => (c.id === id ? { ...c, actif } : c)) });
    return { ok: true };
  },

  supprimerCoach: async (id) => {
    const { error } = await supabase.from("gym_coachs").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ coachs: get().coachs.filter((c) => c.id !== id) });
    return { ok: true };
  },

  chargerAbonnements: async (secteurId) => {
    const { data } = await supabase.from("gym_abonnements").select("*").eq("secteur_id", secteurId).order("date_souscription", { ascending: false });
    set({ abonnements: (data || []).map(mapAbonnement) });
  },

  ajouterAbonnement: async (secteurId, form, user) => {
    const { data, error } = await supabase.from("gym_abonnements").insert({
      secteur_id: secteurId, client: form.client.trim(), telephone: form.telephone || "",
      niveau: form.niveau, date_souscription: form.dateSouscription, date_debut: form.dateDebut,
      duree_jours: Number(form.dureeJours) || 30, date_fin: form.dateFin, montant: Number(form.montant) || 0,
      note: form.note || "", cree_par_nom: user?.nom || user?.login || "",
    }).select().single();
    if (error) return { ok: false, error: error.message };
    await get().chargerAbonnements(secteurId);
    return { ok: true, id: data.id };
  },

  modifierAbonnement: async (id, form) => {
    const { error } = await supabase.from("gym_abonnements").update({
      client: form.client.trim(), telephone: form.telephone || "", niveau: form.niveau,
      date_souscription: form.dateSouscription, date_debut: form.dateDebut, duree_jours: Number(form.dureeJours) || 30,
      date_fin: form.dateFin, montant: Number(form.montant) || 0, note: form.note || "",
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ abonnements: get().abonnements.map((a) => (a.id === id ? { ...a, ...form, montant: Number(form.montant) || 0, dureeJours: Number(form.dureeJours) || 30 } : a)) });
    return { ok: true };
  },

  supprimerAbonnement: async (id) => {
    const { error } = await supabase.from("gym_abonnements").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ abonnements: get().abonnements.filter((a) => a.id !== id) });
    return { ok: true };
  },

  // Bouton « Pointer » : enregistre l'arrivée du jour (une seule fois par
  // jour, contrainte unique côté base) et met à jour le cache affiché dans
  // la liste sans recharger tout l'abonnement.
  pointerAbonnement: async (id) => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("gym_pointages").insert({ abonnement_id: id, date: aujourdhui });
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Déjà pointé aujourd'hui." };
      return { ok: false, error: error.message };
    }
    await supabase.from("gym_abonnements").update({ derniere_arrivee: aujourdhui }).eq("id", id);
    set({ abonnements: get().abonnements.map((a) => (a.id === id ? { ...a, derniereArrivee: aujourdhui } : a)) });
    return { ok: true };
  },

  chargerPointages: async (abonnementId) => {
    const { data } = await supabase.from("gym_pointages").select("*").eq("abonnement_id", abonnementId).order("date", { ascending: false });
    set({ pointages: (data || []).map(mapPointage) });
  },

  supprimerPointage: async (id, abonnementId) => {
    const { error } = await supabase.from("gym_pointages").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    set({ pointages: get().pointages.filter((p) => p.id !== id) });
    // Recalcule le cache "dernière arrivée" à partir du pointage le plus récent restant.
    const { data } = await supabase.from("gym_pointages").select("date").eq("abonnement_id", abonnementId).order("date", { ascending: false }).limit(1);
    const derniere = data?.[0]?.date || null;
    await supabase.from("gym_abonnements").update({ derniere_arrivee: derniere }).eq("id", abonnementId);
    set({ abonnements: get().abonnements.map((a) => (a.id === abonnementId ? { ...a, derniereArrivee: derniere } : a)) });
    return { ok: true };
  },

  // Pointages des coachs du jour — chargés une fois pour tout le secteur
  // (volet Coachs + widget « Coach du jour » du tableau de bord), jointure
  // sur gym_coachs pour filtrer par secteur (gym_coach_pointages n'a pas
  // secteur_id en propre).
  chargerPointagesCoachsAujourdhui: async (secteurId) => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("gym_coach_pointages")
      .select("*, gym_coachs!inner(secteur_id)")
      .eq("gym_coachs.secteur_id", secteurId)
      .eq("date", aujourdhui);
    set({ pointagesCoachsAujourdhui: (data || []).map(mapPointageCoach) });
  },

  pointerCoach: async (coachId) => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const heure = heureActuelle();
    const { data, error } = await supabase
      .from("gym_coach_pointages")
      .insert({ coach_id: coachId, date: aujourdhui, heure_reelle: heure })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Déjà pointé aujourd'hui." };
      return { ok: false, error: error.message };
    }
    set({ pointagesCoachsAujourdhui: [...get().pointagesCoachsAujourdhui, mapPointageCoach(data)] });
    return { ok: true };
  },
}));
