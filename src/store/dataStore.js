import { create } from "zustand";
import { supabase, AUTH_EMAIL_DOMAIN } from "../lib/supabaseClient";
import { pieceToColumn, pieceFromColumn } from "../lib/fichiers";
import { decoupeNomVille } from "../lib/modules";
import { reinitialiserBaseDeDonnees } from "../lib/resetApplication";

// Store principal — anciennement du JS en mémoire persisté en localStorage,
// aujourd'hui de simples lectures/écritures Supabase. Les noms d'action et la
// forme des objets exposés aux composants (camelCase) restent identiques à
// avant : seule la source de données change, pour minimiser les changements
// dans les pages qui consomment ce store. Le statut/seuil des dépenses, le
// journal d'audit et les notifications sont désormais calculés/écrits
// exclusivement côté serveur (triggers SQL, voir supabase/schema.sql) — ce
// store ne fait plus que lire le résultat et déclencher les INSERT bruts.

// Supabase Auth renvoie ses messages d'erreur en anglais — traduction des cas
// les plus courants pour rester cohérent avec le reste de l'interface,
// sinon on retombe sur le message original plutôt que de le masquer.
const ERREURS_AUTH_FR = {
  "User already registered": "Cet identifiant est déjà utilisé.",
  "Invalid login credentials": "Identifiant ou mot de passe incorrect.",
};
function traduireErreurAuth(message) {
  // Le nombre de caractères minimum est configurable côté Supabase (Dashboard),
  // donc traduit dynamiquement plutôt que sur un texte figé à "6".
  const longueurMin = message?.match(/Password should be at least (\d+) characters?\.?/);
  if (longueurMin) return `Le mot de passe doit contenir au moins ${longueurMin[1]} caractères.`;
  return ERREURS_AUTH_FR[message] || message;
}

const mapSecteur = (r) => ({ id: r.id, nom: r.nom, label: r.label, color: r.color, actif: r.actif !== false });
const mapCategorie = (r) => ({ id: r.id, secteurId: r.secteur_id, nom: r.nom });
const mapBudget = (r) => ({
  id: r.id, secteurId: r.secteur_id, annee: r.annee, mois: r.mois, montant: Number(r.montant),
  revisions: r.revisions || [],
  montantPropose: r.montant_propose != null ? Number(r.montant_propose) : null,
  motifPropose: r.motif_propose || null,
  statutValidation: r.statut_validation || null,
  proposeParText: r.propose_par_text || null,
  proposeLe: r.propose_le || null,
});
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
  piece: pieceFromColumn(r.piece),
  imprevue: !!r.imprevue,
  recurrente: !!r.recurrente,
  statut: r.statut,
  seuil: Number(r.seuil),
  creeParUid: r.cree_par,
  createdAt: r.created_at,
  projetId: r.projet_id,
  tacheId: r.tache_id,
  besoinId: r.besoin_id,
  transportId: r.transport_id,
});
const mapRecette = (r) => ({
  id: r.id,
  secteurId: r.secteur_id,
  montant: Number(r.montant),
  date: r.date,
  origine: r.origine,
  articleId: r.article_id,
  quantite: r.quantite !== null ? Number(r.quantite) : null,
  jours: r.jours !== null ? Number(r.jours) : null,
  dateRetour: r.date_retour,
  client: r.client || "",
  description: r.description || "",
  creeParUid: r.cree_par,
  createdAt: r.created_at,
  abonnementId: r.abonnement_id,
});
const mapJournalRow = (r) => ({
  id: r.id,
  userNom: r.user_nom,
  role: r.role,
  module: r.module,
  action: r.action,
  details: r.details,
  timestamp: r.timestamp,
  secteurId: r.secteur_id,
});
const mapVueVolet = (r) => ({ userId: r.user_id, section: r.section, vu: r.vu });
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
const mapArchive = (r) => ({
  id: r.id,
  type: r.type,
  secteurNom: r.secteur_nom,
  dateOrigine: r.date_origine,
  motif: r.motif,
  data: r.data,
  archivedByNom: r.archived_by_nom,
  createdAt: r.created_at,
});
const mapMouvementBanque = (r) => ({
  id: r.id,
  date: r.date,
  type: r.type,
  libelle: r.libelle,
  origine: r.origine,
  personne: r.personne,
  montant: Number(r.montant),
  ouverture: !!r.ouverture,
  creeParUid: r.cree_par,
});
const mapPartenaire = (r) => ({ id: r.id, nom: r.nom, type: r.type, contact: r.contact });
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
  banque: [],
  partenaires: [],
  archives: [],
  vuesVolets: [],
  loaded: false,

  // Charge toutes les données de l'app en une fois — appelé par authStore dès
  // qu'une session est résolue. `userId` sert à filtrer les notifications
  // (chacun ne peut de toute façon voir que les siennes, RLS l'impose déjà,
  // mais filtrer ici évite de dépendre de l'ordre des champs retournés).
  chargerTout: async (userId) => {
    const [secteurs, budgets, depenses, recettes, journal, notifications, users, categories, banque, partenaires, vuesVolets] = await Promise.all([
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
      supabase.from("banque_mouvements").select("*").order("date"),
      supabase.from("partenaires").select("*").order("nom"),
      userId
        ? supabase.from("vues_volets").select("*").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
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
      banque: (banque.data || []).map(mapMouvementBanque),
      partenaires: (partenaires.data || []).map(mapPartenaire),
      vuesVolets: (vuesVolets.data || []).map(mapVueVolet),
      loaded: true,
    });
  },

  reset: () =>
    set({
      secteurs: [], budgets: [], depenses: [], recettes: [], journal: [], notifications: [], users: [],
      categories: [], banque: [], partenaires: [], archives: [], vuesVolets: [], loaded: false,
    }),

  // Marque un volet comme vu par l'utilisateur courant — fait disparaître son
  // badge "nouveauté" dans la barre latérale (voir src/lib/nouveautes.js).
  // Mise à jour optimiste locale avant l'écriture réseau : le badge disparaît
  // immédiatement, sans attendre l'aller-retour Supabase.
  marquerVoletVu: async (userId, section) => {
    if (!userId || !section) return;
    const vu = new Date().toISOString();
    set((state) => ({
      vuesVolets: [
        ...state.vuesVolets.filter((v) => v.section !== section),
        { userId, section, vu },
      ],
    }));
    await supabase.from("vues_volets").upsert({ user_id: userId, section, vu }, { onConflict: "user_id,section" });
  },

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
  chargerArchives: async () => {
    const { data } = await supabase.from("archives").select("*").order("date_origine", { ascending: false }).limit(500);
    set({ archives: (data || []).map(mapArchive) });
  },

  // Crée un compte utilisateur via l'Edge Function "admin-create-user"
  // (supabase/functions/admin-create-user/index.ts), pas via
  // supabase.auth.signUp() côté client : signUp() bascule TOUJOURS la
  // session active sur le compte qui vient d'être créé (comportement du
  // SDK), ce que l'utilisateur a explicitement refusé (2026-09-18) : "le
  // navigateur ne doit pas basculer quand j'ajoute un utilisateur". La
  // fonction s'exécute côté serveur (clé service_role, jamais exposée) via
  // l'API Admin de Supabase Auth, qui ne touche à aucune session — ni besoin
  // de reconnecter l'admin après coup, ni de lui redemander son mot de
  // passe. Elle vérifie elle-même que l'appelant est un rôle à accès total
  // avant de créer quoi que ce soit (même barrière que la policy RLS
  // "profils modifiables par les rôles à accès total", appliquée
  // manuellement puisque service_role contourne RLS par nature).
  addUser: async (payload) => {
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        login: payload.login.trim(),
        pass: payload.pass,
        nom: payload.nom.trim(),
        role: payload.role,
        secteur: payload.secteur || null,
        poste: payload.poste,
        telephone: payload.telephone,
        actif: payload.actif,
        modules: payload.modules || [],
        emailDomain: AUTH_EMAIL_DOMAIN,
      },
    });
    if (error) {
      let message = error.message;
      try {
        const corps = await error.context?.json?.();
        if (corps?.error) message = corps.error;
      } catch {
        // Corps d'erreur non-JSON (ex. Edge Function injoignable) : on garde error.message.
      }
      return { ok: false, error: traduireErreurAuth(message) };
    }
    if (data?.error) return { ok: false, error: traduireErreurAuth(data.error) };

    await get().chargerUsers();
    return { ok: true, uid: data.uid };
  },

  supprimerUtilisateur: async (uid) => {
    const { error } = await supabase.rpc("supprimer_utilisateur", { p_user_id: uid });
    if (error) {
      const bloque = error.code === "23503";
      return {
        ok: false,
        error: bloque
          ? "Cet utilisateur a déjà des dépenses, recettes, budgets ou entrées de journal à son nom — désactivez-le plutôt que de le supprimer."
          : error.message,
      };
    }
    await get().chargerUsers();
    return { ok: true };
  },

  modifierAccesUtilisateur: async (uid, modules) => {
    const { error } = await supabase.from("profiles").update({ modules }).eq("id", uid);
    if (error) return { ok: false, error: error.message };
    await get().chargerUsers();
    return { ok: true };
  },

  modifierActifUtilisateur: async (uid, actif) => {
    const { error } = await supabase.from("profiles").update({ actif }).eq("id", uid);
    if (error) return { ok: false, error: error.message };
    await get().chargerUsers();
    return { ok: true };
  },

  // Modifier le rôle/secteur/poste/téléphone d'un utilisateur existant
  // (crayon dans Utilisateurs.jsx) — distinct de modifierAccesUtilisateur
  // (modules) et modifierActifUtilisateur (actif/désactivé). Protégé par la
  // même policy RLS que la création (profils modifiables par les rôles à
  // accès total) : un appel direct sans être admin échouerait aussi.
  //
  // Synchronise `modules` avec le `secteur` choisi : `secteur` sert de clé
  // pour les policies RLS gérant (confirmer un budget, décaisser une dépense
  // — has_module(secteur_id) ET secteur = auth.uid().secteur), mais
  // `modules` est ce qui accorde RÉELLEMENT l'accès aux données du secteur
  // (has_module). Sans cet ajout automatique, un admin pourrait assigner un
  // secteur à un gérant sans lui donner le module correspondant : le bouton
  // apparaîtrait côté interface (peutConfirmerBudget ne vérifie que
  // rôle+secteur) mais l'action échouerait silencieusement côté base (RLS) —
  // demande explicite de l'utilisateur (2026-09-18) : "ses droits et tout le
  // reste doivent être synchronisés".
  modifierUtilisateur: async (uid, payload) => {
    const existant = get().users.find((u) => u.uid === uid);
    const modulesActuels = existant?.modules || [];
    const modules = payload.secteur && !modulesActuels.includes(payload.secteur)
      ? [...modulesActuels, payload.secteur]
      : modulesActuels;
    const { error } = await supabase.from("profiles").update({
      nom: payload.nom?.trim(),
      role: payload.role,
      secteur: payload.secteur || null,
      poste: payload.poste?.trim() || "",
      telephone: payload.telephone?.trim() || "",
      modules,
    }).eq("id", uid);
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

  // Décline un module existant sur une nouvelle ville (ex. « E-BRIQUETERIE
  // SOKODÉ ») — même mécanisme que MAXI GYM/MAXI LOGISTIQUE (Kara/Lomé),
  // généralisé à tous les modules depuis Paramètres, à la demande de
  // l'utilisateur (2026-09-15). Le secteur d'origine n'a jamais de ville
  // dans son nom la première fois : il devient alors implicitement « Lomé »
  // (le lieu déjà en service), et la nouvelle ville démarre comme un
  // secteur neuf, vide — reconnu du même preset (icône/volets) grâce à
  // `matchNom` (voir src/lib/modules.js), aucun code additionnel requis.
  dupliquerSecteurVille: async (secteurId, nouvelleVille, color) => {
    const base = get().secteurs.find((s) => s.id === secteurId);
    if (!base) return { ok: false, error: "Secteur introuvable" };
    const villeMaj = (nouvelleVille || "").trim().toUpperCase();
    if (!villeMaj) return { ok: false, error: "Nom de ville requis" };

    const { base: nomSansVille, ville: villeActuelle } = decoupeNomVille(base.nom);
    if (villeActuelle && villeActuelle.toUpperCase() === villeMaj) {
      return { ok: false, error: `${base.nom} existe déjà.` };
    }

    let nomBase = base.nom;
    if (!villeActuelle) {
      // Première déclinaison de ce secteur : il devient « <nom> LOMÉ » et
      // garde son id (et donc tout son historique dépenses/recettes/budgets).
      nomBase = `${base.nom} LOMÉ`;
      const { error: errRenomme } = await supabase.from("secteurs").update({ nom: nomBase }).eq("id", base.id);
      if (errRenomme) return { ok: false, error: errRenomme.message };
    }

    const nouveauNom = `${nomSansVille} ${villeMaj}`;
    const idBase = slugify(nouveauNom);
    const existants = get().secteurs.map((s) => s.id);
    let id = idBase;
    let n = 2;
    while (existants.includes(id)) id = `${idBase}-${n++}`;

    const { data, error } = await supabase
      .from("secteurs")
      .insert({ id, nom: nouveauNom, label: base.label, color: color || base.color })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await get().chargerSecteurs();
    return { ok: true, secteur: mapSecteur(data) };
  },

  // Refusée par PostgreSQL (contrainte de clé étrangère) si le secteur a déjà
  // des dépenses, recettes, budgets ou utilisateurs rattachés. Gardée pour un
  // secteur réellement vide (ex. juste créé par erreur) — pour tout le
  // reste, voir `archiverEtSupprimerModule` ci-dessous, qui ne bloque jamais.
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

  // Supprime un secteur (ou tous les secteurs d'un même module décliné par
  // ville) SANS jamais être bloqué par ses dépenses/recettes/journal — à la
  // demande explicite de l'utilisateur (2026-09-15) : « je ne veux plus
  // avoir le truc de il y'a déjà des dépenses, je veux pouvoir supprimer ».
  // Au lieu de bloquer : 1) chaque dépense/recette/entrée de journal du
  // secteur est d'abord copiée dans `archives` (voir migration_archives.sql
  // et le volet Archives) ; 2) les données vivantes scopées sur ce secteur
  // sont vidées (mêmes tables que reinitialiserBaseDeDonnees, voir
  // src/lib/resetApplication.js) ; 3) les utilisateurs qui y étaient
  // rattachés sont détachés (secteur remis à vide) plutôt que bloqués ;
  // 4) le secteur lui-même est enfin supprimé.
  archiverEtSupprimerModule: async ({ secteurIds, label, user }) => {
    if (!Array.isArray(secteurIds) || secteurIds.length === 0) return { ok: false, error: "Aucun secteur à supprimer" };
    try {
      const [depRes, recRes, jrnRes] = await Promise.all([
        supabase.from("depenses").select("*").in("secteur_id", secteurIds),
        supabase.from("recettes").select("*").in("secteur_id", secteurIds),
        supabase.from("journal").select("*").in("secteur_id", secteurIds),
      ]);
      const lignes = [
        ...(depRes.data || []).map((r) => ({ type: "depense", date_origine: r.date, data: r })),
        ...(recRes.data || []).map((r) => ({ type: "recette", date_origine: r.date, data: r })),
        ...(jrnRes.data || []).map((r) => ({ type: "journal", date_origine: r.timestamp ? r.timestamp.slice(0, 10) : null, data: r })),
      ];
      if (lignes.length > 0) {
        const { error: errArchive } = await supabase.from("archives").insert(
          lignes.map((l) => ({
            type: l.type, secteur_nom: label, date_origine: l.date_origine, motif: "suppression_module",
            data: l.data, archived_by: user?.uid || null, archived_by_nom: user?.nom || user?.login || "",
          }))
        );
        if (errArchive) return { ok: false, error: errArchive.message };
      }

      const resultats = await reinitialiserBaseDeDonnees({ secteurIds });
      const echec = resultats.find((r) => !r.ok);
      if (echec) return { ok: false, error: `Échec sur « ${echec.table} » : ${echec.error}` };

      await supabase.from("profiles").update({ secteur: null }).in("secteur", secteurIds);

      const { error: errSecteurs } = await supabase.from("secteurs").delete().in("id", secteurIds);
      if (errSecteurs) return { ok: false, error: errSecteurs.message };

      await Promise.all([get().chargerSecteurs(), get().chargerDepenses(), get().chargerRecettes(), get().chargerJournal(), get().chargerUsers()]);
      return { ok: true, archivees: lignes.length };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  },

  // Archive (copie puis supprime) les dépenses/recettes/entrées de journal
  // antérieures à 1 an, tous secteurs confondus — alimente le volet
  // Archives, à la demande explicite de l'utilisateur (2026-09-15).
  archiverAnciennete: async (user) => {
    const seuil = new Date();
    seuil.setFullYear(seuil.getFullYear() - 1);
    const seuilStr = seuil.toISOString().slice(0, 10);
    try {
      const [depRes, recRes, jrnRes] = await Promise.all([
        supabase.from("depenses").select("*").lt("date", seuilStr),
        supabase.from("recettes").select("*").lt("date", seuilStr),
        supabase.from("journal").select("*").lt("timestamp", seuilStr),
      ]);
      const secteursParId = Object.fromEntries(get().secteurs.map((s) => [s.id, s.nom]));
      const lignes = [
        ...(depRes.data || []).map((r) => ({ type: "depense", date_origine: r.date, data: r, secteur_nom: secteursParId[r.secteur_id] || r.secteur_id || "" })),
        ...(recRes.data || []).map((r) => ({ type: "recette", date_origine: r.date, data: r, secteur_nom: secteursParId[r.secteur_id] || r.secteur_id || "" })),
        ...(jrnRes.data || []).map((r) => ({
          type: "journal", date_origine: r.timestamp ? r.timestamp.slice(0, 10) : null, data: r,
          secteur_nom: secteursParId[r.secteur_id] || r.secteur_id || r.module || "",
        })),
      ];
      if (lignes.length === 0) return { ok: true, archivees: 0 };

      const { error: errArchive } = await supabase.from("archives").insert(
        lignes.map((l) => ({
          type: l.type, secteur_nom: l.secteur_nom, date_origine: l.date_origine, motif: "anciennete",
          data: l.data, archived_by: user?.uid || null, archived_by_nom: user?.nom || user?.login || "",
        }))
      );
      if (errArchive) return { ok: false, error: errArchive.message };

      const [depDel, recDel, jrnDel] = await Promise.all([
        supabase.from("depenses").delete().lt("date", seuilStr),
        supabase.from("recettes").delete().lt("date", seuilStr),
        supabase.from("journal").delete().lt("timestamp", seuilStr),
      ]);
      const errDel = depDel.error || recDel.error || jrnDel.error;
      if (errDel) return { ok: false, error: errDel.message };

      await Promise.all([get().chargerDepenses(), get().chargerRecettes(), get().chargerJournal()]);
      return { ok: true, archivees: lignes.length };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
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
        piece: pieceToColumn(payload.piece),
        imprevue: !!payload.imprevue,
        recurrente: !!payload.recurrente,
        projet_id: payload.projetId || null,
        tache_id: payload.tacheId || null,
        besoin_id: payload.besoinId || null,
        transport_id: payload.transportId || null,
      })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    await Promise.all([get().chargerDepenses(), get().chargerNotifications(user?.uid)]);
    return { ok: true, depense: mapDepense(data) };
  },

  // Reconduit dans le mois courant toutes les dépenses marquées « récurrente »
  // du mois précédent, en ignorant celles déjà reconduites (même secteur +
  // catégorie + montant déjà présents ce mois-ci) — pas d'automatisation par
  // tâche planifiée, action manuelle déclenchée depuis Dépenses.jsx.
  reconduireDepenses: async (user) => {
    const now = new Date();
    const moisPrecedent = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const anneePrec = moisPrecedent.getFullYear();
    const moisPrec = moisPrecedent.getMonth();
    const depenses = get().depenses;
    const aReconduire = depenses.filter((d) => {
      if (!d.recurrente) return false;
      const dt = new Date(d.date);
      return dt.getFullYear() === anneePrec && dt.getMonth() === moisPrec;
    });
    const dejaCeMois = depenses.filter((d) => {
      const dt = new Date(d.date);
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    });
    const dejaFait = (d) =>
      dejaCeMois.some((x) => x.secteurId === d.secteurId && x.categorie === d.categorie && x.montant === d.montant && x.recurrente);

    let nb = 0;
    for (const d of aReconduire) {
      if (dejaFait(d)) continue;
      const jour = Math.min(d.date ? new Date(d.date).getDate() : 1, 28);
      const nouvelleDate = new Date(now.getFullYear(), now.getMonth(), jour).toISOString().slice(0, 10);
      const res = await get().addDepense(
        {
          secteurId: d.secteurId,
          categorie: d.categorie,
          montant: d.montant,
          date: nouvelleDate,
          description: d.description,
          natureFlux: d.natureFlux,
          sourceFinancement: d.sourceFinancement,
          beneficiaireNom: d.beneficiaireNom,
          recurrente: true,
        },
        user
      );
      if (res.ok) nb++;
    }
    return { ok: true, nb };
  },

  addRecette: async (payload) => {
    const { data, error } = await supabase
      .from("recettes")
      .insert({
        secteur_id: payload.secteurId, montant: payload.montant, date: payload.date, origine: payload.origine,
        article_id: payload.articleId || null, quantite: payload.quantite ?? null, jours: payload.jours ?? null,
        date_retour: payload.dateRetour || null,
        client: payload.client || "", description: payload.description || "",
        // N'envoyé que si fourni : la colonne abonnement_id n'existe qu'après
        // migration_maxi_gym_abonnements.sql — l'inclure inconditionnellement
        // casserait la création de TOUTE recette (Prestations, Séances...)
        // tant que la migration n'est pas exécutée.
        ...(payload.abonnementId ? { abonnement_id: payload.abonnementId } : {}),
      })
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
        beneficiaire_nom: payload.beneficiaireNom || "",
        piece: pieceToColumn(payload.piece),
        imprevue: !!payload.imprevue,
        recurrente: !!payload.recurrente,
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

  // Alloue (1ère fois) ou révise le budget d'un secteur pour un mois — trace
  // chaque changement (ancien/nouveau/motif/auteur/date) dans `revisions`.
  // `requiertValidation` (calculé par l'appelant selon si le secteur a une
  // équipe identifiable, cf. Recettes.jsx) : si vrai, le montant reste
  // « proposé » jusqu'à confirmation de réception (validerReceptionBudget)
  // au lieu de s'appliquer immédiatement — même logique que
  // termitiere-platform/src/modules/depense/RecettesDepenses.jsx.
  allouerOuReviserBudget: async ({ secteurId, annee, mois, montant, motif, user, requiertValidation }) => {
    const existant = get().budgets.find((b) => b.secteurId === secteurId && b.annee === annee && b.mois === mois);
    const ancien = existant?.montant || 0;
    const motifFinal = motif?.trim() || "Allocation initiale";
    const auteur = user?.nom || user?.login || "—";

    if (requiertValidation) {
      const { error } = await supabase.from("budgets").upsert(
        {
          secteur_id: secteurId, annee, mois, montant: ancien, revisions: existant?.revisions || [],
          montant_propose: montant, motif_propose: motifFinal, statut_validation: "en_attente",
          propose_par_text: auteur, propose_par_uid: user?.uid || null, propose_le: new Date().toISOString(),
        },
        { onConflict: "secteur_id,annee,mois" }
      );
      if (error) return { ok: false, error: error.message };
      await get().chargerBudgets();
      return { ok: true, propose: true };
    }

    const entry = { id: crypto.randomUUID(), ancien, nouveau: montant, motif: motifFinal, date: Date.now(), auteur };
    const revisions = [...(existant?.revisions || []), entry];
    const { error } = await supabase.from("budgets").upsert(
      { secteur_id: secteurId, annee, mois, montant, revisions, montant_propose: null, motif_propose: null, statut_validation: null },
      { onConflict: "secteur_id,annee,mois" }
    );
    if (error) return { ok: false, error: error.message };
    await get().chargerBudgets();
    return { ok: true, propose: false };
  },

  // Le secteur confirme avoir reçu le budget proposé → il devient le montant actif.
  validerReceptionBudget: async (budgetId, user) => {
    const b = get().budgets.find((x) => x.id === budgetId);
    if (!b || b.montantPropose == null) return { ok: false, error: "Rien à confirmer" };
    const entry = {
      id: crypto.randomUUID(), ancien: b.montant, nouveau: b.montantPropose,
      motif: `${b.motifPropose || "Allocation"} — confirmé reçu`, date: Date.now(),
      auteur: user?.nom || user?.login || "—",
    };
    const revisions = [...(b.revisions || []), entry];
    const { error } = await supabase.from("budgets").update({
      montant: b.montantPropose, revisions, montant_propose: null, motif_propose: null, statut_validation: null,
    }).eq("id", budgetId);
    if (error) return { ok: false, error: error.message };
    await get().chargerBudgets();
    return { ok: true };
  },

  // Retour à « Non défini » — supprime le budget (et son historique) pour ce mois.
  supprimerBudget: async (id) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerBudgets();
    return { ok: true };
  },

  chargerBanque: async () => {
    const { data } = await supabase.from("banque_mouvements").select("*").order("date");
    set({ banque: (data || []).map(mapMouvementBanque) });
  },
  chargerPartenaires: async () => {
    const { data } = await supabase.from("partenaires").select("*").order("nom");
    set({ partenaires: (data || []).map(mapPartenaire) });
  },

  addMouvementBanque: async (payload) => {
    const { error } = await supabase.from("banque_mouvements").insert({
      date: payload.date, type: payload.type, libelle: payload.libelle || "",
      origine: payload.origine || "", personne: payload.personne || "",
      montant: payload.montant, ouverture: !!payload.ouverture,
    });
    if (error) return { ok: false, error: error.message };
    await get().chargerBanque();
    return { ok: true };
  },
  modifierMouvementBanque: async (id, payload) => {
    const { error } = await supabase.from("banque_mouvements").update({
      date: payload.date, type: payload.type, libelle: payload.libelle || "",
      origine: payload.origine || "", personne: payload.personne || "", montant: payload.montant,
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerBanque();
    return { ok: true };
  },
  supprimerMouvementBanque: async (id) => {
    const { error } = await supabase.from("banque_mouvements").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerBanque();
    return { ok: true };
  },
  // Solde d'ouverture : une seule ligne `ouverture = true` — upsert par id fixe
  // pour ne jamais en créer une deuxième par erreur.
  definirSoldeOuverture: async (id, date, montant) => {
    const { error } = await supabase.from("banque_mouvements").upsert(
      { id: id || undefined, date, montant, type: "depot", ouverture: true, libelle: "SOLDE D'OUVERTURE" },
      { onConflict: "id" }
    );
    if (error) return { ok: false, error: error.message };
    await get().chargerBanque();
    return { ok: true };
  },

  addPartenaire: async (payload) => {
    const { error } = await supabase.from("partenaires").insert({ nom: payload.nom.trim(), type: (payload.type || "").trim(), contact: (payload.contact || "").trim() });
    if (error) return { ok: false, error: error.message };
    await get().chargerPartenaires();
    return { ok: true };
  },
  modifierPartenaire: async (id, payload) => {
    const { error } = await supabase.from("partenaires").update({ nom: payload.nom.trim(), type: (payload.type || "").trim(), contact: (payload.contact || "").trim() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerPartenaires();
    return { ok: true };
  },
  supprimerPartenaire: async (id) => {
    const { error } = await supabase.from("partenaires").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await get().chargerPartenaires();
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
