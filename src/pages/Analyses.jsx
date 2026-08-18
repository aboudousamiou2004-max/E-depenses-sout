import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { LineChart } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { depensesSecteurMois, totalMontant, fmtFCFA } from "../lib/logic";

// Analyses — répartition des dépenses par secteur (la rentabilité, elle, vit
// désormais dans son propre volet, voir Rentabilite.jsx).
export default function Analyses() {
  const { secteurs, depenses } = useDataStore();
  const { periode } = useUIStore();

  const parSecteur = useMemo(() => {
    return secteurs
      .map((s) => ({ ...s, dep: totalMontant(depensesSecteurMois(depenses, s.id, periode.annee, periode.mois)) }))
      .filter((s) => s.dep > 0)
      .sort((a, b) => b.dep - a.dep);
  }, [secteurs, depenses, periode]);

  const pieData = parSecteur.map((s) => ({ name: s.nom, value: s.dep, fill: s.color }));
  const total = parSecteur.reduce((s, x) => s + x.dep, 0);

  return (
    <div>
      <TopBar title="Analyses" subtitle="Répartition des dépenses par secteur d'activité" icon={LineChart} accent="#5E5CE6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2 p-4 sm:p-6" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-4">Détail par secteur</h3>
          <div className="flex flex-col gap-2">
            {parSecteur.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-white/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <p className="text-[13.5px] font-semibold text-ink truncate">{s.nom}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-bold tabular text-ink">{fmtFCFA(s.dep)}</p>
                  <p className="text-[11px] text-ink-soft">{total ? Math.round((s.dep / total) * 100) : 0}%</p>
                </div>
              </div>
            ))}
            {parSecteur.length === 0 && <p className="text-center py-10 text-[13px] text-ink-soft italic">Aucune dépense sur la période.</p>}
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
