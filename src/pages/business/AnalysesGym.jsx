import { useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import ProgressRing from "../../components/ui/ProgressRing";
import { useDataStore } from "../../store/dataStore";
import { useGymStore, NIVEAUX_FORFAIT, niveauLabel } from "../../store/gymStore";
import { fmtFCFA, fmtCompact, totalMontant } from "../../lib/logic";

// Pilotage & Analyses — volet spécifique à MAXI GYM : répartition des
// revenus (séances vs abonnements), des clients par forfait, et taux de
// clients actifs — calculé à partir des recettes déjà saisies (Prestations)
// et des fiches clients (Clients / Clients partenaires), sans nouvelle table.
export default function AnalysesGym() {
  const config = useOutletContext();
  const { recettes } = useDataStore();
  const { clients, chargerClients } = useGymStore();

  useEffect(() => { chargerClients(config.secteurId); }, [config.secteurId]);

  const recettesSecteur = useMemo(() => recettes.filter((r) => r.secteurId === config.secteurId), [recettes, config.secteurId]);
  const revenuSeances = totalMontant(recettesSecteur.filter((r) => r.origine.startsWith("Séance")));
  const revenuAbonnements = totalMontant(recettesSecteur.filter((r) => r.origine.startsWith("Abonnement")));
  const revenuTotal = revenuSeances + revenuAbonnements;

  const totalClients = clients.length;
  const clientsActifs = clients.filter((c) => c.actif).length;
  const tauxActif = totalClients > 0 ? clientsActifs / totalClients : 0;

  const parForfait = NIVEAUX_FORFAIT.map((n) => ({
    nom: n.label,
    clients: clients.filter((c) => c.forfaitNiveau === n.id && c.actif).length,
  }));

  return (
    <div>
      <TopBarSimple title="Pilotage & Analyses" subtitle={`${config.nom} : revenus et clientèle`} icon={BarChart3} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        <StatTile icon={BarChart3} label="Revenu séances" value={fmtCompact(revenuSeances) + " FCFA"} tone={config.color} />
        <StatTile icon={BarChart3} label="Revenu abonnements" value={fmtCompact(revenuAbonnements) + " FCFA"} tone="#8E8E93" />
        <StatTile icon={BarChart3} label="Revenu total" value={fmtCompact(revenuTotal) + " FCFA"} tone="#30D158" />
        <StatTile icon={BarChart3} label="Clients actifs" value={String(clientsActifs)} tone="#5E5CE6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2 p-6" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-0.5">Clients actifs par forfait</h3>
          <p className="text-[12.5px] text-ink-soft font-medium mb-3">Répartition Simple / Classique / VIP</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parForfait}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="nom" tick={{ fontSize: 11, fill: "#3c4048", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#3c4048" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.9)", fontSize: 12.5 }} />
                <Bar dataKey="clients" name="Clients actifs" radius={[8, 8, 0, 0]}>
                  {parForfait.map((_, i) => <Cell key={i} fill={config.color} fillOpacity={1 - i * 0.25} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col items-center justify-center gap-3" hover={false}>
          <p className="text-[12.5px] font-semibold text-ink-soft text-center">Taux de clients actifs</p>
          <ProgressRing value={tauxActif} color={config.color} size={116} />
          <p className="text-[11.5px] text-ink-soft text-center">{clientsActifs} / {totalClients} fiches</p>
        </GlassCard>
      </div>
    </div>
  );
}
