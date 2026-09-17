import { supabase } from "./supabaseClient";

// Enregistre le motif d'une suppression (table `motifs_suppression`, voir
// migration_motifs_suppression.sql) — appelé juste avant la suppression
// réelle par chaque écran de l'application, via ConfirmSuppressionModal.
// N'échoue jamais bruyamment : si la table n'existe pas encore (migration
// pas exécutée) ou si l'insert échoue, on log en console et on laisse la
// suppression elle-même se poursuivre plutôt que de bloquer l'utilisateur
// pour une trace d'audit manquante.
export async function enregistrerMotifSuppression({ user, table, label, motif, secteurId }) {
  if (!user?.uid) return;
  try {
    await supabase.from("motifs_suppression").insert({
      table_nom: table,
      element_label: label || "",
      motif,
      secteur_id: secteurId || null,
      user_id: user.uid,
      user_nom: user.nom || user.login || "",
      role: user.role || "",
    });
  } catch (e) {
    console.error("[motifSuppression] échec de l'enregistrement du motif :", e);
  }
}
