// Réinitialisation des DONNÉES de l'application — soit TOUT (tous les
// secteurs, tous les modules, tous les autres comptes), soit CIBLÉE sur un
// secteur précis ou un module entier décliné par ville (ex. « MAXI GYM » =
// Lomé + Kara), à la demande explicite de l'utilisateur (2026-09-15).
// Fonction technique sensible, réservée au super-administrateur (cf.
// Paramètres → Zone de danger).
//
// Choix volontaire : la table `secteurs` (structure des modules) N'EST PAS
// vidée — de nombreuses tables la référencent par clé étrangère (secteur_id),
// et Postgres refuserait de supprimer un secteur encore référencé. Réinitialiser
// les DONNÉES sans casser la STRUCTURE (secteurs, catégories restent) est à la
// fois plus sûr et plus utile : l'app reste utilisable immédiatement après.
//
// ⚠️ Liste MAINTENUE À LA MAIN — dérivée par recherche exhaustive de tous les
// appels supabase.from(...) dans src/. Si une table est ajoutée plus tard,
// il faut l'ajouter ici, sinon elle survivrait à une réinitialisation.
import { supabase } from "./supabaseClient";

export const TABLES_A_REINITIALISER = [
  // ── E-DÉPENSES ──────────────────────────────────────────────────────────
  "depenses", "recettes", "budgets", "categories_depense", "banque_mouvements",
  "partenaires", "besoins",
  // ── Journal & notifications (tous modules) ─────────────────────────────
  "journal", "notifications", "push_subscriptions",
  // ── MAXI AGRO ───────────────────────────────────────────────────────────
  "agro_aliments", "agro_animaux_individuels", "agro_malades", "agro_materiel",
  "agro_mouvements_aliments", "agro_mouvements_materiel", "agro_sante", "agro_vaccins",
  "referentiel_animaux", "mouvements_animaux",
  // ── MAXI LOGISTIQUE ─────────────────────────────────────────────────────
  "referentiel_materiel", "mouvements_materiel",
  // ── E-BRIQUETERIE ───────────────────────────────────────────────────────
  "briqueterie_config", "briqueterie_materiel", "briqueterie_mouvements_materiel",
  "journal_briques", "referentiel_matieres", "mouvements_matieres", "types_briques",
  // ── E-GARDERIE ──────────────────────────────────────────────────────────
  "garderie_enfants", "garderie_incidents", "garderie_menus", "garderie_paiements",
  "garderie_repas", "garderie_soins",
  // ── E-FONCIER ───────────────────────────────────────────────────────────
  "foncier_dossiers", "foncier_frais",
  // ── E-G.PRO ─────────────────────────────────────────────────────────────
  "egpro_projets", "egpro_taches", "egpro_versements_client",
  // ── MAXI GYM ────────────────────────────────────────────────────────────
  "gym_forfaits", "gym_clients", "gym_coachs", "gym_pointages", "gym_abonnements", "gym_coach_pointages",
  // ── MAXI COM ────────────────────────────────────────────────────────────
  "com_campagnes",
  // ── MAXI LOGISTIQUE (Transport) ────────────────────────────────────────
  "logistique_transports",
];

// Tables qui portent leur PROPRE colonne `secteur_id` — un reset ciblé peut
// filtrer dessus directement (`in("secteur_id", ids)`).
export const TABLES_SCOPABLES = [
  "depenses", "recettes", "budgets", "categories_depense", "besoins", "journal",
  "referentiel_materiel", "mouvements_materiel",
  "gym_forfaits", "gym_clients", "gym_coachs", "gym_abonnements",
  "com_campagnes", "logistique_transports",
];

// Tables sans secteur_id propre, mais rattachées à une table scopable par une
// clé étrangère — un reset ciblé les vide via les ids du parent déjà filtré
// (ex. les pointages d'un abonnement gym n'existent que pour un secteur
// donné, via l'abonnement lui-même).
const TABLES_ENFANTS_SCOPABLES = [
  { table: "gym_pointages", fk: "abonnement_id", parent: "gym_abonnements" },
  { table: "gym_coach_pointages", fk: "coach_id", parent: "gym_coachs" },
];

// Tables qui NE PEUVENT PAS être ciblées sur un secteur précis aujourd'hui —
// données partagées entre toutes les villes d'un même module (cheptel/
// magasin MAXI AGRO, stock E-BRIQUETERIE) ou modules pas encore déclinés par
// ville (fiches E-GARDERIE/E-FONCIER/E-G.PRO), plus les tables réellement
// globales (banque, partenaires, notifications, abonnements push). Un reset
// ciblé les laisse volontairement intactes plutôt que de risquer de vider
// les données d'un autre lieu du même module.
export const TABLES_NON_SCOPABLES = TABLES_A_REINITIALISER.filter(
  (t) => !TABLES_SCOPABLES.includes(t) && !TABLES_ENFANTS_SCOPABLES.some((e) => e.table === t)
);

/**
 * Supprime les données de l'application — soit TOUT (tous secteurs + tous
 * les autres comptes `profiles`), soit UNIQUEMENT les secteurs listés dans
 * `secteurIds` (un seul secteur, ou tous ceux d'un même module décliné par
 * ville) — dans ce cas les comptes utilisateurs ne sont jamais touchés, et
 * seules les tables de `TABLES_SCOPABLES`/`TABLES_ENFANTS_SCOPABLES` sont
 * vidées (voir `TABLES_NON_SCOPABLES` pour ce qui reste volontairement
 * intact).
 *
 * @param {object} opts
 * @param {string} [opts.keepUserId] - uuid du profil à préserver (requis seulement pour un reset TOTAL).
 * @param {string[]} [opts.secteurIds] - ids de secteur à cibler ; omis/vide = reset total.
 * @param {(info: {table: string, index: number, total: number, removed: number, ok: boolean}) => void} [opts.onProgress]
 * @returns {Promise<{table: string, removed: number, ok: boolean, error?: string}[]>}
 */
export async function reinitialiserBaseDeDonnees({ keepUserId, secteurIds, onProgress }) {
  const scoped = Array.isArray(secteurIds) && secteurIds.length > 0;
  if (!scoped && !keepUserId) throw new Error("keepUserId requis — impossible de réinitialiser sans savoir quel compte préserver.");

  const cibles = scoped ? TABLES_SCOPABLES : [...TABLES_A_REINITIALISER, "profiles"];
  const total = cibles.length + (scoped ? TABLES_ENFANTS_SCOPABLES.length : 0);
  const resultats = [];
  let index = 0;

  for (const table of cibles) {
    index++;
    let removed = 0;
    let ok = true;
    let errMsg;
    try {
      let query = supabase.from(table).delete({ count: "exact" });
      query = scoped ? query.in("secteur_id", secteurIds) : query.not("id", "is", null);
      if (!scoped && table === "profiles") query = query.neq("id", keepUserId);
      const { error, count } = await query;
      if (error) throw error;
      removed = count || 0;
    } catch (e) {
      ok = false;
      errMsg = e?.message || String(e);
      console.error(`[resetApplication] échec sur la table "${table}" :`, e);
    }
    resultats.push({ table, removed, ok, error: errMsg });
    onProgress?.({ table, index, total, removed, ok });
  }

  if (scoped) {
    for (const { table, fk, parent } of TABLES_ENFANTS_SCOPABLES) {
      index++;
      let removed = 0;
      let ok = true;
      let errMsg;
      try {
        const { data: parents, error: errParents } = await supabase.from(parent).select("id").in("secteur_id", secteurIds);
        if (errParents) throw errParents;
        const ids = (parents || []).map((p) => p.id);
        if (ids.length > 0) {
          const { error, count } = await supabase.from(table).delete({ count: "exact" }).in(fk, ids);
          if (error) throw error;
          removed = count || 0;
        }
      } catch (e) {
        ok = false;
        errMsg = e?.message || String(e);
        console.error(`[resetApplication] échec sur la table "${table}" :`, e);
      }
      resultats.push({ table, removed, ok, error: errMsg });
      onProgress?.({ table, index, total, removed, ok });
    }
  }

  return resultats;
}
