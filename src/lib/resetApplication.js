// Réinitialisation complète des DONNÉES de l'application — supprime toutes
// les dépenses/recettes/stocks/journal/etc. de TOUS les secteurs et modules.
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
];

/**
 * Supprime toutes les lignes de toutes les tables listées ci-dessus, puis
 * tous les comptes `profiles` sauf celui de la personne qui déclenche la
 * réinitialisation.
 *
 * @param {object} opts
 * @param {string} opts.keepUserId - uuid du profil à préserver.
 * @param {(info: {table: string, index: number, total: number, removed: number, ok: boolean}) => void} [opts.onProgress]
 * @returns {Promise<{table: string, removed: number, ok: boolean, error?: string}[]>}
 */
export async function reinitialiserBaseDeDonnees({ keepUserId, onProgress }) {
  if (!keepUserId) throw new Error("keepUserId requis — impossible de réinitialiser sans savoir quel compte préserver.");

  const cibles = [...TABLES_A_REINITIALISER, "profiles"];
  const total = cibles.length;
  const resultats = [];

  for (let index = 0; index < cibles.length; index++) {
    const table = cibles[index];
    let removed = 0;
    let ok = true;
    let errMsg;
    try {
      let query = supabase.from(table).delete({ count: "exact" }).not("id", "is", null);
      if (table === "profiles") query = query.neq("id", keepUserId);
      const { error, count } = await query;
      if (error) throw error;
      removed = count || 0;
    } catch (e) {
      ok = false;
      errMsg = e?.message || String(e);
      console.error(`[resetApplication] échec sur la table "${table}" :`, e);
    }
    resultats.push({ table, removed, ok, error: errMsg });
    onProgress?.({ table, index: index + 1, total, removed, ok });
  }
  return resultats;
}
