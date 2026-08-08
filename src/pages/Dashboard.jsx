import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, AlertTriangle, Clock3, ArrowUpRight, Plus, Building2 } from "lucide-react";
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import StatTile from "../components/ui/StatTile";
import ProgressRing from "../components/ui/ProgressRing";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Field, { TextInput } from "../components/ui/Field";
import SecteurOverview from "../components/SecteurOverview";
import TransactionsListModal from "../components/TransactionsListModal";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import {
  tableauSecteurs, secteursEnAlerte, totalMontant, depensesSecteurMois, budgetSecteurMois,
  fmtFCFA, fmtCompact, last12Months, croissance,
} from "../lib/logic";

const COULEURS_SUGGEREES = ["#0A84FF", "#30D158", "#FF9F0A", "#BF5AF2", "#FF453A", "#64D2FF", "#5E5CE6", "#8E8E93"];

export default function Dashboard() {
  const { secteurs, depenses, budgets, addSecteur } = useDataStore();
  const { periode, secteurFiltre } = useUIStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [ouvrirAjoutSecteur, setOuvrirAjoutSecteur] = useState(false);
  const [formSecteur, setFormSecteur] = useState({ nom: "", label: "", color: COULEURS_SUGGEREES[0] });
  const [savingSecteur, setSavingSecteur] = useState(false);
  const [vueTransactions, setVueTransactions] = useState(null); // { type, title, items }

  async function creerSecteur() {
    setSavingSecteur(true);
    const res = await addSecteur(formSecteur, user);
    setSavingSecteur(false);
    if (!res.ok) return alert(res.error);
    setOuvrirAjoutSecteur(false);
    setFormSecteur({ nom: "", label: "", color: COULEURS_SUGGEREES[0] });
  }

  const secteurActif = secteurFiltre !== "tous" ? secteurs.find((s) => s.id === secteurFiltre) : null;

  const secteursData = useMemo(() => tableauSecteurs(secteurs, depenses, budgets, periode.annee, periode.mois, periode.jour), [secteurs, depenses, budgets, periode]);
  const alertes = useMemo(() => secteursEnAlerte(secteurs, depenses, budgets, periode.annee, periode.mois, periode.jour), [secteurs, depenses, budgets, periode]);

  const totalDepense = totalMontant(secteursData.map((s) => ({ montant: s.depense })));
  const totalBudget = totalMontant(secteursData.map((s) => ({ montant: s.budget })));
  const tauxGlobal = totalBudget ? totalDepense / totalBudget : 0;

  const moisPrecedent = periode.mois === 0 ? 11 : periode.mois - 1;
  const anneePrecedente = periode.mois === 0 ? periode.annee - 1 : periode.annee;
  const totalPrecedent = totalMontant(
    secteurs.flatMap((s) => depensesSecteurMois(depenses, s.id, anneePrecedente, moisPrecedent))
  );

  const depensesEnAttente = useMemo(() => depenses.filter((d) => d.statut === "en_attente"), [depenses]);
  const depensesPeriodeToutes = useMemo(
    () => secteurs.flatMap((s) => depensesSecteurMois(depenses, s.id, periode.annee, periode.mois, periode.jour)),
    [secteurs, depenses, periode]
  );
  const depensesAlertes = useMemo(() => {
    const idsAlertes = new Set(alertes.map((a) => a.id));
    return depensesPeriodeToutes.filter((d) => idsAlertes.has(d.secteurId));
  }, [depensesPeriodeToutes, alertes]);
  const suffixePeriode = periode.jour ? "du jour" : "du mois";

  const barData = secteursData.map((s) => ({ nom: s.nom, depense: s.depense, budget: s.budget, fill: s.color }));

  const trend = useMemo(() => {
    return last12Months().map(({ annee, mois, label }) => {
      const total = totalMontant(secteurs.flatMap((s) => depensesSecteurMois(depenses, s.id, annee, mois)));
      return { label, total };
    });
  }, [secteurs, depenses]);

  if (secteurActif) {
    return (
      <div>
        <TopBar title="Tableau de bord" subtitle={`${secteurActif.nom} — vue financière du secteur`} />
        <SecteurOverview
          secteurId={secteurActif.id}
          nom={secteurActif.nom}
          color={secteurActif.color}
          labelRecettes="Dernières recettes"
          onVoirDepenses={() => navigate("/depense/depenses")}
          onVoirRecettes={() => navigate("/depense/recettes")}
        />
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Tableau de bord" subtitle="Vue consolidée — pilotage financier de LA TERMITIÈRE" />

      <div className="grid grid-cols-2 lg:grid-cols-4 lg:auto-rows-[172px] gap-4 sm:gap-5">
        <StatTile
          icon={Wallet}
          label={`Dépenses ${suffixePeriode}`}
          value={fmtCompact(totalDepense) + " FCFA"}
          trend={croissance(totalDepense, totalPrecedent)}
          tone="#0A84FF"
          onClick={() => setVueTransactions({ type: "depense", title: `Dépenses ${suffixePeriode} — tous secteurs`, items: depensesPeriodeToutes })}
        />
        <StatTile
          icon={TrendingUp}
          label="Budget consommé"
          value={`${Math.round(tauxGlobal * 100)}%`}
          tone="#30D158"
          onClick={() => setVueTransactions({ type: "depense", title: `Dépenses ${suffixePeriode} — tous secteurs`, items: depensesPeriodeToutes })}
        />
        <StatTile
          icon={AlertTriangle}
          label="Secteurs en alerte"
          value={alertes.length}
          tone="#FF9F0A"
          onClick={() => setVueTransactions({ type: "depense", title: `Dépenses des secteurs en alerte ${suffixePeriode}`, items: depensesAlertes })}
        />
        <StatTile
          icon={Clock3}
          label="Demandes en attente"
          value={depensesEnAttente.length}
          tone="#FF453A"
          onClick={() => setVueTransactions({ type: "depense", title: "Demandes en attente d'approbation", items: depensesEnAttente })}
        />

        {/* Dépenses par secteur */}
        <GlassCard className="col-span-2 lg:col-span-3 lg:row-span-2 p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div>
              <h3 className="font-bold tracking-tight text-ink">Dépenses par secteur</h3>
              <p className="text-[12.5px] text-ink-soft font-medium">Mois en cours — comparé au budget alloué</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="accent">
                <ArrowUpRight size={12} /> {fmtCompact(totalBudget)} FCFA alloués
              </Badge>
              <button
                onClick={() => setOuvrirAjoutSecteur(true)}
                title="Ajouter un secteur d'activité"
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-ink-soft hover:text-ink transition-colors"
              >
                <Plus size={14} strokeWidth={2.6} />
              </button>
            </div>
          </div>
          <div className="flex-1 h-64 lg:h-auto -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barGap={6}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="nom" tick={{ fontSize: 11, fill: "#3c4048", fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: "#3c4048" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  formatter={(v) => fmtFCFA(v)}
                  contentStyle={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", fontSize: 12.5 }}
                  labelStyle={{ color: "#0f172a", fontWeight: 700, marginBottom: 4 }}
                  itemStyle={{ color: "#3c4048", fontWeight: 600 }}
                />
                <Bar dataKey="budget" name="Budget alloué" fill="rgba(15,23,42,0.16)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="depense" name="Dépense" radius={[8, 8, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Budget global ring */}
        <GlassCard className="col-span-2 lg:col-span-1 lg:row-span-2 p-5 flex flex-col items-center justify-center gap-3">
          <p className="text-[12.5px] font-semibold text-ink-soft text-center">Consommation budgétaire globale</p>
          <ProgressRing value={tauxGlobal} color={tauxGlobal >= 1 ? "#FF453A" : tauxGlobal >= 0.8 ? "#FF9F0A" : "#30D158"} size={128} />
          <p className="text-[11.5px] text-ink-soft text-center leading-snug">
            {fmtCompact(totalDepense)} / {fmtCompact(totalBudget)} FCFA
          </p>
        </GlassCard>

        {/* Tendance 12 mois */}
        <GlassCard className="col-span-2 lg:row-span-2 p-5 sm:p-6 flex flex-col">
          <h3 className="font-bold tracking-tight text-ink mb-0.5">Tendance des dépenses</h3>
          <p className="text-[12.5px] text-ink-soft font-medium mb-2">12 derniers mois — tous secteurs</p>
          <div className="flex-1 h-64 lg:h-auto -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#3c4048", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: "#3c4048" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v) => fmtFCFA(v)} contentStyle={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", fontSize: 12.5 }} />
                <Line type="monotone" dataKey="total" stroke="#5E5CE6" strokeWidth={3} dot={{ r: 3, fill: "#5E5CE6" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Alertes */}
        <GlassCard className="col-span-2 lg:row-span-2 p-5 sm:p-6 flex flex-col">
          <h3 className="font-bold tracking-tight text-ink mb-0.5">Alertes budgétaires</h3>
          <p className="text-[12.5px] text-ink-soft font-medium mb-3">Secteurs ayant franchi le seuil d'attention (80 %)</p>
          <div className="lg:flex-1 max-h-72 lg:max-h-none overflow-y-auto flex flex-col gap-2.5 pr-1">
            {alertes.length === 0 && <p className="text-[13px] text-ink-soft italic mt-4">Aucune alerte pour la période sélectionnée.</p>}
            {alertes.map((a) => (
              <motion.div
                key={a.id}
                whileHover={{ x: 3 }}
                onClick={() => setVueTransactions({
                  type: "depense",
                  title: `Dépenses ${suffixePeriode} — ${a.nom}`,
                  items: depensesPeriodeToutes.filter((d) => d.secteurId === a.id),
                })}
                className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl bg-white/50 hover:bg-white/75 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{a.nom}</p>
                    <p className="text-[11.5px] text-ink-soft truncate">{fmtCompact(a.depense)} / {fmtCompact(a.budget)} FCFA</p>
                  </div>
                </div>
                <Badge tone={a.tone}>{Math.round(a.taux * 100)}%</Badge>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      </div>

      <Modal
        open={ouvrirAjoutSecteur}
        onClose={() => setOuvrirAjoutSecteur(false)}
        title="Ajouter un secteur d'activité"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOuvrirAjoutSecteur(false)}>Annuler</Button>
            <Button icon={Building2} disabled={!formSecteur.nom.trim() || savingSecteur} onClick={creerSecteur}>
              {savingSecteur ? "Création…" : "Créer le secteur"}
            </Button>
          </>
        }
      >
        <Field label="Nom du secteur *">
          <TextInput
            value={formSecteur.nom}
            onChange={(e) => setFormSecteur((f) => ({ ...f, nom: e.target.value }))}
            placeholder="ex : MAXI COM"
          />
        </Field>
        <Field label="Description (optionnel)">
          <TextInput
            value={formSecteur.label}
            onChange={(e) => setFormSecteur((f) => ({ ...f, label: e.target.value }))}
            placeholder="ex : Communication & marketing"
          />
        </Field>
        <Field label="Couleur">
          <div className="flex flex-wrap gap-2">
            {COULEURS_SUGGEREES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFormSecteur((f) => ({ ...f, color: c }))}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: c, outline: formSecteur.color === c ? "2px solid rgba(0,0,0,0.4)" : "none", outlineOffset: 2 }}
              />
            ))}
          </div>
        </Field>
        <p className="mt-1 text-[12px] text-ink-soft">
          Le nouveau secteur apparaît aussitôt dans les filtres et les formulaires de dépense/recette. Aucun budget n'est défini par défaut — vous pourrez en saisir un dès le premier mois.
        </p>
      </Modal>

      {vueTransactions && (
        <TransactionsListModal
          type={vueTransactions.type}
          title={vueTransactions.title}
          items={vueTransactions.items}
          onClose={() => setVueTransactions(null)}
        />
      )}
    </div>
  );
}
