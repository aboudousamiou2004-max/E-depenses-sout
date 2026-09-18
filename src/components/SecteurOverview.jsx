import { useMemo, useState } from "react";
import { Wallet, TrendingDown, Scale, PieChart as PieIcon, Send, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import GlassCard from "./ui/GlassCard";
import StatTile from "./ui/StatTile";
import ProgressRing from "./ui/ProgressRing";
import Badge from "./ui/Badge";
import TransactionsListModal from "./TransactionsListModal";
import DepenseDetailModal from "./DepenseDetailModal";
import RecetteDetailModal from "./RecetteDetailModal";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { budgetSecteurMois, depensesSecteurMois, totalMontant, fmtFCFA, fmtCompact, statutBudget, last12Months, matchPeriode, moyenLabel } from "../lib/logic";
import { ROLES_ACCES_TOTAL, peutSupprimer as peutSupprimerRole, peutModifierDepense, peutSupprimerDepense, peutConfirmerBudget } from "../lib/modules";

// Vue "un ou plusieurs secteurs" — utilisée à la fois par le tableau de bord
// E-DÉPENSES (secteur précis OU module entier sélectionné dans le filtre :
// voir `secteurIds`) et par le tableau de bord des modules métier (toujours
// un seul secteur précis : voir `secteurId`), pour ne jamais dupliquer ce
// calcul à deux endroits. Un module décliné par ville (MAXI GYM, MAXI
// LOGISTIQUE) sélectionné comme un tout cumule tous ses lieux — à la demande
// explicite de l'utilisateur (2026-09-15).
export default function SecteurOverview({ secteurId, secteurIds, nom, color, labelRecettes = "Dernières recettes", onVoirDepenses, onVoirRecettes }) {
  const { secteurs, budgets, depenses, recettes, categories, users, modifierDepense, supprimerDepense, changerStatutDepense, modifierRecette, supprimerRecette, validerReceptionBudget } = useDataStore();
  const { periode } = useUIStore();
  const { user } = useAuthStore();
  // Recettes : inchangé, réservé aux rôles à accès total. Dépenses : voir
  // peutModifierDepense (chacun peut modifier la sienne tant qu'en_attente).
  const peutModifierRecette = ROLES_ACCES_TOTAL.includes(user?.role);
  const peutApprouver = ROLES_ACCES_TOTAL.includes(user?.role);
  const peutSupprimerRecette = peutSupprimerRole(user?.role);
  const [vueTransactions, setVueTransactions] = useState(null); // { type, title, items }
  const [depenseSelectionnee, setDepenseSelectionnee] = useState(null);
  const [recetteSelectionnee, setRecetteSelectionnee] = useState(null);
  const [confirmationBusy, setConfirmationBusy] = useState(null);

  const ids = useMemo(() => (secteurIds?.length ? secteurIds : secteurId ? [secteurId] : []), [secteurIds, secteurId]);
  const suffixePeriode = periode.jour ? "du jour" : "du mois";

  const depensesPeriode = useMemo(
    () => ids.flatMap((id) => depensesSecteurMois(depenses, id, periode.annee, periode.mois, periode.jour)),
    [ids, depenses, periode]
  );
  const recettesPeriode = useMemo(
    () => recettes.filter((r) => ids.includes(r.secteurId) && matchPeriode(r.date, periode)),
    [ids, recettes, periode]
  );
  const budget = useMemo(
    () => ids.reduce((s, id) => s + budgetSecteurMois(budgets, id, periode.annee, periode.mois), 0),
    [ids, budgets, periode]
  );
  // Budget(s) proposé(s) en attente de confirmation pour ce(s) secteur(s) —
  // affiché directement sur le tableau de bord du secteur (pas seulement
  // dans E-DÉPENSES → Recette et Budget) pour que le gérant, qui n'a pas
  // forcément accès au module E-DÉPENSES, puisse confirmer depuis son propre
  // écran (à la demande explicite de l'utilisateur, 2026-09-18).
  const budgetsProposes = useMemo(
    () => budgets.filter((b) => ids.includes(b.secteurId) && b.montantPropose != null),
    [budgets, ids]
  );
  async function confirmerReceptionBudget(b) {
    if (confirmationBusy) return;
    setConfirmationBusy(b.id);
    const res = await validerReceptionBudget(b.id, user);
    setConfirmationBusy(null);
    if (!res.ok) alert(res.error);
  }
  const depenseMois = totalMontant(depensesPeriode);
  const recetteMois = totalMontant(recettesPeriode);
  const pct = budget > 0 ? Math.round((depenseMois / budget) * 100) : depenseMois > 0 ? 100 : 0;
  const statut = statutBudget(pct / 100);
  const solde = recetteMois - depenseMois;

  const recentesDepenses = useMemo(
    () => depenses.filter((d) => ids.includes(d.secteurId)).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5),
    [depenses, ids]
  );
  const recentesRecettes = useMemo(
    () => recettes.filter((r) => ids.includes(r.secteurId)).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5),
    [recettes, ids]
  );

  // Revenus vs dépenses par mois, 12 derniers mois — pour repérer d'un coup
  // d'œil les mois où les dépenses dépassent les encaissements du/des secteur(s).
  const evolutionMensuelle = useMemo(() => {
    return last12Months().map(({ annee, mois, label }) => {
      const rec = totalMontant(
        recettes.filter((r) => {
          const dt = new Date(r.date);
          return ids.includes(r.secteurId) && dt.getFullYear() === annee && dt.getMonth() === mois;
        })
      );
      const dep = totalMontant(ids.flatMap((id) => depensesSecteurMois(depenses, id, annee, mois)));
      return { label, recettes: rec, depenses: dep };
    });
  }, [ids, recettes, depenses]);

  return (
    <div>
      {budgetsProposes.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {budgetsProposes.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#B45309]/20 bg-[#B45309]/5 px-4 py-3">
              <Send size={14} className="shrink-0 text-[#B45309]" />
              <span className="text-[12.5px] text-[#93400a]">
                <strong>{fmtFCFA(b.montantPropose)}</strong> proposés par {b.proposeParText}
                {b.motifPropose ? ` : ${b.motifPropose}` : ""}
                {b.moyenPropose ? ` · ${moyenLabel(b.moyenPropose)}` : ""} · en attente de confirmation
              </span>
              {peutConfirmerBudget(user, b.secteurId) && (
                <button onClick={() => confirmerReceptionBudget(b)} disabled={confirmationBusy === b.id}
                  className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#30D158] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[#29b84c] disabled:opacity-60 transition-colors">
                  <CheckCircle2 size={13} /> {confirmationBusy === b.id ? "Confirmation…" : "Confirmer la réception"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        <StatTile
          icon={Wallet}
          label={`Recettes ${suffixePeriode}`}
          value={fmtCompact(recetteMois) + " FCFA"}
          tone="#30D158"
          onClick={() => setVueTransactions({ type: "recette", title: `Recettes ${suffixePeriode} : ${nom}`, items: recettesPeriode })}
        />
        <StatTile
          icon={TrendingDown}
          label={`Dépenses ${suffixePeriode}`}
          value={fmtCompact(depenseMois) + " FCFA"}
          tone={color}
          onClick={() => setVueTransactions({ type: "depense", title: `Dépenses ${suffixePeriode} : ${nom}`, items: depensesPeriode })}
        />
        <StatTile
          icon={Scale}
          label="Solde"
          value={fmtCompact(solde) + " FCFA"}
          tone={solde >= 0 ? "#30D158" : "#FF453A"}
          onClick={() => setVueTransactions({ type: "recette", title: `Recettes et dépenses ${suffixePeriode} : ${nom}`, items: [...recettesPeriode].sort((a, b) => (a.date < b.date ? 1 : -1)) })}
        />
        <StatTile icon={PieIcon} label="Budget alloué" value={budget ? fmtCompact(budget) + " FCFA" : "Non défini"} tone="#5E5CE6" />
      </div>

      <GlassCard className="p-6 mb-5 flex flex-col" hover={false}>
        <h3 className="font-bold tracking-tight text-ink mb-0.5">Revenus vs dépenses : {nom}</h3>
        <p className="text-[12.5px] text-ink-soft font-medium mb-2">Par mois : 12 derniers mois</p>
        <div style={{ height: 240 }} className="-ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolutionMensuelle} barGap={2}>
              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(15,23,42,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#3c4048", fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: "#3c4048" }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                formatter={(v) => fmtFCFA(v)}
                contentStyle={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", fontSize: 12.5 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
              {/* Couleurs fixes (entrée/sortie), indépendantes de la couleur du secteur —
                  celle-ci peut coïncider avec le vert des revenus (ex. MAXI AGRO). */}
              <Bar dataKey="recettes" name="Revenus" fill="#30D158" radius={[4, 4, 0, 0]} />
              <Bar dataKey="depenses" name="Dépenses" fill="#FF453A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-6 flex flex-col items-center justify-center gap-3" hover={false}>
          <p className="text-[12.5px] font-semibold text-ink-soft text-center">Consommation du budget : {nom}</p>
          {budget > 0 ? (
            <>
              <ProgressRing value={pct / 100} color={pct >= 100 ? "#FF453A" : pct >= 80 ? "#FF9F0A" : "#30D158"} size={116} />
              <Badge tone={statut.tone}>{statut.label}</Badge>
            </>
          ) : (
            <p className="text-[13px] text-ink-soft italic text-center py-6">Aucun budget défini pour ce secteur ce mois-ci.</p>
          )}
        </GlassCard>

        <GlassCard className="p-6" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-3">Dernières dépenses</h3>
          <div className="flex flex-col gap-2">
            {recentesDepenses.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucune dépense.</p>}
            {recentesDepenses.map((d) => (
              <button key={d.id} onClick={() => setDepenseSelectionnee(d)} className="flex items-center justify-between text-[12.5px] px-1 py-0.5 rounded-lg hover:bg-black/[0.03] transition-colors text-left">
                <span className="text-ink-soft truncate">{d.categorie}</span>
                <span className="font-bold tabular text-ink shrink-0 ml-2">{fmtFCFA(d.montant)}</span>
              </button>
            ))}
          </div>
          {onVoirDepenses && (
            <button onClick={onVoirDepenses} className="mt-3 text-[12px] font-semibold" style={{ color }}>
              Voir toutes les dépenses →
            </button>
          )}
        </GlassCard>

        <GlassCard className="p-6" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-3">{labelRecettes}</h3>
          <div className="flex flex-col gap-2">
            {recentesRecettes.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucune recette.</p>}
            {recentesRecettes.map((r) => (
              <button key={r.id} onClick={() => setRecetteSelectionnee(r)} className="flex items-center justify-between text-[12.5px] px-1 py-0.5 rounded-lg hover:bg-black/[0.03] transition-colors text-left">
                <span className="text-ink-soft truncate">{r.origine}</span>
                <span className="font-bold tabular text-[#1a7d34] shrink-0 ml-2">+{fmtFCFA(r.montant)}</span>
              </button>
            ))}
          </div>
          {onVoirRecettes && (
            <button onClick={onVoirRecettes} className="mt-3 text-[12px] font-semibold" style={{ color }}>
              Voir toutes les recettes →
            </button>
          )}
        </GlassCard>
      </div>

      {vueTransactions && (
        <TransactionsListModal
          type={vueTransactions.type}
          title={vueTransactions.title}
          items={vueTransactions.items}
          onClose={() => setVueTransactions(null)}
        />
      )}
      <DepenseDetailModal
        depense={depenseSelectionnee}
        secteurs={secteurs}
        categories={categories}
        users={users}
        peutModifier={peutModifierDepense(user, depenseSelectionnee)}
        peutApprouver={peutApprouver}
        peutSupprimer={peutSupprimerDepense(user)}
        modifierDepense={modifierDepense}
        supprimerDepense={supprimerDepense}
        changerStatutDepense={changerStatutDepense}
        currentUser={user}
        onClose={() => setDepenseSelectionnee(null)}
      />
      <RecetteDetailModal
        recette={recetteSelectionnee}
        secteurs={secteurs}
        peutModifier={peutModifierRecette}
        peutSupprimer={peutSupprimerRecette}
        modifierRecette={modifierRecette}
        supprimerRecette={supprimerRecette}
        currentUser={user}
        onClose={() => setRecetteSelectionnee(null)}
      />
    </div>
  );
}
