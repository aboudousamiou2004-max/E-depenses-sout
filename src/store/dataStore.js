import { create } from "zustand";
import { supabase, loginToEmail } from "../lib/supabaseClient";

// Store principal — anciennement du JS en mémoire persisté en localStorage,
// aujourd'hui de simples lectures/écritures Supabase. Les noms d'action et la
// forme des objets exposés aux composants (camelCase) restent identiques à
// avant : seule la source de données change, pour minimiser les changements
// dans les pages qui consomment ce store. Le statut/seuil des dépenses, le
// journal d'audit et les notifications sont désormais calculés/écrits
// exclusivement côté serveur (triggers SQL, voir supabase/schema.sql) — ce
// store ne fait plus que lire le résultat et déclencher les INSERT bruts.

const mapSecteur = (r) => ({ id: r.id, nom: r.nom, label: r.label, color: r.color, actif: r.actif !== false });
const mapCategorie = (r) => ({ id: r.id, secteurId: r.secteur_id, nom: r.nom });
const mapBudget = (r) => ({ id: r.id, secteurId: r.secteur_id, annee: r.annee, mois: r.mois, montant: Number(r.montant) });
const mapDepense = (r) => ({
  id: r.id,
  secteurId: r.secteur_id,
  categorie: r.categorie,
  montant: Number(r.montant),
  date: r.date,
  description: r.description,
  natureFlux: r.nature_flux,
  sourceFinancement: r.source_financement,
  beneficiaireNom: r.beneficiaire_nom,
  piece: r.piece,
  statut: r.statut,
  seuil: Number(r.seuil),
  creeParUid: r.cree_par,
});
const mapRecette = (r) => ({
  id: r.id,
  secteurId: r.secteur_id,
  montant: Number(r.montant),
  date: r.date,
  origine: r.origine,
  creeParUid: r.cree_par,
});
const mapJournalRow = (r) => ({
  id: r.id,
  userNom: r.user_nom,
  role: r.role,
  module: r.module,
  action: r.action,
  details: r.details,
  timestamp: r.timestamp,
});
const mapNotification = (r) => ({
  id: r.id,
  destinataireUid: r.destinataire_id,
  lu: r.lu,
  timestamp: r.timestamp,
  type: r.type,
  titre: r.titre,
  message: r.message,
  lien: r.lien,
});
const mapUser = (r) => ({
  uid: r.id,
  login: r.login,
  nom: r.nom,
  role: r.role,
  secteur: r.secteur,
  poste: r.poste,
  telephone: r.telephone,
  actif: r.actif,
  modules: r.modules || [],
});

const slugify = (nom) =>
  (nom || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "secteur";

export const useDataStore = create((set, get) => ({
  secteurs: [],
  budgets: [],
  depenses: [],
  recettes: [],
  journal: [],
  notifications: [],
  users: [],
  categories: [],
  loaded: false,

  // Charge toutes les données de l'app en une fois — appelé par authStore dès
  // qu'une session est résolue. `userId` sert à filtrer les notifications
  // (chacun ne peut de toute façon voir que les siennes, RLS l'impose déjà,
  // mais filtrer ici évite de dépendre de l'ordre des champs retournés).
  chargerTout: async (userId) => {
    const [secteurs, budgets, depenses, recettes, journal, notifications, users, categories] = await Promise.all([
      supabase.from("secteurs").select("*").order("created_at"),
      supabase.from("budgets").select("*"),
      supabase.from("depenses").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("recettes").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("journal").select("*").order("timestamp", { ascending: false }).limit(300),
      userId
        ? supabase.from("notifications").select("*").eq("destinataire_id", userId).order("timestamp", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from("profiles").select("*").order("nom"),
      supabase.from("categories_depense").select("*").order("nom"),
    ]);
    set({
      secteurs: (secteurs.data || []).map(mapSecteur),
      budgets: (budgets.data || []).map(mapBudget),
      depenses: (depenses.data || []).map(mapDepense),
      recettes: (recettes.data || []).map(mapRecette),
      journal: (journal.data || []).map(mapJournalRow),
      notifications: (notifications.data || []).map(mapNotification),
      users: (users.data || []).map(mapUser),
      categories: (categories.data || []).map(mapCategorie),
      loaded: true,
    });
  },

  reset: () =>
    set({
      secteurs: [], budgets: [], depenses: [], recettes: [], journal: [], notifications: [], users: [],
      categories: [], loaded: false,
    }),

  // Rechargements ciblés après une écriture — évitent de tout re-fetcher.
  chargerSecteurs: async () => {
    const { data } = await supabase.from("secteurs").select("*").order("created_at");
    set({ secteurs: (data || []).map(mapSecteur) });
  },
  chargerBudgets: async () => {
    const { data } = await supabase.from("budgets").select("*");
    set({ budgets: (data || []).map(mapBudget) });
  },
  chargerDepenses: async () => {
    const { data } = await supabase.from("depenses").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
    set({ depenses: (data || []).map(mapDepense) });
  },
  chargerRecettes: async () => {
    const { data } = await supabase.from("recettes").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
    set({ recettes: (data || []).map(mapRecette) });
  },
  chargerJournal: async () => {
    const { data } = await supabase.from("journal").select("*").order("timestamp", { ascending: false }).limit(300);
    set({ journal: (data || []).map(mapJournalRow) });
  },
  chargerNotifications: async (userId) => {
    if (!userId) return;
    const { data } = await supabase.from("notifications").select("*").eq("destinataire_id", userId).order("timestamp", { ascending: false });
    set({ notifications: (data || []).map(mapNotification) });
  },
  chargerUsers: async () => {
    const { data } = await supabase.from("profiles").select("*").order("nom");
    set({ users: (data || []).map(mapUser) });
  },
  chargerCategories: async () => {
    const { data } = await supabase.from("categories_depense").select("*").order("nom");
    set({ categories: (data || []).map(mapCategorie) });
  },

  // Crée un compte Supabase Auth + déclenche la création du profil (trigger
  // handle_new_user côté serveur, voir supabase/schema.sql). signUp() bascule
  // la session active sur le nouveau compte : on reconnecte immédiatement
  // l'admin avec le mot de passe qu'il vient de fournir dans le formulaire
  // (ré-authentification silencieuse — voir le plan de migration).
  addUser: async (payload, auteur, adminPass) => {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: loginToEmail(payload.login),
      password: payload.pass,
      options: {
        data: {
          login: payload.login.trim(),
          nom: payload.nom.trim(),
          role: payload.role,
          secteur: payload.secteur || null,
          poste: payload.poste?.trim() || "",
          telephone: payload.telephone?.trim() || "",
          actif: payload.actif !== false,
          modules: payload.modules || [],
        },
      },
    });
    if (signUpError) return { ok: false, error: signUpError.message };

    const { error: reloginError } = await supabase.auth.signInWithPassword({
      email: loginToEmail(auteur.login),
      password: adminPass,
    });
    if (reloginError) {
      return { ok: false, error: "Utilisateur créé, mais la reconnexion a échoué — reconnectez-vous manuellement." };
    }
    await get().chargerUsers();
    return { ok: true, utilisateur: signUpData.user };
  },

  modifierAccesUtilisateur: async (uid, modules) => {
    const { error } = await supabase.from("profiles").update({ modules }).eq("id", uid);
    if (error) return { ok: false, error: error.message };
    await get().chargerUsers();
    return { ok: true };
  },

  addSecteur: async (payload) => {
    const base = slugify(payload.nom);
    const existants = get().secteurs.map((s) => s.id);
    let id = base;
    let n = 2;
    while (existants.includes(id)) id = `${base}-${n++}`;
    const { data, error } = await supabase
      .from("secteurs")
      .insert({ id, nom: payload.nom, label: payload.label || payload.nom, color: payload.color || "#0A84FF" })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await get().chargerSecteurs();
    return { ok: true, secteur: mapSecteur(data) };
  },

  modifierSecteur: async (id, payload) => {
    const { error } = await supabase
      .from("secteurs")
      .update({ nom: payload.nom, label: payload.label, color: payload.color, actif: payload.actif })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerSecteurs();
    return { ok: true };
  },

  // Refusée par PostgreSQL (contrainte de clé étrangère) si le secteur a déjà
  // des dépenses, recettes, budgets ou utilisateurs rattachés — volontaire,
  // pour ne jamais effacer silencieusement un historique financier. Dans ce
  // cas, l'appelant doit proposer de désactiver le secteur à la place.
  supprimerSecteur: async (id) => {
    const { error } = await supabase.from("secteurs").delete().eq("id", id);
    if (error) {
      const bloque = error.code === "23503";
      return {
        ok: false,
        error: bloque
          ? "Ce secteur a déjà des dépenses, recettes, budgets ou utilisateurs rattachés — désactivez-le plutôt que de le supprimer."
          : error.message,
      };
    }
    await get().chargerSecteurs();
    return { ok: true };
  },

  addCategorie: async (secteurId, nom) => {
    const { error } = await supabase.from("categories_depense").insert({ secteur_id: secteurId, nom: nom.trim() });
    if (error) return { ok: false, error: error.message };
    await get().chargerCategories();
    return { ok: true };
  },

  supprimerCategorie: async (id) => {
    const { error } = await supabase.from("categories_depense").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerCategories();
    return { ok: true };
  },

  addDepense: async (payload, user) => {
    const { data, error } = await supabase
      .from("depenses")
      .insert({
        secteur_id: payload.secteurId,
        categorie: payload.categorie,
        montant: payload.montant,
        date: payload.date,
        description: payload.description || "",
        nature_flux: payload.natureFlux,
        source_financement: payload.sourceFinancement,
        beneficiaire_nom: payload.beneficiaireNom || "",
        piece: payload.piece || "",
      })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await Promise.all([get().chargerDepenses(), get().chargerNotifications(user?.uid)]);
    return { ok: true, depense: mapDepense(data) };
  },

  addRecette: async (payload) => {
    const { data, error } = await supabase
      .from("recettes")
      .insert({ secteur_id: payload.secteurId, montant: payload.montant, date: payload.date, origine: payload.origine })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await get().chargerRecettes();
    return { ok: true, recette: mapRecette(data) };
  },

  // Réservé aux approbateurs (RLS, même policy que la suppression). Ne touche
  // volontairement pas statut/seuil : le trigger qui les calcule ne s'exécute
  // qu'à l'INSERT, et les recalculer ici rejouerait la validation de
  // transition de statut pour un simple correctif (catégorie, montant, date).
  modifierDepense: async (id, payload) => {
    const { error } = await supabase
      .from("depenses")
      .update({
        secteur_id: payload.secteurId,
        categorie: payload.categorie,
        montant: payload.montant,
        date: payload.date,
        description: payload.description || "",
        nature_flux: payload.natureFlux,
        source_financement: payload.sourceFinancement,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerDepenses();
    return { ok: true };
  },

  modifierRecette: async (id, payload) => {
    const { error } = await supabase
      .from("recettes")
      .update({ secteur_id: payload.secteurId, montant: payload.montant, date: payload.date, origine: payload.origine })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerRecettes();
    return { ok: true };
  },

  changerStatutDepense: async (id, statut) => {
    const { error } = await supabase.from("depenses").update({ statut }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerDepenses();
    return { ok: true };
  },

  // Réservé aux approbateurs (RLS) — un agent ne peut pas effacer ce qu'il a
  // saisi lui-même, seulement le soumettre au circuit d'autorisation.
  supprimerDepense: async (id) => {
    const { error } = await supabase.from("depenses").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerDepenses();
    return { ok: true };
  },

  supprimerRecette: async (id) => {
    const { error } = await supabase.from("recettes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerRecettes();
    return { ok: true };
  },

  setBudget: async (secteurId, annee, mois, montant) => {
    const { error } = await supabase
      .from("budgets")
      .upsert({ secteur_id: secteurId, annee, mois, montant }, { onConflict: "secteur_id,annee,mois" });
    if (error) return { ok: false, error: error.message };
    await get().chargerBudgets();
    return { ok: true };
  },

  marquerNotificationLue: async (id) => {
    await supabase.from("notifications").update({ lu: true }).eq("id", id);
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, lu: true } : n)) }));
  },

  marquerToutesNotificationsLues: async (destinataireUid) => {
    await supabase.from("notifications").update({ lu: true }).eq("destinataire_id", destinataireUid);
    set((s) => ({ notifications: s.notifications.map((n) => (n.destinataireUid === destinataireUid ? { ...n, lu: true } : n)) }));
  },
}));
