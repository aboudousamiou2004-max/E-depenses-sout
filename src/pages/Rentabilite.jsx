import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { depensesSecteurMois, totalMontant, fmtCompact } from "../lib/logic";

// Rentabilité par secteur (recettes − dépenses du mois) — extrait d'Analyses.jsx
// en volet séparé pour correspondre à la navigation de termitiere-platform
// (Analyses et Rentabilité sont deux onglets distincts là-bas).
export default function Rentabilite() {
  const { secteurs, depenses, recettes } = useDataStore();
  const { periode } = useUIStore();

  const rentabilite = useMemo(() => {
    return secteurs
      .map((s) => {
        const dep = totalMontant(depensesSecteurMois(depenses, s.id, periode.annee, periode.mois));
        const rec = totalMontant(
          recettes.filter((r) => {
            const dt = new Date(r.date);
            return r.secteurId === s.id && dt.getFullYear() === periode.annee && dt.getMonth() === periode.mois;
          })
        );
        const marge = rec - dep;
        return { ...s, dep, rec, marge, tauxMarge: rec ? marge / rec : 0 };
      })
      .sort((a, b) => b.marge - a.marge);
  }, [secteurs, depenses, recettes, periode]);

  return (
    <div>
      <TopBar title="Rentabilité" subtitle="Marge (recettes − dépenses) par secteur d'activité" />

      <GlassCard className="p-4 sm:p-6" hover={false}>
        <div className="flex flex-col gap-2">
          {rentabilite.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 flex-wrap px-4 py-3.5 rounded-2xl bg-white/50">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink truncate">{s.nom}</p>
                  <p className="text-[11.5px] text-ink-soft truncate">{s.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                <div className="text-right">
                  <p className="text-[11px] text-ink-soft font-semibold">Recettes</p>
                  <p className="text-[13px] font-bold tabular text-[#1a7d34]">{fmtCompact(s.rec)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-ink-soft font-semibold">Dépenses</p>
                  <p className="text-[13px] font-bold tabular text-[#b3241b]">{fmtCompact(s.dep)}</p>
                </div>
                <div className="text-right w-28">
                  <p className="text-[11px] text-ink-soft font-semibold">Marge</p>
                  <p className={`text-[14px] font-bold tabular flex items-center justify-end gap-1 ${s.marge >= 0 ? "text-[#1a7d34]" : "text-[#b3241b]"}`}>
                    {s.marge >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {fmtCompact(s.marge)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {rentabilite.length === 0 && <p className="text-center py-10 text-[13px] text-ink-soft italic">Aucun secteur.</p>}
        </div>
      </GlassCard>
    </div>
  );
}
