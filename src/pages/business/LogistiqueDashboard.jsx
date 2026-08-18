import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { TrendingUp, TrendingDown, Wallet, PackageCheck, Gauge, AlertTriangle, Boxes } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { useStockStore } from "../../store/stockStore";
import { useDataStore } from "../../store/dataStore";
import { CAT_MATERIEL, TYPES_MOUVEMENT_MATERIEL } from "../../data/stockData";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const PRESETS = [
  { v: "mois", label: "Mois en cours" },
  { v: "7", label: "Hebdomadaire (7 jours)" },
  { v: "30", label: "30 derniers jours" },
  { v: "90", label: "90 derniers jours" },
  { v: "365", label: "Cette année (1 an)" },
  { v: "custom", label: "Plage personnalisée…" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const fmtNum = (n) => Math.round(n || 0).toLocaleString("fr-FR");
const fmtMoney = (n) => Math.round(n || 0).toLocaleString("fr-FR") + " FCFA";
const fmtDateShort = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

// Analyses MAXI LOGISTIQUE — rentabilité du parc locatif : CA généré par
// article, taux d'utilisation, pertes cumulées. À la demande explicite de
// l'utilisateur (2026-08-18), sur le même principe que le Dashboard MAXI
// AGRO (période + détail cliquable par article).
//
// Le taux d'utilisation est une approximation documentée : (jours-unités
// loués sur la période) / (stock actuel de l'article × jours de la
// période). Le stock actuel sert de proxy pour le parc total car ce projet
// ne conserve pas d'historique de quantité possédée à une date donnée.
export default function LogistiqueDashboard() {
  const config = useOutletContext();
  const { referentielMateriel, mouvementsMateriel, stockArticle } = useStockStore();
  const { recettes } = useDataStore();

  const [preset, setPreset] = useState("mois");
  const [from, setFrom] = useState(todayStr().slice(0, 7) + "-01");
  const [to, setTo] = useState(todayStr());
  const [scope, setScope] = useState("");
  const [articleDetailId, setArticleDetailId] = useState(null);

  const { start, end } = useMemo(() => {
    if (preset === "mois") return { start: todayStr().slice(0, 7) + "-01", end: todayStr() };
    if (preset === "custom") return { start: from, end: to };
    return { start: addDays(todayStr(), -parseInt(preset)), end: todayStr() };
  }, [preset, from, to]);
  const nbJours = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);

  const { prevStart, prevEnd } = useMemo(() => {
    const pEnd = addDays(start, -1);
    return { prevStart: addDays(pEnd, -(nbJours - 1)), prevEnd: pEnd };
  }, [start, nbJours]);

  const cats = useMemo(
    () => CAT_MATERIEL.filter((c) => referentielMateriel.some((a) => a.cat === c)),
    [referentielMateriel]
  );
  const articlesScope = useMemo(
    () => (scope ? referentielMateriel.filter((a) => a.cat === scope) : referentielMateriel),
    [referentielMateriel, scope]
  );
  const articleIds = useMemo(() => new Set(articlesScope.map((a) => a.id)), [articlesScope]);

  // Recettes de type Location uniquement (articleId renseigné) — les autres
  // prestations (transport, etc.) ne concernent pas un article du parc.
  const locationsPeriode = useMemo(
    () => recettes.filter((r) => r.secteurId === config.secteurId && r.articleId && articleIds.has(r.articleId) && r.date >= start && r.date <= end),
    [recettes, config.secteurId, articleIds, start, end]
  );
  const locationsPrec = useMemo(
    () => recettes.filter((r) => r.secteurId === config.secteurId && r.articleId && articleIds.has(r.articleId) && r.date >= prevStart && r.date <= prevEnd),
    [recettes, config.secteurId, articleIds, prevStart, prevEnd]
  );

  const ca = locationsPeriode.reduce((s, r) => s + r.montant, 0);
  const caPrec = locationsPrec.reduce((s, r) => s + r.montant, 0);
  const joursUnitesLoues = locationsPeriode.reduce((s, r) => s + (r.quantite || 0) * (r.jours || 0), 0);
  const parcTotal = articlesScope.reduce((s, a) => s + stockArticle(a.id), 0);
  const tauxUtilisation = parcTotal > 0 ? (joursUnitesLoues / (parcTotal * nbJours)) * 100 : 0;

  const mvtPeriode = useMemo(
    () => mouvementsMateriel.filter((m) => articleIds.has(m.articleId) && m.date >= start && m.date <= end),
    [mouvementsMateriel, articleIds, start, end]
  );
  const valeurPertes = mvtPeriode
    .filter((m) => m.type === "retour_casse" || m.type === "retour_perdu")
    .reduce((s, m) => s + m.quantite * (referentielMateriel.find((a) => a.id === m.articleId)?.coutAchat || 0), 0);

  // CA locatif par article (période) — pour le tableau + le bar chart.
  const parArticle = useMemo(() => {
    return articlesScope.map((a) => {
      const locs = locationsPeriode.filter((r) => r.articleId === a.id);
      const caArticle = locs.reduce((s, r) => s + r.montant, 0);
      const joursUnites = locs.reduce((s, r) => s + (r.quantite || 0) * (r.jours || 0), 0);
      const stock = stockArticle(a.id);
      const taux = stock > 0 ? (joursUnites / (stock * nbJours)) * 100 : 0;
      return { ...a, stock, caArticle, joursUnites, taux, nbLocations: locs.length };
    }).sort((a, b) => b.caArticle - a.caArticle);
  }, [articlesScope, locationsPeriode, stockArticle, nbJours]);

  const topArticles = parArticle.filter((a) => a.caArticle > 0).slice(0, 8);
  const caChartData = {
    labels: topArticles.map((a) => a.nom),
    datasets: [{ label: "CA locatif (FCFA)", data: topArticles.map((a) => a.caArticle), backgroundColor: config.color, borderRadius: 6 }],
  };

  // Évolution du CA locatif dans le temps (bucket jour, ou mois si > 62j).
  const evolutionChart = useMemo(() => {
    const parMois = nbJours > 62;
    const cle = (d) => (parMois ? d.slice(0, 7) : d);
    const acc = {};
    locationsPeriode.forEach((r) => { const k = cle(r.date); acc[k] = (acc[k] || 0) + r.montant; });
    const cles = Object.keys(acc).sort();
    return {
      vide: !cles.length,
      data: {
        labels: cles.map((k) => (parMois ? `${k.slice(5, 7)}/${k.slice(2, 4)}` : k.slice(5))),
        datasets: [{ label: "CA locatif", data: cles.map((k) => acc[k]), borderColor: config.color, backgroundColor: `${config.color}1f`, fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 }],
      },
    };
  }, [locationsPeriode, nbJours, config.color]);

  const articleDetail = parArticle.find((a) => a.id === articleDetailId) || null;
  const articleDetailLocations = useMemo(
    () => locationsPeriode.filter((r) => r.articleId === articleDetailId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [locationsPeriode, articleDetailId]
  );
  const articleDetailMvt = useMemo(
    () => mvtPeriode.filter((m) => m.articleId === articleDetailId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [mvtPeriode, articleDetailId]
  );

  return (
    <div className="space-y-5">
      <TopBarSimple title="Analyses" subtitle={`${config.nom} — rentabilité locative, utilisation du parc, pertes`} icon={Gauge} accent={config.color} showPeriodeFilter={false} />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Période</label>
          <select className="glass rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold text-ink outline-none" value={preset} onChange={(e) => setPreset(e.target.value)}>
            {PRESETS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
          </select>
        </div>
        {preset === "custom" && (
          <div className="flex items-end gap-2">
            <div><label className="mb-1 block text-[11px] font-semibold text-ink-soft">Du</label><input type="date" className="glass rounded-2xl px-3 py-2 text-[13px] outline-none" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="mb-1 block text-[11px] font-semibold text-ink-soft">Au</label><input type="date" className="glass rounded-2xl px-3 py-2 text-[13px] outline-none" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        )}
        <span className="ml-auto text-[11px] text-ink-soft/70">{fmtDateShort(start)} → {fmtDateShort(end)} · {nbJours} jour(s)</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <ScopeTab active={!scope} color={config.color} onClick={() => setScope("")}>Toutes</ScopeTab>
        {cats.map((c) => <ScopeTab key={c} active={scope === c} color={config.color} onClick={() => setScope(c)}>{c}</ScopeTab>)}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <Indic title="CA locatif" value={fmtMoney(ca)} icon={Wallet} color={config.color} sub={`${locationsPeriode.length} location(s)`} delta={ca - caPrec} money />
        <Indic title="Taux d'utilisation" value={`${tauxUtilisation.toFixed(1)} %`} icon={Gauge} color="#0d9488" sub={`${fmtNum(joursUnitesLoues)} jour(s)-unité(s) loué(s)`} />
        <Indic title="Parc disponible" value={fmtNum(parcTotal)} icon={Boxes} color="#2563eb" sub={`${articlesScope.length} article(s)`} />
        <Indic title="Pertes (casse/perdu)" value={fmtMoney(valeurPertes)} icon={AlertTriangle} color={valeurPertes > 0 ? "#dc2626" : "#8E8E93"} sub="Valeur au coût d'achat" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard hover={false} className="p-4 lg:col-span-2">
          <p className="font-bold tracking-tight text-ink mb-2">CA locatif par article {scope ? `— ${scope}` : ""}</p>
          <div className="h-64">
            {topArticles.length
              ? <Bar data={caChartData} options={{ maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { callback: (v) => fmtNum(v) } } } }} />
              : <p className="py-16 text-center text-[13px] text-ink-soft/60">Aucune location facturée sur la période.</p>}
          </div>
        </GlassCard>
        <GlassCard hover={false} className="p-4">
          <p className="font-bold tracking-tight text-ink mb-2">Évolution du CA locatif</p>
          <div className="h-64">
            {!evolutionChart.vide
              ? <Line data={evolutionChart.data} options={{ maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => fmtNum(v) } } } }} />
              : <p className="py-16 text-center text-[13px] text-ink-soft/60">Rien à tracer sur la période.</p>}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <p className="font-bold tracking-tight text-ink px-3 pt-3 mb-1">Détail par article {scope ? `— ${scope}` : ""}</p>
        <p className="px-3 pb-2 text-[11px] text-ink-soft/60">Cliquez un article pour son détail complet sur la période.</p>
        {parArticle.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-soft/60">Aucun article.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-left text-[11px] font-bold text-ink-soft/70 uppercase tracking-wide">
                  <th className="px-3 py-2">Article</th>
                  <th className="px-2 py-2 text-center">Stock</th>
                  <th className="px-2 py-2 text-center">Locations</th>
                  <th className="px-2 py-2 text-center">Jours-unités loués</th>
                  <th className="px-2 py-2 text-center">Taux d'utilisation</th>
                  <th className="px-2 py-2 text-right">CA généré</th>
                </tr>
              </thead>
              <tbody>
                {parArticle.map((a) => (
                  <tr key={a.id} onClick={() => setArticleDetailId(a.id)} className="text-[13px] hover:bg-white/50 transition-colors cursor-pointer">
                    <td className="px-3 py-1.5 font-semibold text-ink">{a.nom}</td>
                    <td className="px-2 py-1.5 text-center tabular">{a.stock}</td>
                    <td className="px-2 py-1.5 text-center tabular">{a.nbLocations}</td>
                    <td className="px-2 py-1.5 text-center tabular">{fmtNum(a.joursUnites)}</td>
                    <td className="px-2 py-1.5 text-center tabular">{a.taux.toFixed(1)} %</td>
                    <td className="px-2 py-1.5 text-right tabular font-bold" style={{ color: config.color }}>{a.caArticle > 0 ? fmtMoney(a.caArticle) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <Modal open={!!articleDetail} onClose={() => setArticleDetailId(null)} title={articleDetail?.nom || ""} icon={PackageCheck} accent={config.color} moduleLabel={config.nom} footer={<Button variant="ghost" onClick={() => setArticleDetailId(null)}>Fermer</Button>}>
        {articleDetail && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Stock actuel" value={fmtNum(articleDetail.stock)} color="#2563eb" />
              <MiniStat label="CA généré" value={fmtMoney(articleDetail.caArticle)} color={config.color} />
              <MiniStat label="Taux d'utilisation" value={`${articleDetail.taux.toFixed(1)} %`} color="#0d9488" />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase text-ink-soft/70">Locations sur la période ({articleDetailLocations.length})</p>
              <DetailTable
                rows={articleDetailLocations}
                cols={["Date", "Client", "Qté", "Jours", "Montant"]}
                render={(r) => [fmtDateShort(r.date), r.client || "—", r.quantite, r.jours, fmtMoney(r.montant)]}
                empty="Aucune location sur la période."
              />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase text-ink-soft/70">Mouvements de stock sur la période ({articleDetailMvt.length})</p>
              <DetailTable
                rows={articleDetailMvt}
                cols={["Date", "Type", "Qté", "Motif", "Agent"]}
                render={(m) => [fmtDateShort(m.date), TYPES_MOUVEMENT_MATERIEL[m.type]?.label || m.type, m.quantite, m.motif || "—", m.agentNom || "—"]}
                empty="Aucun mouvement sur la période."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ScopeTab({ active, color, onClick, children }) {
  return (
    <button onClick={onClick} className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors"
      style={active ? { background: color, color: "#fff" } : { background: "#f1f5f9", color: "#475569" }}>
      {children}
    </button>
  );
}

function Indic(props) {
  const { title, value, color, sub, delta, money } = props;
  const Icon = props.icon;
  const favorable = delta > 0;
  return (
    <GlassCard hover={false} className="p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink-soft/70">{title}</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: color + "1a", color }}><Icon size={14} /></span>
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-lg font-extrabold" style={{ color }}>{value}</p>
        {delta !== undefined && delta !== 0 && (
          <span className={`text-[11px] font-bold ${favorable ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
            {delta > 0 ? <TrendingUp size={11} className="inline" /> : <TrendingDown size={11} className="inline" />}
            {money ? fmtMoney(Math.abs(delta)) : Math.abs(delta)}
          </span>
        )}
      </div>
      {sub && <p className="mt-0.5 text-[10.5px] text-ink-soft/60">{sub}</p>}
    </GlassCard>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="rounded-2xl bg-black/[0.03] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft/70">{label}</p>
      <p className="text-[15px] font-extrabold" style={{ color }}>{value}</p>
    </div>
  );
}

function DetailTable({ rows, cols, render, empty }) {
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-ink-soft/60">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white/60">
      <table className="w-full text-[13px]">
        <thead className="text-[11px] uppercase text-ink-soft/70"><tr>{cols.map((c) => <th key={c} className="px-3 py-2 text-left">{c}</th>)}</tr></thead>
        <tbody className="divide-y divide-black/5">
          {rows.map((r, i) => (
            <tr key={i}>{render(r).map((cell, j) => <td key={j} className="px-3 py-1.5">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
