import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, ChartColumn, ChartPie, Trophy, ArrowDownCircle, ArrowUpCircle, CalendarDays, Receipt, Banknote } from "lucide-react";
import GlassCard from "../components/ui/GlassCard";
import StatTile from "../components/ui/StatTile";
import Icone3D from "../components/ui/Icone3D";
import { fmtFCFA } from "../lib/logic";
import { dansFiltre } from "../lib/caisseFiltre";

const ACCENT = "#FF9F0A";
const VERT = "#30D158";
const ROUGE = "#FF453A";
const GRIS = "#8E8E93";
const PALETTE = ["#FF9F0A", "#0A84FF", "#30D158", "#BF5AF2", "#FF453A", "#64D2FF", "#FFD60A", "#5E5CE6"];

// Valeurs d'axe courtes : 1,2 M, 450 k.
const court = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1).replace(".", ",")} M`;
  if (a >= 1e3) return `${Math.round(v / 1e3)} k`;
  return String(v);
};
const jourCourt = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const moisCourt = (ym) => new Date(`${ym}-01`).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

const STYLE_INFOBULLE = { borderRadius: 16, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", fontSize: 12 };

function CarteGraphique({ icone, couleur, titre, sousTitre, children, className = "" }) {
  return (
    <GlassCard className={`p-5 ${className}`} hover={false}>
      <div className="mb-4 flex items-center gap-3">
        <Icone3D icon={icone} color={couleur} size={34} />
        <div className="min-w-0">
          <h3 className="font-bold tracking-tight text-ink">{titre}</h3>
          {sousTitre && <p className="text-[11px] text-ink-soft">{sousTitre}</p>}
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

function Vide({ texte }) {
  return <p className="py-10 text-center text-[13px] italic text-ink-soft">{texte}</p>;
}

// Statistiques de la caisse : tout est calculé à partir des mouvements et de la chronologie
// (qui tient compte des comptes ajustés), donc les graphiques suivent chaque modification.
export default function CaisseStats({ mouvements, chronologie, filtre }) {
  // Les statistiques suivent le filtre de dates de la page (jusqu'à une date, ou plage) ; on peut élargir à tout l'historique.
  const { mode, lo, hi, finBandeau, libelle } = filtre;
  const [portee, setPortee] = useState("filtre");
  const dansPortee = (date) => portee === "tout" || dansFiltre(date, mode, lo, hi, finBandeau);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lignes = useMemo(() => mouvements.filter((m) => dansPortee(m.date)), [mouvements, portee, mode, lo, hi, finBandeau]);
  const sorties = useMemo(() => lignes.filter((m) => m.type === "sortie"), [lignes]);

  const totalDot = lignes.filter((m) => m.type === "entree").reduce((t, m) => t + m.montant, 0);
  const totalDep = sorties.reduce((t, m) => t + m.montant, 0);
  const joursActifs = new Set(sorties.map((m) => m.date)).size;
  const moyenneJour = joursActifs ? Math.round(totalDep / joursActifs) : 0;
  const plusGrosse = sorties.reduce((max, m) => (!max || m.montant > max.montant ? m : max), null);

  // Évolution du reste en caisse : solde en fin de chaque jour qui a eu un mouvement.
  const serieReste = useMemo(() => {
    let solde = 0;
    const parJour = new Map();
    for (const e of chronologie) {
      if (e.c) solde = e.c.montant;
      else solde += (e.m.type === "entree" ? 1 : -1) * e.m.montant;
      parJour.set(e.date, solde);
    }
    return [...parJour.entries()].filter(([d]) => dansPortee(d)).map(([date, reste]) => ({ date, label: jourCourt(date), reste }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chronologie, portee, mode, lo, hi, finBandeau]);

  const parMois = useMemo(() => {
    const map = new Map();
    for (const m of lignes) {
      const cle = m.date.slice(0, 7);
      const r = map.get(cle) || { mois: cle, label: moisCourt(cle), dotations: 0, depenses: 0 };
      if (m.type === "entree") r.dotations += m.montant; else r.depenses += m.montant;
      map.set(cle, r);
    }
    return [...map.values()].sort((a, b) => (a.mois < b.mois ? -1 : 1));
  }, [lignes]);

  const parCategorie = useMemo(() => {
    const map = new Map();
    for (const m of sorties) {
      const cle = m.categorie || "Sans catégorie";
      map.set(cle, (map.get(cle) || 0) + m.montant);
    }
    const tri = [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const tete = tri.slice(0, 7);
    const reste = tri.slice(7).reduce((t, c) => t + c.value, 0);
    if (reste > 0) tete.push({ name: "Autres", value: reste });
    return tete.map((c, i) => ({ ...c, fill: c.name === "Sans catégorie" || c.name === "Autres" ? GRIS : PALETTE[i % PALETTE.length] }));
  }, [sorties]);

  const topBeneficiaires = useMemo(() => {
    const map = new Map();
    for (const m of sorties) {
      const nom = (m.beneficiaire || "").trim();
      if (!nom) continue;
      map.set(nom, (map.get(nom) || 0) + m.montant);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [sorties]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft"><CalendarDays size={14} />Période</span>
        <div className="glass relative flex rounded-2xl p-1">
          {(mode === "tout" ? [{ id: "filtre", label: "Tout l'historique" }] : [{ id: "filtre", label: libelle }, { id: "tout", label: "Tout l'historique" }]).map((p) => (
            <button
              key={p.id} type="button" onClick={() => setPortee(p.id)}
              className={`relative rounded-xl px-3 py-1.5 text-[12.5px] font-bold transition-colors ${portee === p.id ? "text-white" : "text-ink-soft hover:text-ink"}`}
            >
              {portee === p.id && (
                <motion.span layoutId="caisse-stats-plage" className="absolute inset-0 rounded-xl" style={{ background: `linear-gradient(135deg, ${ACCENT}, #d98200)` }} transition={{ type: "spring", stiffness: 420, damping: 32 }} />
              )}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        <StatTile compact icone3d icon={ArrowUpCircle} label="Dépenses" value={fmtFCFA(totalDep)} tone={ROUGE} />
        <StatTile compact icone3d icon={ArrowDownCircle} label="Dotations" value={fmtFCFA(totalDot)} tone={VERT} />
        <StatTile compact icone3d icon={Receipt} label={`Moyenne par jour de dépense${joursActifs ? ` (${joursActifs} j)` : ""}`} value={fmtFCFA(moyenneJour)} tone="#0A84FF" />
        <StatTile compact icone3d icon={Trophy} label={plusGrosse ? `Plus grosse : ${plusGrosse.libelle || "dépense"}` : "Plus grosse dépense"} value={fmtFCFA(plusGrosse?.montant || 0)} tone="#BF5AF2" />
      </div>

      {lignes.length === 0 ? (
        <GlassCard className="p-6" hover={false}><Vide texte="Aucun mouvement de caisse sur cette période. Changez le filtre de dates ou choisissez « Tout l'historique »." /></GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <CarteGraphique icone={TrendingUp} couleur={ACCENT} titre="Évolution du reste en caisse" sousTitre="Solde en fin de chaque jour avec mouvement" className="lg:col-span-2">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serieReste} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="degradeReste" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} tickFormatter={court} width={56} />
                  <Tooltip formatter={(v) => [fmtFCFA(v), "Reste en caisse"]} contentStyle={STYLE_INFOBULLE} />
                  <Area type="monotone" dataKey="reste" stroke={ACCENT} strokeWidth={2.5} fill="url(#degradeReste)" dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CarteGraphique>

          <CarteGraphique icone={ChartColumn} couleur="#0A84FF" titre="Dotations et dépenses par mois">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={parMois} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} tickFormatter={court} width={56} />
                  <Tooltip formatter={(v, nom) => [fmtFCFA(v), nom === "dotations" ? "Dotations" : "Dépenses"]} contentStyle={STYLE_INFOBULLE} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey="dotations" fill={VERT} radius={[8, 8, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="depenses" fill={ROUGE} radius={[8, 8, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-4 text-[11.5px] font-semibold text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: VERT }} />Dotations</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ROUGE }} />Dépenses</span>
            </div>
          </CarteGraphique>

          <CarteGraphique icone={ChartPie} couleur="#5E5CE6" titre="Dépenses par catégorie">
            {parCategorie.length === 0 ? (
              <Vide texte="Aucune dépense sur cette période." />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-[200px] w-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={parCategorie} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} cornerRadius={8} stroke="none">
                        {parCategorie.map((c) => <Cell key={c.name} fill={c.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtFCFA(v)} contentStyle={STYLE_INFOBULLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Total</span>
                    <span className="tabular text-[13px] font-extrabold text-ink">{court(totalDep)}</span>
                  </div>
                </div>
                <ul className="w-full min-w-0 flex-1 space-y-1.5">
                  {parCategorie.map((c) => (
                    <li key={c.name} className="flex items-center gap-2 text-[12.5px]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.fill }} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{c.name}</span>
                      <span className="shrink-0 tabular font-bold text-ink">{fmtFCFA(c.value)}</span>
                      <span className="w-9 shrink-0 text-right text-[11px] text-ink-soft">{totalDep ? Math.round((c.value / totalDep) * 100) : 0}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CarteGraphique>

          <CarteGraphique icone={Banknote} couleur={ROUGE} titre="Principaux bénéficiaires" sousTitre="Dépenses payées par la caisse, top 5">
            {topBeneficiaires.length === 0 ? (
              <Vide texte="Aucun bénéficiaire renseigné sur cette période." />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topBeneficiaires} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} tickFormatter={court} />
                    <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11.5, fill: "#374151", fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={(n) => (n.length > 13 ? `${n.slice(0, 12)}…` : n)} />
                    <Tooltip formatter={(v) => [fmtFCFA(v), "Dépenses"]} contentStyle={STYLE_INFOBULLE} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={26}>
                      {topBeneficiaires.map((b, i) => <Cell key={b.name} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CarteGraphique>
        </div>
      )}
    </div>
  );
}
