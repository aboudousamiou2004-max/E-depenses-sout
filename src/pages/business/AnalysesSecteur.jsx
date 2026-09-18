import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import { useDataStore } from "../../store/dataStore";
import { fmtFCFA, fmtCompact, totalMontant, last12Months } from "../../lib/logic";

// Analyses (générique) — volet de pilotage financier par défaut pour tout
// secteur sans volet d'analyse dédié (voir BusinessLayout.jsx) : dépenses,
// recettes et solde des 6 derniers mois, plus répartition des dépenses par
// catégorie — calculé uniquement à partir des dépenses/recettes déjà
// saisies, sans nouvelle table.
export default function AnalysesSecteur() {
  const config = useOutletContext();
  const { depenses, recettes } = useDataStore();

  // Comme depensesSecteurMois (lib/logic.js) : ne compte qu'une fois
  // décaissée, jamais en attente/approuvée/refusée.
  const depensesSecteur = useMemo(
    () => depenses.filter((d) => d.secteurId === config.secteurId && d.statut === "decaissee"),
    [depenses, config.secteurId]
  );
  const recettesSecteur = useMemo(() => recettes.filter((r) => r.secteurId === config.secteurId), [recettes, config.secteurId]);

  const mois6 = useMemo(() => last12Months().slice(-6), []);
  const evolution = mois6.map((m) => {
    const dep = totalMontant(depensesSecteur.filter((d) => { const dt = new Date(d.date); return dt.getFullYear() === m.annee && dt.getMonth() === m.mois; }));
    const rec = totalMontant(recettesSecteur.filter((r) => { const dt = new Date(r.date); return dt.getFullYear() === m.annee && dt.getMonth() === m.mois; }));
    return { nom: m.label, Dépenses: dep, Recettes: rec };
  });

  const totalDep6 = evolution.reduce((s, m) => s + m.Dépenses, 0);
  const totalRec6 = evolution.reduce((s, m) => s + m.Recettes, 0);
  const solde6 = totalRec6 - totalDep6;

  const parCategorie = useMemo(() => {
    const map = {};
    for (const d of depensesSecteur) map[d.categorie] = (map[d.categorie] || 0) + d.montant;
    return Object.entries(map).map(([nom, montant]) => ({ nom, montant })).sort((a, b) => b.montant - a.montant).slice(0, 6);
  }, [depensesSecteur]);
  const maxCategorie = Math.max(1, ...parCategorie.map((c) => c.montant));

  return (
    <div>
      <TopBarSimple title="Analyses" subtitle={`${config.nom} : pilotage financier (6 derniers mois)`} icon={PieChart} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        <StatTile icon={PieChart} label="Dépenses (6 mois)" value={fmtCompact(totalDep6) + " FCFA"} tone="#FF453A" />
        <StatTile icon={PieChart} label="Recettes (6 mois)" value={fmtCompact(totalRec6) + " FCFA"} tone="#30D158" />
        <StatTile icon={PieChart} label="Solde net" value={fmtCompact(solde6) + " FCFA"} tone={solde6 >= 0 ? "#30D158" : "#FF453A"} />
        <StatTile icon={PieChart} label="Transactions" value={String(depensesSecteur.length + recettesSecteur.length)} tone={config.color} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2 p-6" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-0.5">Dépenses vs recettes</h3>
          <p className="text-[12.5px] text-ink-soft font-medium mb-3">Évolution sur les 6 derniers mois</p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolution}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="nom" tick={{ fontSize: 11, fill: "#3c4048", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#3c4048" }} axisLine={false} tickLine={false} width={40} tickFormatter={fmtCompact} />
                <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.9)", fontSize: 12.5 }} formatter={(v) => fmtFCFA(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Dépenses" fill="#FF453A" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Recettes" fill="#30D158" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-0.5">Top catégories de dépenses</h3>
          <p className="text-[12.5px] text-ink-soft font-medium mb-4">Toutes périodes confondues</p>
          {parCategorie.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucune dépense enregistrée.</p>}
          <div className="flex flex-col gap-3">
            {parCategorie.map((c) => (
              <div key={c.nom}>
                <div className="flex items-center justify-between text-[12.5px] mb-1">
                  <span className="font-semibold text-ink truncate">{c.nom}</span>
                  <span className="text-ink-soft tabular font-semibold">{fmtCompact(c.montant)} FCFA</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(c.montant / maxCategorie) * 100}%`, background: config.color }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
