import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Scale, TrendingUp } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import StatTile from "../components/ui/StatTile";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { soldesFluxMois, fmtFCFA, fmtCompact, last12Months } from "../lib/logic";

export default function Flux() {
  const { depenses, recettes } = useDataStore();
  const { periode } = useUIStore();

  const flux = useMemo(() => soldesFluxMois(depenses, recettes, periode.annee, periode.mois), [depenses, recettes, periode]);

  const trend = useMemo(() => {
    return last12Months().map(({ annee, mois, label }) => {
      const f = soldesFluxMois(depenses, recettes, annee, mois);
      return { label, entrees: f.totalRec, sorties: f.exploitation + f.investissement + f.perte, solde: f.solde };
    });
  }, [depenses, recettes]);

  return (
    <div>
      <TopBar title="Flux de trésorerie" subtitle="Entrées, sorties et solde net par nature de flux" icon={TrendingUp} accent="#0A84FF" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        <StatTile icon={ArrowUpCircle} label="Recettes du mois" value={fmtCompact(flux.totalRec) + " FCFA"} tone="#30D158" />
        <StatTile icon={ArrowDownCircle} label="Exploitation" value={fmtCompact(flux.exploitation) + " FCFA"} tone="#FF9F0A" />
        <StatTile icon={ArrowDownCircle} label="Investissement" value={fmtCompact(flux.investissement) + " FCFA"} tone="#5E5CE6" />
        <StatTile icon={Scale} label="Solde net" value={fmtCompact(flux.solde) + " FCFA"} tone={flux.solde >= 0 ? "#30D158" : "#FF453A"} />
      </div>

      <GlassCard className="p-4 sm:p-6" hover={false}>
        <h3 className="font-bold tracking-tight text-ink mb-0.5">Évolution des flux — 12 derniers mois</h3>
        <p className="text-[12.5px] text-ink-soft font-medium mb-3">Entrées vs sorties, tous secteurs confondus</p>
        <div className="h-[260px] sm:h-[340px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="entrees" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#30D158" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#30D158" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sorties" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF453A" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#FF453A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(15,23,42,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#3c4048", fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: "#3c4048" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v) => fmtFCFA(v)} contentStyle={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", fontSize: 12.5 }} />
              <Area type="monotone" dataKey="entrees" stroke="#30D158" strokeWidth={2.5} fill="url(#entrees)" />
              <Area type="monotone" dataKey="sorties" stroke="#FF453A" strokeWidth={2.5} fill="url(#sorties)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}
