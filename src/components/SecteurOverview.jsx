import { useMemo, useState } from "react";
import { Wallet, TrendingDown, Scale, PieChart as PieIcon } from "lucide-react";
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
import { budgetSecteurMois, depensesSecteurMois, totalMontant, fmtFCFA, fmtCompact, statutBudget, last12Months, matchPeriode } from "../lib/logic";
import { ROLES_ACCES_TOTAL } from "../lib/modules";

// Vue "un seul secteur" — utilisée à la fois par le tableau de bord E-DÉPENSES
// (quand un secteur précis est sélectionné dans le filtre) et par le tableau de
// bord des modules métier, pour ne jamais dupliquer ce calcul à deux endroits.
export default function SecteurOverview({ secteurId, nom, color, labelRecettes = "Dernières recettes", onVoirDepenses, onVoirRecettes }) {
  const { secteurs, budgets, depenses, recettes, categories, modifierDepense, supprimerDepense, modifierRecette, supprimerRecette } = useDataStore();
  const { periode } = useUIStore();
  const { user } = useAuthStore();
  const peutModifier = ROLES_ACCES_TOTAL.includes(user?.role);
  const [vueTransactions, setVueTransactions] = useState(null); // { type, title, items }
  const [depenseSelectionnee, setDepenseSelectionnee] = useState(null);
  const [recetteSelectionnee, setRecetteSelectionnee] = useState(null);

  const suffixePeriode = periode.jour ? "du jour" : "du mois";

  const depensesPeriode = depensesSecteurMois(depenses, secteurId, periode.annee, periode.mois, periode.jour);
  const recettesPeriode = recettes.filter((r) => r.secteurId === secteurId && matchPeriode(r.date, periode));
  const budget = budgetSecteurMois(budgets, secteurId, periode.annee, periode.mois);
  const depenseMois = totalMontant(depensesPeriode);
  const recetteMois = totalMontant(recettesPeriode);
  const pct = budget > 0 ? Math.round((depenseMois / budget) * 100) : depenseMois > 0 ? 100 : 0;
  const statut = statutBudget(pct / 100);
  const solde = recetteMois - depenseMois;

  const recentesDepenses = useMemo(
    () => depenses.filter((d) => d.secteurId === secteurId).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5),
    [depenses, secteurId]
  );
  const recentesRecettes = useMemo(
    () => recettes.filter((r) => r.secteurId === secteurId).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5),
    [recettes, secteurId]
  );

  // Revenus vs dépenses par mois, 12 derniers mois — pour repérer d'un coup
  // d'œil les mois où les dépenses dépassent les encaissements du secteur.
  const evolutionMensuelle = useMemo(() => {
    return last12Months().map(({ annee, mois, label }) => {
      const rec = totalMontant(
        recettes.filter((r) => {
          const dt = new Date(r.date);
          return r.secteurId === secteurId && dt.getFullYear() === annee && dt.getMonth() === mois;
        })
      );
      const dep = totalMontant(depensesSecteurMois(depenses, secteurId, annee, mois));
      return { label, recettes: rec, depenses: dep };
    });
  }, [secteurId, recettes, depenses]);

  return (
    <div>
      <div className="grid grid-cols-4 gap-5 mb-5">
        <StatTile
          icon={Wallet}
          label={`Recettes ${suffixePeriode}`}
          value={fmtCompact(recetteMois) + " FCFA"}
          tone="#30D158"
          onClick={() => setVueTransactions({ type: "recette", title: `Recettes ${suffixePeriode} — ${nom}`, items: recettesPeriode })}
        />
        <StatTile
          icon={TrendingDown}
          label={`Dépenses ${suffixePeriode}`}
          value={fmtCompact(depenseMois) + " FCFA"}
          tone={color}
          onClick={() => setVueTransactions({ type: "depense", title: `Dépenses ${suffixePeriode} — ${nom}`, items: depensesPeriode })}
        />
        <StatTile
          icon={Scale}
          label="Solde"
          value={fmtCompact(solde) + " FCFA"}
          tone={solde >= 0 ? "#30D158" : "#FF453A"}
          onClick={() => setVueTransactions({ type: "recette", title: `Recettes et dépenses ${suffixePeriode} — ${nom}`, items: [...recettesPeriode].sort((a, b) => (a.date < b.date ? 1 : -1)) })}
        />
        <StatTile icon={PieIcon} label="Budget alloué" value={budget ? fmtCompact(budget) + " FCFA" : "Non défini"} tone="#5E5CE6" />
      </div>

      <GlassCard className="p-6 mb-5 flex flex-col" hover={false}>
        <h3 className="font-bold tracking-tight text-ink mb-0.5">Revenus vs dépenses — {nom}</h3>
        <p className="text-[12.5px] text-ink-soft font-medium mb-2">Par mois — 12 derniers mois</p>
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

      <div className="grid grid-cols-3 gap-5">
        <GlassCard className="p-6 flex flex-col items-center justify-center gap-3" hover={false}>
          <p className="text-[12.5px] font-semibold text-ink-soft text-center">Consommation du budget — {nom}</p>
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
        peutModifier={peutModifier}
        modifierDepense={modifierDepense}
        supprimerDepense={supprimerDepense}
        onClose={() => setDepenseSelectionnee(null)}
      />
      <RecetteDetailModal
        recette={recetteSelectionnee}
        secteurs={secteurs}
        peutModifier={peutModifier}
        modifierRecette={modifierRecette}
        supprimerRecette={supprimerRecette}
        onClose={() => setRecetteSelectionnee(null)}
      />
    </div>
  );
}
