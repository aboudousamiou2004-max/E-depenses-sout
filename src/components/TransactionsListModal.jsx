import { useState } from "react";
import Modal from "./ui/Modal";
import Badge from "./ui/Badge";
import DepenseDetailModal from "./DepenseDetailModal";
import RecetteDetailModal from "./RecetteDetailModal";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import { fmtFCFA, statutLabel } from "../lib/logic";
import { ROLES_ACCES_TOTAL, peutSupprimer as peutSupprimerRole, peutModifierDepense, peutSupprimerDepense } from "../lib/modules";

// Ouverte en cliquant sur un KPI du tableau de bord (général ou sectoriel) —
// liste les dépenses/recettes qui composent ce chiffre, avec un clic sur une
// ligne pour ouvrir son détail complet (voir/modifier/supprimer), exactement
// comme depuis les pages Dépenses/Recettes.
export default function TransactionsListModal({ type, title, items, onClose }) {
  const { secteurs, categories, users, modifierDepense, supprimerDepense, changerStatutDepense, modifierRecette, supprimerRecette } = useDataStore();
  const { user } = useAuthStore();
  const [selection, setSelection] = useState(null);
  const peutModifierRecette = ROLES_ACCES_TOTAL.includes(user?.role);
  const peutApprouver = ROLES_ACCES_TOTAL.includes(user?.role);
  // Suppression : réservée à l'administration pour une dépense
  // (peutSupprimerDepense), étendue à Superviseur/Gérant pour une recette
  // (peutSupprimer générique) — cf. lib/modules.js.
  const peutSupprimer = type === "depense" ? peutSupprimerDepense(user) : peutSupprimerRole(user?.role);

  function secteurOf(id) {
    return secteurs.find((s) => s.id === id);
  }

  return (
    <>
      <Modal open={!!items} onClose={onClose} title={title}>
        <div className="flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto -mx-1 px-1">
          {items && items.length === 0 && <p className="text-[13px] text-ink-soft italic py-4 text-center">Aucune donnée pour cette période.</p>}
          {items?.map((item) => {
            const s = secteurOf(item.secteurId);
            const st = type === "depense" ? statutLabel(item.statut) : null;
            return (
              <button
                key={item.id}
                onClick={() => setSelection(item)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl hover:bg-black/[0.03] transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s?.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink truncate">{type === "depense" ? item.categorie : item.origine}</p>
                  <p className="text-[11.5px] text-ink-soft truncate">{s?.nom} · {new Date(item.date).toLocaleDateString("fr-FR")}</p>
                </div>
                {st && <Badge tone={st.tone}>{st.label}</Badge>}
                <span className={`font-bold tabular shrink-0 ${type === "depense" ? "text-ink" : "text-[#1a7d34]"}`}>
                  {type === "depense" ? fmtFCFA(item.montant) : `+${fmtFCFA(item.montant)}`}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      {type === "depense" ? (
        <DepenseDetailModal
          depense={selection}
          secteurs={secteurs}
          categories={categories}
          users={users}
          peutModifier={peutModifierDepense(user, selection)}
          peutApprouver={peutApprouver}
          peutSupprimer={peutSupprimer}
          modifierDepense={modifierDepense}
          supprimerDepense={supprimerDepense}
          changerStatutDepense={changerStatutDepense}
          currentUser={user}
          onClose={() => setSelection(null)}
        />
      ) : (
        <RecetteDetailModal
          recette={selection}
          secteurs={secteurs}
          peutModifier={peutModifierRecette}
          peutSupprimer={peutSupprimer}
          modifierRecette={modifierRecette}
          supprimerRecette={supprimerRecette}
          currentUser={user}
          onClose={() => setSelection(null)}
        />
      )}
    </>
  );
}
