import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";
import { TrendingUp, TrendingDown, Boxes, HeartPulse, Skull, Stethoscope, Sprout, ShoppingCart, Wallet, Egg, HeartCrack, Tag, Plus, LayoutGrid, Syringe, Search } from "lucide-react";
import GlassCard from "../../components/ui/GlassCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useStockStore, CAT_ANIMAUX_IDENTIFIES } from "../../store/stockStore";
import { useSanteStore } from "../../store/santeStore";
import { useDataStore } from "../../store/dataStore";
import { CAT_ANIMAUX } from "../../data/stockData";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const PRESETS = [
  { v: "mois", label: "Mois en cours" },
  { v: "journalier", label: "Journalier (aujourd'hui)" },
  { v: "7", label: "Hebdomadaire (7 jours)" },
  { v: "30", label: "30 derniers jours" },
  { v: "90", label: "90 derniers jours" },
  { v: "180", label: "180 derniers jours" },
  { v: "365", label: "Cette année (1 an)" },
  { v: "custom", label: "Plage personnalisée…" },
];
const TOUTES = "__TOUTES__";
const CAT_COLORS = { OVINS: "#0d9488", BOVINS: "#7c3aed", CAPRINS: "#ea580c", POULETS: "#ca8a04", PINTADES: "#0284c7", CANARDS: "#0891b2", DINDONS: "#dc2626" };
const SERIE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0d9488", "#db2777", "#4338ca"];
const catColor = (c) => CAT_COLORS[c] || "#64748b";
const serieColor = (i) => SERIE_COLORS[i % SERIE_COLORS.length];

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const fmtNum = (n) => Math.round(n || 0).toLocaleString("fr-FR");
const fmtMoney = (n) => Math.round(n || 0).toLocaleString("fr-FR") + " FCFA";
const fmtDateShort = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

// Régression linéaire + moyenne mobile (60/40) — porté tel quel depuis
// termitiere-platform/src/modules/agro/logic.js (previsionSerie).
function previsionSerie(values, horizon = 7) {
  const ys = (values || []).map((v) => Number(v) || 0);
  const n = ys.length;
  if (n === 0) return [];
  if (n === 1) return new Array(horizon).fill(Math.max(0, ys[0]));
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  ys.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
  const denom = n * sxx - sx * sx;
  const b = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const a = (sy - b * sx) / n;
  const k = Math.min(3, n);
  const ma = ys.slice(n - k).reduce((s, y) => s + y, 0) / k;
  const out = [];
  for (let h = 1; h <= horizon; h++) {
    const x = n - 1 + h;
    const lin = a + b * x;
    out.push(Math.max(0, 0.6 * lin + 0.4 * ma));
  }
  return out;
}

// Dashboard MAXI AGRO — porté fidèlement depuis
// termitiere-platform/src/modules/agro/Dashboard.jsx (indicateurs +
// graphiques), à la demande explicite de l'utilisateur (2026-08-18).
//
// Deux adaptations documentées, imposées par les différences de modèle de
// données avec ce projet :
// 1. « Effectif de base » (dénominateur des taux de mortalité/croissance) =
//    effectif au DÉBUT de la période sélectionnée, calculé sur le journal de
//    mouvements. La version termitiere-platform utilise l'EF Initial du
//    dernier inventaire enregistré (pas forcément celui du début de
//    période) — ce projet retient l'interprétation la plus intuitive pour
//    un taux « sur la période ».
// 2. Chiffre d'affaires = total des recettes du secteur sur la période,
//    TOUS TYPES CONFONDUS — ce projet n'a pas de facture détaillée par
//    ligne/catégorie comme termitiere-platform (`agro_factures`), donc le CA
//    n'est calculable que pour le périmètre « Toutes » (affiché « — » sur
//    une catégorie précise, avec une note).
export default function AgroDashboard() {
  const { referentielAnimaux: especes, mouvementsAnimaux, maladesAnimaux, soldeAnimaux, animauxIndividuels } = useStockStore();
  const { recettes } = useDataStore();

  const [mode, setMode] = useState("dashboard"); // 'dashboard' | 'especes'
  const [preset, setPreset] = useState("mois");
  const [from, setFrom] = useState(todayStr().slice(0, 7) + "-01");
  const [to, setTo] = useState(todayStr());
  const [scope, setScope] = useState(TOUTES);
  const [modalKey, setModalKey] = useState(null);

  const { start, end } = useMemo(() => {
    if (preset === "mois") return { start: todayStr().slice(0, 7) + "-01", end: todayStr() };
    if (preset === "journalier") return { start: todayStr(), end: todayStr() };
    if (preset === "custom") return { start: from, end: to };
    return { start: addDays(todayStr(), -parseInt(preset)), end: todayStr() };
  }, [preset, from, to]);

  const cats = useMemo(() => {
    const custom = [...new Set(especes.map((e) => e.cat))].filter((c) => !CAT_ANIMAUX.includes(c));
    return [...CAT_ANIMAUX, ...custom].filter((c) => especes.some((e) => e.cat === c));
  }, [especes]);

  const especesScope = useMemo(() => (scope === TOUTES ? especes : especes.filter((e) => e.cat === scope)), [especes, scope]);
  const especeIds = useMemo(() => new Set(especesScope.map((e) => e.id)), [especesScope]);

  const mvtPeriode = useMemo(() => mouvementsAnimaux.filter((m) => especeIds.has(m.especeId) && m.date >= start && m.date <= end), [mouvementsAnimaux, especeIds, start, end]);

  // Effectif d'une espèce à une date donnée (inclus) — solde du journal.
  const effectifAuJour = (especeId, date) => {
    const init = especes.find((e) => e.id === especeId)?.initQuantite || 0;
    return Math.max(0, init + mouvementsAnimaux.filter((m) => m.especeId === especeId && m.date <= date).reduce((s, m) => s + m.quantite, 0));
  };
  const effectifScopeAuJour = (date) => especesScope.reduce((s, e) => s + effectifAuJour(e.id, date), 0);

  const effectifActuel = useMemo(() => especesScope.reduce((s, e) => s + (soldeAnimaux[e.id] || 0), 0), [especesScope, soldeAnimaux]);
  const effectifBase = useMemo(() => effectifScopeAuJour(addDays(start, -1)), [especesScope, mouvementsAnimaux, start]); // eslint-disable-line react-hooks/exhaustive-deps

  // Malades : dernier décompte connu par espèce, à la fin de la période.
  const maladesTotal = useMemo(() => {
    return especesScope.reduce((s, e) => {
      const entries = maladesAnimaux.filter((m) => m.especeId === e.id && m.date <= end).sort((a, b) => (a.date < b.date ? 1 : -1));
      return s + (entries[0]?.quantite || 0);
    }, 0);
  }, [especesScope, maladesAnimaux, end]);

  const naiss = useMemo(() => mvtPeriode.filter((m) => m.type === "naissance").reduce((s, m) => s + m.quantite, 0), [mvtPeriode]);
  const dec = useMemo(() => Math.abs(mvtPeriode.filter((m) => m.type === "deces").reduce((s, m) => s + m.quantite, 0)), [mvtPeriode]);
  const venduVolume = useMemo(() => Math.abs(mvtPeriode.filter((m) => m.type === "vente").reduce((s, m) => s + m.quantite, 0)), [mvtPeriode]);

  const casMaladie = maladesTotal + dec;
  const ind = {
    effectif: effectifActuel, base: effectifBase, malades: maladesTotal, naiss, dec, casMaladie,
    mortalite: effectifBase ? (dec / effectifBase) * 100 : 0,
    letalite: casMaladie ? (dec / casMaladie) * 100 : 0,
    croissance: effectifBase ? ((naiss - dec) / effectifBase) * 100 : 0,
    morbidite: effectifActuel ? (maladesTotal / effectifActuel) * 100 : 0,
  };

  // Période précédente (même durée) — pour les évolutions.
  const { prevStart, prevEnd } = useMemo(() => {
    const nbDays = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
    const pEnd = addDays(start, -1);
    return { prevStart: addDays(pEnd, -(nbDays - 1)), prevEnd: pEnd };
  }, [start, end]);
  const mvtPrec = useMemo(() => mouvementsAnimaux.filter((m) => especeIds.has(m.especeId) && m.date >= prevStart && m.date <= prevEnd), [mouvementsAnimaux, especeIds, prevStart, prevEnd]);
  const indPrec = {
    naiss: mvtPrec.filter((m) => m.type === "naissance").reduce((s, m) => s + m.quantite, 0),
    dec: Math.abs(mvtPrec.filter((m) => m.type === "deces").reduce((s, m) => s + m.quantite, 0)),
    ventes: Math.abs(mvtPrec.filter((m) => m.type === "vente").reduce((s, m) => s + m.quantite, 0)),
  };

  // Chiffre d'affaires (recettes du secteur agro) — uniquement pour « Toutes ».
  const ca = useMemo(() => {
    const inSecteur = recettes.filter((r) => r.secteurId === "agro");
    const sumIn = (s, e) => inSecteur.filter((r) => r.date >= s && r.date <= e).reduce((acc, r) => acc + (r.montant || 0), 0);
    return { courant: sumIn(start, end), precedent: sumIn(prevStart, prevEnd), liste: inSecteur.filter((r) => r.date >= start && r.date <= end).sort((a, b) => (a.date < b.date ? 1 : -1)) };
  }, [recettes, start, end, prevStart, prevEnd]);

  // Détails décès / naissances / ventes (scope, période) — pour les modales.
  const decesDetail = useMemo(() => mvtPeriode.filter((m) => m.type === "deces").map((m) => ({ date: m.date, espece: especes.find((e) => e.id === m.especeId)?.nom, qte: Math.abs(m.quantite), motif: m.motif || "—", agent: m.agentNom })).sort((a, b) => (a.date < b.date ? 1 : -1)), [mvtPeriode, especes]);
  const naissancesDetail = useMemo(() => mvtPeriode.filter((m) => m.type === "naissance").map((m) => ({ date: m.date, espece: especes.find((e) => e.id === m.especeId)?.nom, qte: m.quantite, agent: m.agentNom })).sort((a, b) => (a.date < b.date ? 1 : -1)), [mvtPeriode, especes]);
  const ventesDetail = useMemo(() => mvtPeriode.filter((m) => m.type === "vente").map((m) => ({ date: m.date, espece: especes.find((e) => e.id === m.especeId)?.nom, qte: Math.abs(m.quantite), motif: m.motif || "—" })).sort((a, b) => (a.date < b.date ? 1 : -1)), [mvtPeriode, especes]);

  // Répartition (effectif actuel) — par catégorie (Toutes) ou par espèce.
  const repartition = useMemo(() => {
    if (scope === TOUTES) {
      const rows = cats.map((c) => ({ label: c, color: catColor(c), total: especes.filter((e) => e.cat === c).reduce((s, e) => s + (soldeAnimaux[e.id] || 0), 0) }));
      return { parEspece: false, rows };
    }
    const rows = especesScope.map((e, i) => ({ label: e.nom, color: serieColor(i), total: soldeAnimaux[e.id] || 0 }));
    return { parEspece: true, rows };
  }, [scope, cats, especes, especesScope, soldeAnimaux]);
  const repartitionData = { labels: repartition.rows.map((r) => r.label), datasets: [{ data: repartition.rows.map((r) => r.total), backgroundColor: repartition.rows.map((r) => r.color) }] };

  // Naissances · Décès · Ventes au fil de la période (bucket jour, ou mois si > 62j).
  const ndvChart = useMemo(() => {
    const spanJours = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    const parMois = spanJours > 62;
    const cle = (d) => (parMois ? d.slice(0, 7) : d);
    const acc = {};
    const bucket = (d) => { const k = cle(d); if (!acc[k]) acc[k] = { naiss: 0, dec: 0, ventes: 0 }; return acc[k]; };
    mvtPeriode.forEach((m) => {
      if (m.type === "naissance") bucket(m.date).naiss += m.quantite;
      else if (m.type === "deces") bucket(m.date).dec += Math.abs(m.quantite);
      else if (m.type === "vente") bucket(m.date).ventes += Math.abs(m.quantite);
    });
    const cles = Object.keys(acc).sort();
    const labels = cles.map((k) => (parMois ? `${k.slice(5, 7)}/${k.slice(2, 4)}` : k.slice(5)));
    return {
      vide: !cles.length,
      data: {
        labels,
        datasets: [
          { type: "bar", label: "Naissances", data: cles.map((k) => acc[k].naiss), backgroundColor: "#16a34a", borderRadius: 4, yAxisID: "y" },
          { type: "bar", label: "Décès", data: cles.map((k) => acc[k].dec), backgroundColor: "#dc2626", borderRadius: 4, yAxisID: "y" },
          { type: "line", label: "Ventes (volume)", data: cles.map((k) => acc[k].ventes), borderColor: "#0d9488", backgroundColor: "rgba(13,148,136,0.12)", fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2, yAxisID: "y1" },
        ],
      },
    };
  }, [mvtPeriode, start, end]);

  // Morbidité : série des décomptes « malades » saisis dans la période + prévision 7j.
  const morbiditeSerie = useMemo(() => {
    const datesAvecMalades = [...new Set(maladesAnimaux.filter((m) => especeIds.has(m.especeId) && m.date >= start && m.date <= end).map((m) => m.date))].sort();
    return {
      labels: datesAvecMalades.map((d) => d.slice(5)),
      values: datesAvecMalades.map((d) => {
        const mal = maladesAnimaux.filter((m) => especeIds.has(m.especeId) && m.date === d).reduce((s, m) => s + m.quantite, 0);
        const eff = effectifScopeAuJour(d);
        return eff ? +((mal / eff) * 100).toFixed(2) : 0;
      }),
    };
  }, [maladesAnimaux, especeIds, start, end]); // eslint-disable-line react-hooks/exhaustive-deps
  const morbiditePrevision = useMemo(() => previsionSerie(morbiditeSerie.values, 7), [morbiditeSerie]);
  const morbiditeChart = useMemo(() => {
    const hist = morbiditeSerie.values;
    const prev = morbiditePrevision.map((v) => +v.toFixed(2));
    const lastHist = hist.length ? hist[hist.length - 1] : 0;
    return {
      labels: [...morbiditeSerie.labels, ...prev.map((_, i) => `J+${i + 1}`)],
      datasets: [
        { label: "Morbidité (%)", data: [...hist, ...new Array(prev.length).fill(null)], borderColor: "#d97706", backgroundColor: "rgba(217,119,6,0.12)", fill: true, tension: 0.3, pointRadius: 2 },
        { label: "Prévision (%)", data: [...new Array(Math.max(0, hist.length - 1)).fill(null), lastHist, ...prev], borderColor: "#9333ea", borderDash: [5, 4], fill: false, tension: 0.3, pointRadius: 2 },
      ],
    };
  }, [morbiditeSerie, morbiditePrevision]);

  // Courbe de croissance (effectif) : par catégorie (Toutes) ou par espèce (scope).
  const croissanceChart = useMemo(() => {
    const spanJours = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    const parMois = spanJours > 62;
    const nbPts = Math.min(30, spanJours);
    const pas = Math.max(1, Math.round(spanJours / nbPts));
    const dates = [];
    for (let i = 0; i < spanJours; i += pas) dates.push(addDays(start, i));
    if (dates[dates.length - 1] !== end) dates.push(end);
    const labels = dates.map((d) => (parMois ? `${d.slice(5, 7)}/${d.slice(2, 4)}` : d.slice(5)));

    if (scope === TOUTES) {
      const datasets = cats.map((c) => {
        const esp = especes.filter((e) => e.cat === c);
        const data = dates.map((d) => esp.reduce((s, e) => s + effectifAuJour(e.id, d), 0));
        return { label: c, data, has: data.some((v) => v > 0), borderColor: catColor(c), backgroundColor: catColor(c) };
      }).filter((d) => d.has).map((d) => ({ ...d, tension: 0.3, pointRadius: 2, borderWidth: 2, spanGaps: true, fill: false }));
      return { labels, datasets, vide: !datasets.length };
    }
    const especesTracees = especesScope.filter((e) => dates.some((d) => effectifAuJour(e.id, d) > 0));
    const datasets = especesTracees.map((e, i) => ({
      label: e.nom, data: dates.map((d) => effectifAuJour(e.id, d)),
      borderColor: serieColor(i), backgroundColor: serieColor(i), tension: 0.3, pointRadius: 2, spanGaps: true, fill: false,
    }));
    return { labels, datasets, vide: !datasets.length };
  }, [start, end, scope, cats, especes, especesScope, mouvementsAnimaux]); // eslint-disable-line react-hooks/exhaustive-deps

  // Détail par espèce du périmètre — chaque ligne est cliquable (détail complet en modale).
  const especeRows = useMemo(() => especesScope.map((e) => {
    const mvt = mvtPeriode.filter((m) => m.especeId === e.id);
    const baseEspece = effectifAuJour(e.id, addDays(start, -1));
    const naiss = mvt.filter((m) => m.type === "naissance").reduce((s, m) => s + m.quantite, 0);
    const dec = Math.abs(mvt.filter((m) => m.type === "deces").reduce((s, m) => s + m.quantite, 0));
    const vendu = Math.abs(mvt.filter((m) => m.type === "vente").reduce((s, m) => s + m.quantite, 0));
    const achete = mvt.filter((m) => m.type === "achat").reduce((s, m) => s + m.quantite, 0);
    const perdu = Math.abs(mvt.filter((m) => m.type === "perte").reduce((s, m) => s + m.quantite, 0));
    return {
      id: e.id, nom: e.nom, cat: e.cat, fin: soldeAnimaux[e.id] || 0, base: baseEspece,
      naiss, dec, vendu, achete, perdu,
      malades: [...maladesAnimaux].filter((m) => m.especeId === e.id && m.date <= end).sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.quantite || 0,
      mortalite: baseEspece ? (dec / baseEspece) * 100 : 0,
    };
  }), [especesScope, mvtPeriode, soldeAnimaux, maladesAnimaux, end, start]); // eslint-disable-line react-hooks/exhaustive-deps

  const [especeDetailId, setEspeceDetailId] = useState(null);
  const especeDetail = especeRows.find((r) => r.id === especeDetailId) || null;
  const especeDetailMvt = useMemo(
    () => mvtPeriode.filter((m) => m.especeId === especeDetailId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [mvtPeriode, especeDetailId]
  );
  const especeDetailMalades = useMemo(
    () => maladesAnimaux.filter((m) => m.especeId === especeDetailId && m.date >= start && m.date <= end).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [maladesAnimaux, especeDetailId, start, end]
  );

  const scopeLabel = scope === TOUTES ? "Toutes les catégories" : scope;

  return (
    <div className="space-y-5">
      <div className="relative flex items-center gap-4 overflow-hidden rounded-3xl p-4 text-white shadow-[0_14px_24px_-12px_rgba(0,0,0,0.45)]"
        style={{ background: "linear-gradient(135deg, rgba(46,170,63,0.85) 0%, rgba(26,110,39,0.8) 100%)" }}>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/90"><Boxes size={26} color="#2EAA3F" /></div>
        <div>
          <h2 className="text-lg font-extrabold drop-shadow">MAXI AGRO</h2>
          <p className="text-sm text-green-50/90">Élevage · Cheptel · Santé · Facturation</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-black/[0.03] p-1">
        {[
          { v: "dashboard", l: "Vue d'ensemble", Icon: LayoutGrid },
          { v: "especes", l: "Espèces", Icon: Tag },
        ].map((onglet) => (
          <button key={onglet.v} onClick={() => setMode(onglet.v)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${mode === onglet.v ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}>
            <onglet.Icon size={14} /> {onglet.l}
          </button>
        ))}
      </div>

      {mode === "especes" && <EspecesIndividuelles especes={especes} animauxIndividuels={animauxIndividuels} />}

      {mode === "dashboard" && (
      <>
      {/* Période */}
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
        <span className="ml-auto text-[11px] text-ink-soft/70">{fmtDateShort(start)} → {fmtDateShort(end)} · {mvtPeriode.length} mouvement(s)</span>
      </div>

      {/* Onglets par catégorie */}
      <div className="flex flex-wrap gap-1.5">
        <ScopeTab active={scope === TOUTES} color="#374151" onClick={() => setScope(TOUTES)}>Toutes</ScopeTab>
        {cats.map((c) => <ScopeTab key={c} active={scope === c} color={catColor(c)} onClick={() => setScope(c)}>{c}</ScopeTab>)}
      </div>

      {/* Indicateurs */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft/70">Indicateurs — {scopeLabel}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Indic title="Effectif en stock" value={fmtNum(ind.effectif)} icon={Boxes} color="#2563eb" sub={`${especesScope.length} espèce(s)`} />
          <Indic title="Naissances" value={fmtNum(ind.naiss)} icon={Egg} color="#16a34a" sub={`${naissancesDetail.length} enregistrement(s)`} delta={ind.naiss - indPrec.naiss} onClick={() => setModalKey("naissances")} />
          <Indic title="Décès" value={fmtNum(ind.dec)} icon={HeartCrack} color="#dc2626" sub={`${decesDetail.length} enregistrement(s)`} delta={ind.dec - indPrec.dec} invert onClick={() => setModalKey("deces")} />
          <Indic title="Taux de mortalité" value={`${ind.mortalite.toFixed(1)} %`} icon={HeartPulse} color="#dc2626" sub={`${ind.dec} décès`} onClick={() => setModalKey("mortalite")} />
          <Indic title="Taux de létalité" value={`${ind.letalite.toFixed(1)} %`} icon={Skull} color="#991b1b" sub={`${ind.dec} décès / ${ind.casMaladie} cas`} onClick={() => setModalKey("letalite")} />
          <Indic title="Taux de morbidité" value={`${ind.morbidite.toFixed(1)} %`} icon={Stethoscope} color="#d97706" sub={`${ind.malades} malade(s)`} onClick={() => setModalKey("morbidite")} />
          <Indic title="Taux de croissance" value={`${ind.croissance.toFixed(1)} %`} icon={Sprout} color="#16a34a" sub={`${ind.naiss} naissance(s)`} onClick={() => setModalKey("croissance")} />
          <Indic title="Ventes (volume)" value={fmtNum(venduVolume)} icon={ShoppingCart} color="#0d9488" sub={`${ventesDetail.length} vente(s)`} delta={venduVolume - indPrec.ventes} onClick={() => setModalKey("ventes")} />
          <Indic title="Chiffre d'affaires" value={scope === TOUTES ? fmtMoney(ca.courant) : "—"} icon={Wallet} color="#7c3aed" sub={scope === TOUTES ? `${ca.liste.length} recette(s)` : "Non ventilé par catégorie"} delta={scope === TOUTES ? ca.courant - ca.precedent : undefined} money onClick={scope === TOUTES ? () => setModalKey("ca") : undefined} />
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid gap-5 lg:grid-cols-3">
        <button onClick={() => setModalKey("morbidite")} className="text-left lg:col-span-2">
          <GlassCard hover={false} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft/70">Taux de morbidité — {scopeLabel}</p>
                <p className="text-2xl font-extrabold text-[#d97706]">{ind.morbidite.toFixed(1)} %</p>
                <p className="mt-0.5 text-[11px] text-ink-soft/70">{ind.malades} malade(s) / {fmtNum(ind.effectif)} têtes — courbe & prévision</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d97706]/10 text-[#d97706]"><Stethoscope size={20} /></div>
            </div>
            <div className="mt-2 h-52">
              {morbiditeSerie.labels.length
                ? <Line data={morbiditeChart} options={{ maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => v + " %" } } } }} />
                : <p className="py-10 text-center text-[13px] text-ink-soft/60">Aucun décompte « malades » saisi sur la période.</p>}
            </div>
          </GlassCard>
        </button>
        <GlassCard hover={false} className="p-4">
          <p className="font-bold tracking-tight text-ink mb-2">{repartition.parEspece ? `Répartition par espèce — ${scopeLabel}` : "Répartition par catégorie"}</p>
          <div className="h-64">
            {repartition.rows.some((r) => r.total > 0)
              ? <Doughnut data={repartitionData} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } } } }} />
              : <p className="py-10 text-center text-[13px] text-ink-soft/60">Aucun effectif.</p>}
          </div>
        </GlassCard>
      </div>

      <GlassCard hover={false} className="p-4">
        <p className="font-bold tracking-tight text-ink mb-1">Naissances · Décès · Ventes — {scopeLabel}</p>
        <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-soft">
          <span className="font-semibold text-[#16a34a]">🐣 {fmtNum(ind.naiss)} naissance(s)</span>
          <span className="font-semibold text-[#dc2626]">💀 {fmtNum(ind.dec)} décès</span>
          <span className="font-semibold text-[#0d9488]">🛒 {fmtNum(venduVolume)} vendue(s)</span>
        </div>
        <div className="h-64">
          {!ndvChart.vide
            ? <Bar data={ndvChart.data} options={{
                maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } } },
                scales: { y: { position: "left", beginAtZero: true, ticks: { precision: 0 } }, y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { precision: 0 } } },
              }} />
            : <p className="py-16 text-center text-[13px] text-ink-soft/60">Aucune naissance, décès ni vente sur la période.</p>}
        </div>
      </GlassCard>

      <GlassCard hover={false} className="p-4">
        <p className="font-bold tracking-tight text-ink mb-1">{scope === TOUTES ? "Courbe de croissance par catégorie" : `Courbe de croissance par espèce — ${scopeLabel}`}</p>
        <div className="h-64">
          {!croissanceChart.vide
            ? <Line data={croissanceChart} options={{ maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
            : <p className="py-16 text-center text-[13px] text-ink-soft/60">Pas assez de mouvements sur la période pour tracer une courbe.</p>}
        </div>
      </GlassCard>

      {/* Détail par espèce — chaque ligne s'ouvre en détail complet (clic) */}
      <GlassCard hover={false} className="p-2 overflow-hidden">
        <p className="font-bold tracking-tight text-ink px-3 pt-3 mb-1">Détail par espèce — {scopeLabel}</p>
        <p className="px-3 pb-2 text-[11px] text-ink-soft/60">Cliquez une espèce pour son détail complet sur la période.</p>
        {especeRows.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-soft/60">Aucune espèce.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="text-left text-[11px] font-bold text-ink-soft/70 uppercase tracking-wide">
                  <th className="px-3 py-2">Espèce</th>
                  {scope === TOUTES && <th className="px-2 py-2">Catégorie</th>}
                  <th className="px-2 py-2 text-center">Effectif</th>
                  <th className="px-2 py-2 text-center">Achats</th>
                  <th className="px-2 py-2 text-center">Naiss.</th>
                  <th className="px-2 py-2 text-center">Décès</th>
                  <th className="px-2 py-2 text-center">Ventes</th>
                  <th className="px-2 py-2 text-center">Pertes</th>
                  <th className="px-2 py-2 text-center">Malades</th>
                  <th className="px-2 py-2 text-center">Mortalité</th>
                </tr>
              </thead>
              <tbody>
                {especeRows.map((r) => (
                  <tr key={r.id} onClick={() => setEspeceDetailId(r.id)} className="text-[13px] hover:bg-white/50 transition-colors cursor-pointer">
                    <td className="px-3 py-1.5 font-semibold text-ink">{r.nom}</td>
                    {scope === TOUTES && <td className="px-2 py-1.5" style={{ color: catColor(r.cat) }}>{r.cat}</td>}
                    <td className="px-2 py-1.5 text-center font-bold tabular">{fmtNum(r.fin)}</td>
                    <td className="px-2 py-1.5 text-center text-[#2563eb] tabular">{r.achete}</td>
                    <td className="px-2 py-1.5 text-center text-[#16a34a] tabular">{r.naiss}</td>
                    <td className="px-2 py-1.5 text-center text-[#dc2626] tabular">{r.dec}</td>
                    <td className="px-2 py-1.5 text-center text-[#0d9488] tabular">{r.vendu}</td>
                    <td className="px-2 py-1.5 text-center text-[#991b1b] tabular">{r.perdu}</td>
                    <td className="px-2 py-1.5 text-center text-[#d97706] tabular">{r.malades}</td>
                    <td className="px-2 py-1.5 text-center tabular">{r.mortalite.toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Détail complet d'une espèce (clic sur une ligne du tableau ci-dessus) */}
      <Modal open={!!especeDetail} onClose={() => setEspeceDetailId(null)} title={especeDetail ? `${especeDetail.nom} — ${especeDetail.cat}` : ""} footer={<Button variant="ghost" onClick={() => setEspeceDetailId(null)}>Fermer</Button>}>
        {especeDetail && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Effectif" value={fmtNum(especeDetail.fin)} color="#2563eb" />
              <MiniStat label="Naissances" value={fmtNum(especeDetail.naiss)} color="#16a34a" />
              <MiniStat label="Décès" value={fmtNum(especeDetail.dec)} color="#dc2626" />
              <MiniStat label="Ventes" value={fmtNum(especeDetail.vendu)} color="#0d9488" />
              <MiniStat label="Malades (actuel)" value={fmtNum(especeDetail.malades)} color="#d97706" />
              <MiniStat label="Mortalité" value={`${especeDetail.mortalite.toFixed(1)} %`} color="#991b1b" />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase text-ink-soft/70">Mouvements sur la période ({especeDetailMvt.length})</p>
              <DetailTable
                rows={especeDetailMvt}
                cols={["Date", "Type", "Qté", "Motif", "Agent"]}
                render={(m) => [fmtDateShort(m.date), { naissance: "Naissance", achat: "Achat", deces: "Décès", vente: "Vente", perte: "Perte" }[m.type] || m.type, Math.abs(m.quantite), m.motif || "—", m.agentNom || "—"]}
                empty="Aucun mouvement sur la période."
              />
            </div>
            {especeDetailMalades.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase text-ink-soft/70">Décomptes « malades » saisis sur la période</p>
                <DetailTable rows={especeDetailMalades} cols={["Date", "Malades"]} render={(m) => [fmtDateShort(m.date), m.quantite]} empty="" />
              </div>
            )}
            {CAT_ANIMAUX_IDENTIFIES.includes(especeDetail.cat) && (
              <RegistreIndividuel especeId={especeDetail.id} animaux={animauxIndividuels.filter((a) => a.especeId === especeDetail.id)} />
            )}
          </div>
        )}
      </Modal>

      {/* Modales détaillées */}
      <Modal open={modalKey === "naissances"} onClose={() => setModalKey(null)} title={`Naissances — ${scopeLabel}`} footer={<Button variant="ghost" onClick={() => setModalKey(null)}>Fermer</Button>}>
        <p className="rounded-2xl bg-[#16a34a]/10 px-3 py-2 text-[13px] text-[#16653c]"><strong>{fmtNum(ind.naiss)}</strong> naissance(s) sur la période — période préc. : {fmtNum(indPrec.naiss)}</p>
        <DetailTable rows={naissancesDetail} cols={["Date", "Espèce", "Nés", "Agent"]} render={(n) => [fmtDateShort(n.date), n.espece, n.qte, n.agent || "—"]} empty="Aucune naissance sur la période." />
      </Modal>
      <Modal open={modalKey === "deces"} onClose={() => setModalKey(null)} title={`Décès — ${scopeLabel}`} footer={<Button variant="ghost" onClick={() => setModalKey(null)}>Fermer</Button>}>
        <p className="rounded-2xl bg-[#dc2626]/10 px-3 py-2 text-[13px] text-[#991b1b]"><strong>{fmtNum(ind.dec)}</strong> décès sur la période — période préc. : {fmtNum(indPrec.dec)}</p>
        <DetailTable rows={decesDetail} cols={["Date", "Espèce", "Qté", "Motif", "Agent"]} render={(d) => [fmtDateShort(d.date), d.espece, d.qte, d.motif, d.agent || "—"]} empty="Aucun décès sur la période." />
      </Modal>
      <Modal open={modalKey === "mortalite"} onClose={() => setModalKey(null)} title={`Mortalité — ${scopeLabel}`} footer={<Button variant="ghost" onClick={() => setModalKey(null)}>Fermer</Button>}>
        <p className="rounded-2xl bg-[#dc2626]/10 px-3 py-2 text-[13px] text-[#991b1b]">Taux : <strong>{ind.mortalite.toFixed(1)} %</strong> — {ind.dec} décès / {fmtNum(ind.base)} têtes (effectif en début de période)</p>
        <p className="my-2 text-[11px] italic text-ink-soft/60">Formule : (Décès / Effectif début de période) × 100</p>
        <DetailTable rows={decesDetail} cols={["Date", "Espèce", "Qté", "Motif", "Agent"]} render={(d) => [fmtDateShort(d.date), d.espece, d.qte, d.motif, d.agent || "—"]} empty="Aucun décès sur la période." />
      </Modal>
      <Modal open={modalKey === "letalite"} onClose={() => setModalKey(null)} title={`Létalité — ${scopeLabel}`} footer={<Button variant="ghost" onClick={() => setModalKey(null)}>Fermer</Button>}>
        <p className="rounded-2xl bg-[#dc2626]/10 px-3 py-2 text-[13px] text-[#991b1b]">Taux : <strong>{ind.letalite.toFixed(1)} %</strong> — {ind.dec} décès / {ind.casMaladie} cas de maladie (malades + décès)</p>
        <p className="my-2 text-[11px] italic text-ink-soft/60">Formule : (Décès / Cas de maladie) × 100 — part des animaux tombés malades qui n'ont pas survécu.</p>
        <DetailTable rows={decesDetail} cols={["Date", "Espèce", "Qté", "Motif", "Agent"]} render={(d) => [fmtDateShort(d.date), d.espece, d.qte, d.motif, d.agent || "—"]} empty="Aucun décès sur la période." />
      </Modal>
      <Modal open={modalKey === "croissance"} onClose={() => setModalKey(null)} title={`Croissance & naissances — ${scopeLabel}`} footer={<Button variant="ghost" onClick={() => setModalKey(null)}>Fermer</Button>}>
        <p className="rounded-2xl bg-[#16a34a]/10 px-3 py-2 text-[13px] text-[#16653c]">Taux : <strong>{ind.croissance.toFixed(1)} %</strong> — {ind.naiss} naissance(s)</p>
        <p className="my-2 text-[11px] italic text-ink-soft/60">Formule : ((Naissances − Décès) / Effectif début de période) × 100</p>
        <DetailTable rows={naissancesDetail} cols={["Date", "Espèce", "Nés", "Agent"]} render={(n) => [fmtDateShort(n.date), n.espece, n.qte, n.agent || "—"]} empty="Aucune naissance sur la période." />
      </Modal>
      <Modal open={modalKey === "morbidite"} onClose={() => setModalKey(null)} title={`Morbidité — ${scopeLabel}`} footer={<Button variant="ghost" onClick={() => setModalKey(null)}>Fermer</Button>}>
        <p className="rounded-2xl bg-[#d97706]/10 px-3 py-2 text-[13px] text-[#92400e]">Taux : <strong>{ind.morbidite.toFixed(1)} %</strong> — {ind.malades} malade(s) / {fmtNum(ind.effectif)} têtes</p>
        <p className="my-2 text-[11px] italic text-ink-soft/60">Formule : (Malades / Effectif) × 100 — prévision : tendance + moyenne mobile (7 jours)</p>
        {morbiditePrevision.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {morbiditePrevision.map((v, i) => <span key={i} className="rounded-xl bg-[#9333ea]/10 px-2.5 py-1 text-[11px] font-semibold text-[#6b21a8]">J+{i + 1} : {v.toFixed(1)} %</span>)}
          </div>
        )}
      </Modal>
      <Modal open={modalKey === "ventes"} onClose={() => setModalKey(null)} title={`Ventes (volume) — ${scopeLabel}`} footer={<Button variant="ghost" onClick={() => setModalKey(null)}>Fermer</Button>}>
        <p className="rounded-2xl bg-[#0d9488]/10 px-3 py-2 text-[13px] text-[#0f766e]">{fmtNum(venduVolume)} unité(s) vendue(s) — période préc. : {fmtNum(indPrec.ventes)}</p>
        <DetailTable rows={ventesDetail} cols={["Date", "Espèce", "Qté", "Motif"]} render={(v) => [fmtDateShort(v.date), v.espece, v.qte, v.motif]} empty="Aucune vente sur la période." />
      </Modal>
      <Modal open={modalKey === "ca"} onClose={() => setModalKey(null)} title={`Chiffre d'affaires — ${scopeLabel}`} footer={<Button variant="ghost" onClick={() => setModalKey(null)}>Fermer</Button>}>
        <p className="rounded-2xl bg-[#7c3aed]/10 px-3 py-2 text-[13px] text-[#5b21b6]">{fmtMoney(ca.courant)} — période préc. : {fmtMoney(ca.precedent)}</p>
        <p className="my-2 text-[11px] italic text-ink-soft/60">Total des recettes du secteur agro (tous types confondus — pas de détail par catégorie dans ce projet).</p>
        <DetailTable rows={ca.liste} cols={["Date", "Origine", "Montant"]} render={(r) => [fmtDateShort(r.date), r.origine, fmtMoney(r.montant)]} empty="Aucune recette certifiée sur la période." />
      </Modal>
      </>
      )}
    </div>
  );
}

// Volet « Espèces » de Cheptel — dossier individuel de chaque animal
// identifié (bovins/ovins/caprins, cf. CAT_ANIMAUX_IDENTIFIES) : fiche
// complète (arrivée, statut, vaccins reçus, sortie) et valeur marchande
// éditable, à la demande de l'utilisateur (2026-08-18).
function EspecesIndividuelles({ especes, animauxIndividuels }) {
  const { fiches, chargerSante } = useSanteStore();
  const [recherche, setRecherche] = useState("");
  const [filtreEspece, setFiltreEspece] = useState("");
  const [detailId, setDetailId] = useState(null);

  useEffect(() => { chargerSante(); }, [chargerSante]);

  const especesIdentifiees = useMemo(() => especes.filter((e) => CAT_ANIMAUX_IDENTIFIES.includes(e.cat)), [especes]);
  const especeNom = (id) => especes.find((e) => e.id === id)?.nom || id;

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return [...animauxIndividuels]
      .filter((a) => !filtreEspece || a.especeId === filtreEspece)
      .filter((a) => !q || a.identifiant.toLowerCase().includes(q) || especeNom(a.especeId).toLowerCase().includes(q))
      .sort((a, b) => a.identifiant.localeCompare(b.identifiant));
  }, [animauxIndividuels, filtreEspece, recherche]); // eslint-disable-line react-hooks/exhaustive-deps

  const detail = animauxIndividuels.find((a) => a.id === detailId) || null;
  const statutLabel = { actif: "Actif", vendu: "Vendu", mort: "Mort", perdu: "Perdu" };
  const statutTone = { actif: "accent", vendu: "mint", mort: "coral", perdu: "amber" };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 my-4">
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Rechercher</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/50" />
            <TextInput className="pl-8" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Identifiant ou espèce…" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Espèce</label>
          <Select value={filtreEspece} onChange={(e) => setFiltreEspece(e.target.value)}>
            <option value="">Toutes</option>
            {especesIdentifiees.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </Select>
        </div>
        <span className="ml-auto text-[11px] text-ink-soft/70">{lignes.length} animal(aux) identifié(s)</span>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        {lignes.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-ink-soft/60">
            <Tag size={22} className="inline-block mb-1.5 opacity-40" /><br />
            Aucun animal identifié — ajoutez un identifiant depuis Saisie journalière ou le détail d'une espèce.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                  <th className="px-4 py-3">Identifiant</th>
                  <th className="px-3 py-3">Espèce</th>
                  <th className="px-3 py-3 text-center">Sexe</th>
                  <th className="px-3 py-3 text-center">Statut</th>
                  <th className="px-3 py-3 text-right">Valeur marchande</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((a) => (
                  <tr key={a.id} onClick={() => setDetailId(a.id)} className="text-[13.5px] hover:bg-white/50 transition-colors cursor-pointer">
                    <td className="px-4 py-2.5 font-semibold text-ink">{a.identifiant}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{especeNom(a.especeId)}</td>
                    <td className="px-3 py-2.5 text-center text-ink-soft">{a.sexe === "male" ? "♂" : a.sexe === "femelle" ? "♀" : "—"}</td>
                    <td className="px-3 py-2.5 text-center"><Badge tone={statutTone[a.statut]}>{statutLabel[a.statut]}</Badge></td>
                    <td className="px-3 py-2.5 text-right tabular font-semibold text-ink">{a.valeurMarchande ? fmtMoney(a.valeurMarchande) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <FicheAnimal key={detail?.id || "none"} animal={detail} especeNom={detail ? especeNom(detail.especeId) : ""} fiches={fiches} onClose={() => setDetailId(null)} />
    </div>
  );
}

// Fiche complète d'un animal identifié : infos, valeur marchande éditable,
// historique (entrée → vaccins/interventions reçus → sortie éventuelle).
function FicheAnimal({ animal, especeNom, fiches, onClose }) {
  const { enregistrerValeurMarchande } = useStockStore();
  const [valeur, setValeur] = useState(animal?.valeurMarchande || "");
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  if (!animal) return null;

  const vaccinsRecus = fiches
    .filter((f) => f.especeId === animal.especeId && (f.animauxIds || "").split(",").map((s) => s.trim()).includes(animal.identifiant))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const timeline = [
    { date: animal.dateEntree, label: "Entrée dans l'effectif", tone: "#16a34a" },
    ...vaccinsRecus.map((f) => ({ date: f.date, label: `${f.type === "vaccination" ? "💉" : f.type === "traitement" ? "💊" : f.type === "deparasitage" ? "🪱" : "🔧"} ${f.produit}`, tone: "#0A84FF" })),
    ...(animal.statut !== "actif" ? [{ date: animal.dateSortie, label: `Sortie — ${{ vendu: "Vendu", mort: "Mort", perdu: "Perdu" }[animal.statut]}${animal.motifSortie ? ` (${animal.motifSortie})` : ""}`, tone: "#dc2626" }] : []),
  ].filter((t) => t.date).sort((a, b) => (a.date < b.date ? -1 : 1));

  async function save() {
    setSaving(true);
    const res = await enregistrerValeurMarchande(animal.id, valeur);
    setSaving(false);
    if (res.ok) { setSavedOk(true); setTimeout(() => setSavedOk(false), 1500); }
  }

  return (
    <Modal open={!!animal} onClose={onClose} title={`${animal.identifiant} — ${especeNom}`} footer={<Button variant="ghost" onClick={onClose}>Fermer</Button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Sexe" value={animal.sexe === "male" ? "Mâle" : animal.sexe === "femelle" ? "Femelle" : "—"} color="#374151" />
          <MiniStat label="Date d'arrivée" value={fmtDateShort(animal.dateEntree)} color="#16a34a" />
          <MiniStat label="Vaccins/soins reçus" value={String(vaccinsRecus.length)} color="#0A84FF" />
        </div>

        <div className="rounded-2xl bg-black/[0.03] p-3">
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Valeur marchande (FCFA)</label>
          <div className="flex items-center gap-2">
            <TextInput type="number" min="0" value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="0" className="max-w-[160px]" />
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "…" : savedOk ? "✓ Enregistré" : "Enregistrer"}</Button>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase text-ink-soft/70">Historique complet</p>
          {timeline.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-ink-soft/60 italic">Aucun évènement enregistré.</p>
          ) : (
            <div className="space-y-1.5">
              {timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-[12.5px]">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.tone }} />
                  <div>
                    <span className="font-semibold text-ink">{t.label}</span>
                    <p className="text-[11px] text-ink-soft/70">{fmtDateShort(t.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {animal.notes && (
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase text-ink-soft/70">Notes</p>
            <p className="text-[13px] text-ink-soft italic">{animal.notes}</p>
          </div>
        )}
      </div>
    </Modal>
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
  const { title, value, color, sub, delta, money, invert, onClick } = props;
  const Icon = props.icon;
  const favorable = invert ? delta < 0 : delta > 0;
  return (
    <button onClick={onClick} disabled={!onClick} className={`text-left ${onClick ? "cursor-pointer" : "cursor-default"}`}>
      <GlassCard hover={!!onClick} className="p-3">
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
        {sub && <p className="mt-0.5 text-[10.5px] text-ink-soft/60">{sub}{onClick ? " — détails" : ""}</p>}
      </GlassCard>
    </button>
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

// Registre individuel — un identifiant (boucle/tag) par animal, pour
// bovins/ovins/caprins uniquement (cf. CAT_ANIMAUX_IDENTIFIES). Permet de
// désigner précisément quel animal sort (vente/décès/perte, via Saisie
// journalière) ou reçoit un vaccin (via Santé animale), plutôt qu'un simple
// décompte agrégé par espèce.
function RegistreIndividuel({ especeId, animaux }) {
  const { ajouterAnimalIndividuel, sortirAnimalIndividuel } = useStockStore();
  const [openAjout, setOpenAjout] = useState(false);
  const [form, setForm] = useState({ identifiant: "", sexe: "", dateEntree: todayStr() });
  const [sortieId, setSortieId] = useState(null);
  const [sortieForm, setSortieForm] = useState({ statut: "vendu", date: todayStr(), motif: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const actifs = [...animaux].filter((a) => a.statut === "actif").sort((a, b) => a.identifiant.localeCompare(b.identifiant));
  const sortis = [...animaux].filter((a) => a.statut !== "actif").sort((a, b) => (a.dateSortie < b.dateSortie ? 1 : -1));
  const statutLabel = { vendu: "Vendu", mort: "Mort", perdu: "Perdu" };
  const statutTone = { vendu: "mint", mort: "coral", perdu: "amber" };

  async function ajouter() {
    if (!form.identifiant.trim()) return;
    setSaving(true);
    setError("");
    const res = await ajouterAnimalIndividuel({ especeId, ...form });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setForm({ identifiant: "", sexe: "", dateEntree: todayStr() });
    setOpenAjout(false);
  }

  async function confirmerSortie() {
    setSaving(true);
    await sortirAnimalIndividuel(sortieId, sortieForm.statut, sortieForm.date, sortieForm.motif);
    setSaving(false);
    setSortieId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-bold uppercase text-ink-soft/70">Registre individuel — {actifs.length} actif(s)</p>
        <button onClick={() => setOpenAjout((v) => !v)} className="flex items-center gap-1 text-[11px] font-semibold text-[#0A84FF]"><Plus size={12} /> Ajouter un identifiant</button>
      </div>

      {openAjout && (
        <div className="rounded-2xl bg-black/[0.03] p-2.5 mb-2 space-y-2">
          {error && <p className="text-[11px] text-[#b3241b]">{error}</p>}
          <div className="grid grid-cols-3 gap-2">
            <TextInput value={form.identifiant} onChange={(e) => setForm({ ...form, identifiant: e.target.value })} placeholder="Ex : B-014" autoFocus />
            <Select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
              <option value="">Sexe ?</option>
              <option value="male">Mâle</option>
              <option value="femelle">Femelle</option>
            </Select>
            <TextInput type="date" value={form.dateEntree} onChange={(e) => setForm({ ...form, dateEntree: e.target.value })} />
          </div>
          <Button size="sm" onClick={ajouter} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
        </div>
      )}

      {actifs.length === 0 && !openAjout && <p className="text-[12.5px] text-ink-soft/60 italic mb-2">Aucun animal identifié.</p>}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {actifs.map((a) => (
          <div key={a.id} className="flex items-center gap-1 rounded-full bg-black/[0.04] pl-2.5 pr-1 py-1 text-[11.5px]">
            <Tag size={10} className="text-ink-soft/60" />
            <span className="font-semibold text-ink">{a.identifiant}</span>
            {a.sexe && <span className="text-ink-soft/60">{a.sexe === "male" ? "♂" : "♀"}</span>}
            <button onClick={() => { setSortieId(a.id); setSortieForm({ statut: "vendu", date: todayStr(), motif: "" }); }} className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-[#b3241b] hover:bg-[#FF453A]/10">Sortir</button>
          </div>
        ))}
      </div>

      {sortieId && (
        <div className="rounded-2xl bg-[#FF453A]/5 p-2.5 mb-2 space-y-2">
          <p className="text-[11px] font-semibold text-ink">Sortie de {actifs.find((a) => a.id === sortieId)?.identifiant}</p>
          <div className="grid grid-cols-3 gap-2">
            <Select value={sortieForm.statut} onChange={(e) => setSortieForm({ ...sortieForm, statut: e.target.value })}>
              <option value="vendu">Vendu</option>
              <option value="mort">Mort</option>
              <option value="perdu">Perdu</option>
            </Select>
            <TextInput type="date" value={sortieForm.date} onChange={(e) => setSortieForm({ ...sortieForm, date: e.target.value })} />
            <TextInput value={sortieForm.motif} onChange={(e) => setSortieForm({ ...sortieForm, motif: e.target.value })} placeholder="Motif" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmerSortie} disabled={saving}>{saving ? "…" : "Confirmer"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setSortieId(null)}>Annuler</Button>
          </div>
        </div>
      )}

      {sortis.length > 0 && (
        <details className="rounded-2xl bg-black/[0.02] p-2">
          <summary className="cursor-pointer text-[10.5px] font-bold uppercase text-ink-soft/60">Historique des sorties ({sortis.length})</summary>
          <div className="mt-1.5 space-y-1">
            {sortis.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-[11.5px]">
                <span className="font-semibold text-ink">{a.identifiant}</span>
                <Badge tone={statutTone[a.statut]}>{statutLabel[a.statut]}</Badge>
                <span className="text-ink-soft/60">{a.dateSortie ? fmtDateShort(a.dateSortie) : ""}{a.motifSortie ? ` — ${a.motifSortie}` : ""}</span>
              </div>
            ))}
          </div>
        </details>
      )}
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
