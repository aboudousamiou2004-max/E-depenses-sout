import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import Badge from "../components/ui/Badge";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { depensesSecteurMois, totalMontant, fmtFCFA, fmtCompact } from "../lib/logic";

export default function Analyses() {
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

  const pieData = rentabilite.map((s) => ({ name: s.nom, value: Math.max(s.dep, 1), fill: s.color }));

  return (
    <div>
      <TopBar title="Analyses & rentabilité" subtitle="Comparaison recettes / dépenses et marge par secteur" />

      <div className="grid grid-cols-3 gap-5">
        <GlassCard className="col-span-2 p-6" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-4">Rentabilité par secteur</h3>
          <div className="flex flex-col gap-2">
            {rentabilite.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink truncate">{s.nom}</p>
                    <p className="text-[11.5px] text-ink-soft truncate">{s.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
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
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-2">Répartition des dépenses</h3>
          <div className="flex-1 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} cornerRadius={8}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtFCFA(v)} contentStyle={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
