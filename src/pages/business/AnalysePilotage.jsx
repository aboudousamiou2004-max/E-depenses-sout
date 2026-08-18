import { useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { BarChart3, Users, Coins, AlertTriangle, UserPlus } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import { useGarderieStore } from "../../store/garderieStore";
import { GROUPES_AGE, PROGRAMMES_ENFANT, programmeDuGroupe } from "../../data/garderieData";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const GROUPE_COLORS = ["#2563eb", "#0d9488", "#16a34a", "#d97706", "#7c3aed"];
const fmtMoney = (n) => Math.round(n || 0).toLocaleString("fr-FR") + " FCFA";
const moisCourant = () => new Date().toISOString().slice(0, 7);

function derniersMois(n) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
function labelMois(m) {
  const [a, mo] = m.split("-");
  const noms = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
  return `${noms[Number(mo) - 1]} ${a.slice(2)}`;
}

// Analyse & Pilotage E-GARDERIE — effectifs par groupe/programme, revenu
// mensuel, impayés, à la demande explicite de l'utilisateur (2026-08-18).
// Même principe que les Dashboards MAXI AGRO / MAXI LOGISTIQUE : pas de
// nouvelle table, tout dérivé de garderieStore (enfants + paiements).
export default function AnalysePilotage() {
  const config = useOutletContext();
  const { enfants, paiements, chargerGarderie } = useGarderieStore();

  useEffect(() => { chargerGarderie(); }, [chargerGarderie]);

  const actifs = useMemo(() => enfants.filter((e) => e.statut === "actif"), [enfants]);
  const paiementsMois = paiements.filter((p) => p.mois === moisCourant());
  const revenuMois = paiementsMois.reduce((s, p) => s + p.montant, 0);
  const nouveauxCeMois = actifs.filter((e) => (e.dateInscription || "").slice(0, 7) === moisCourant()).length;

  const soldeEnfantMois = (enfantId, mois) => paiements.filter((p) => p.enfantId === enfantId && p.mois === mois).reduce((s, p) => s + p.montant, 0);
  const montantDuTotal = (e) => e.tarif + (e.fraisCantine || 0);
  const impayes = useMemo(() => {
    return actifs
      .filter((e) => e.typeAbonnement === "mensuel")
      .map((e) => ({ ...e, du: montantDuTotal(e), paye: soldeEnfantMois(e.id, moisCourant()) }))
      .filter((e) => e.du > 0 && e.paye < e.du)
      .sort((a, b) => (b.du - b.paye) - (a.du - a.paye));
  }, [actifs, paiements]); // eslint-disable-line react-hooks/exhaustive-deps

  const mois6 = derniersMois(6);
  const revenuChart = {
    labels: mois6.map(labelMois),
    datasets: [{
      label: "Revenu",
      data: mois6.map((m) => paiements.filter((p) => p.mois === m).reduce((s, p) => s + p.montant, 0)),
      backgroundColor: config.color, borderRadius: 6,
    }],
  };

  const parGroupe = GROUPES_AGE.map((g, i) => ({ ...g, color: GROUPE_COLORS[i % GROUPE_COLORS.length], total: actifs.filter((e) => e.groupe === g.id).length })).filter((g) => g.total > 0);
  const groupeChart = { labels: parGroupe.map((g) => g.label), datasets: [{ data: parGroupe.map((g) => g.total), backgroundColor: parGroupe.map((g) => g.color) }] };

  const parProgramme = PROGRAMMES_ENFANT.map((p) => ({ ...p, total: actifs.filter((e) => (e.programme || programmeDuGroupe(e.groupe)) === p.id).length }));

  return (
    <div className="space-y-5">
      <TopBarSimple title="Analyse & Pilotage" subtitle={`${config.nom} — effectifs, revenu, impayés`} icon={BarChart3} accent={config.color} showPeriodeFilter={false} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Users} label="Enfants actifs" value={String(actifs.length)} tone={config.color} />
        <StatTile icon={Coins} label="Revenu du mois" value={fmtMoney(revenuMois)} tone="#30D158" />
        <StatTile icon={AlertTriangle} label="Impayés ce mois" value={String(impayes.length)} tone={impayes.length ? "#FF453A" : "#8E8E93"} />
        <StatTile icon={UserPlus} label="Nouveaux ce mois" value={String(nouveauxCeMois)} tone="#0d9488" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard hover={false} className="p-4">
          <p className="font-bold tracking-tight text-ink mb-2">Revenu mensuel (6 derniers mois)</p>
          <div className="h-64">
            <Bar data={revenuChart} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => Math.round(v / 1000) + "k" } } } }} />
          </div>
        </GlassCard>
        <GlassCard hover={false} className="p-4">
          <p className="font-bold tracking-tight text-ink mb-2">Répartition par groupe d'âge</p>
          <div className="h-64">
            {parGroupe.length ? (
              <Doughnut data={groupeChart} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } } } }} />
            ) : <p className="py-16 text-center text-[13px] text-ink-soft/60">Aucun enfant actif.</p>}
          </div>
          <div className="flex justify-center gap-4 mt-2 text-[12px] text-ink-soft">
            {parProgramme.map((p) => <span key={p.id}>{p.label} : <strong className="text-ink">{p.total}</strong></span>)}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <p className="font-bold tracking-tight text-ink px-3 pt-3 mb-1">Impayés du mois</p>
        {impayes.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-soft/60">Aucun impayé ce mois-ci.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr className="text-left text-[11px] font-bold text-ink-soft/70 uppercase tracking-wide">
                  <th className="px-3 py-2">Enfant</th>
                  <th className="px-2 py-2 text-right">Dû</th>
                  <th className="px-2 py-2 text-right">Payé</th>
                  <th className="px-2 py-2 text-right">Reste</th>
                </tr>
              </thead>
              <tbody>
                {impayes.map((e) => (
                  <tr key={e.id} className="text-[13px]">
                    <td className="px-3 py-2 font-semibold text-ink">{e.nom} {e.prenom}</td>
                    <td className="px-2 py-2 text-right tabular text-ink-soft">{fmtMoney(e.du)}</td>
                    <td className="px-2 py-2 text-right tabular text-ink-soft">{fmtMoney(e.paye)}</td>
                    <td className="px-2 py-2 text-right tabular font-bold text-[#dc2626]">{fmtMoney(e.du - e.paye)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
