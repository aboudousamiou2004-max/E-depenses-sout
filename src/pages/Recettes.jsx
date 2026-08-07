import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Wallet, TrendingUp, AlertTriangle } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import StatTile from "../components/ui/StatTile";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Field, { TextInput, Select } from "../components/ui/Field";
import RecetteDetailModal from "../components/RecetteDetailModal";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { fmtFCFA, fmtCompact, totalMontant, secteursEnAlerte, matchPeriode } from "../lib/logic";
import { ROLES_ACCES_TOTAL } from "../lib/modules";

const ORIGINES = ["Vente", "Prestation", "Facturation client", "Subvention"];

// Même code couleur par type de source que l'écran « Sources de revenus »
// d'E-DÉPENSES sur la plateforme réelle (facture/vente = vert, prestation =
// bleu, subvention = violet) — sert de repère visuel rapide dans le tableau.
const ORIGINE_TONE = {
  "Vente": "mint",
  "Prestation": "accent",
  "Facturation client": "mint",
  "Subvention": "grape",
};

export default function Recettes() {
  const { secteurs, recettes, budgets, depenses, addRecette, modifierRecette, supprimerRecette } = useDataStore();
  const { secteurFiltre, periode, recherche } = useUIStore();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ secteurId: "", origine: ORIGINES[0], montant: "", date: "2026-07-27" });
  const [respecterPeriode, setRespecterPeriode] = useState(false);
  const [filtreOrigine, setFiltreOrigine] = useState("");
  const [detail, setDetail] = useState(null);
  const peutModifier = ROLES_ACCES_TOTAL.includes(user?.role);

  // `secteurs` se charge de façon asynchrone (Supabase) — vide au premier
  // rendu, donc on ne peut pas présélectionner secteurs[0] dans l'état initial.
  useEffect(() => {
    if (!form.secteurId && secteurs.length > 0) setForm((f) => ({ ...f, secteurId: secteurs[0].id }));
  }, [secteurs, form.secteurId]);

  function secteurOf(id) {
    return secteurs.find((s) => s.id === id);
  }

  // Base filtrée (secteur — filtre global de la TopBar — + source + recherche
  // + éventuellement la période de la TopBar, activable via la case à cocher
  // ci-dessous) : sert de socle à la fois au tableau détaillé et aux KPI par
  // secteur (qui, eux, restent toujours calculés sur la période en cours).
  const baseFiltree = useMemo(() => {
    let rows = secteurFiltre === "tous" ? recettes : recettes.filter((r) => r.secteurId === secteurFiltre);
    if (filtreOrigine) rows = rows.filter((r) => r.origine === filtreOrigine);
    if (respecterPeriode) rows = rows.filter((r) => matchPeriode(r.date, periode));
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      rows = rows.filter(
        (r) => r.origine.toLowerCase().includes(q) || (secteurOf(r.secteurId)?.nom || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [recettes, secteurFiltre, filtreOrigine, recherche, secteurs, respecterPeriode, periode]);

  const list = useMemo(() => [...baseFiltree].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60), [baseFiltree]);
  const totalPeriode = totalMontant(list);

  // KPI de revenu par secteur — une carte par secteur ayant déjà généré du
  // revenu (visible dans le filtre courant), montant du mois en cours — même
  // principe que les cartes de « Sources de revenus » sur la plateforme réelle.
  const kpiParSecteur = useMemo(() => {
    const secteursConnus = new Set(baseFiltree.map((r) => r.secteurId));
    const recettesDuMois = recettes.filter((r) => {
      const dt = new Date(r.date);
      return dt.getFullYear() === periode.annee && dt.getMonth() === periode.mois;
    });
    return [...secteursConnus]
      .map((id) => {
        const s = secteurOf(id);
        const montant = totalMontant(recettesDuMois.filter((r) => r.secteurId === id));
        return { secteur: s || { id, nom: id, color: "#8E8E93" }, montant };
      })
      .sort((a, b) => b.montant - a.montant);
  }, [baseFiltree, recettes, periode, secteurs]);

  // Alertes de dépassement par secteur — même calcul que le Tableau de bord
  // (secteursEnAlerte, seuil 80 %), affiché ici pour croiser revenus encaissés
  // et secteurs qui dépensent au-delà de leur budget alloué.
  const alertes = useMemo(
    () => secteursEnAlerte(secteurs, depenses, budgets, periode.annee, periode.mois),
    [secteurs, depenses, budgets, periode]
  );

  async function submit(e) {
    e.preventDefault();
    if (!form.montant) return;
    setSaving(true);
    setError("");
    const res = await addRecette({ ...form, montant: Number(form.montant) }, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setForm((f) => ({ ...f, montant: "" }));
  }

  return (
    <div>
      <TopBar title="Recettes" subtitle="Suivi des encaissements par secteur d'activité" />

      {/* KPI par secteur — revenu du mois en cours */}
      {kpiParSecteur.length > 0 && (
        <div className="grid grid-cols-3 gap-5 mb-5">
          {kpiParSecteur.map(({ secteur, montant }) => (
            <StatTile key={secteur.id} icon={TrendingUp} label={secteur.nom} value={fmtCompact(montant) + " FCFA"} tone={secteur.color} />
          ))}
        </div>
      )}

      {/* Alertes de dépassement par secteur */}
      {alertes.length > 0 && (
        <GlassCard className="p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-[#FF9F0A]" strokeWidth={2.4} />
            <h3 className="font-bold tracking-tight text-ink">Alertes de dépassement</h3>
            <span className="text-[12.5px] text-ink-soft font-medium">— secteurs ayant franchi le seuil d'attention (80 %)</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {alertes.map((a) => (
              <motion.div
                key={a.id}
                whileHover={{ y: -2 }}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/50 hover:bg-white/75 transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{a.nom}</p>
                  <p className="text-[11.5px] text-ink-soft truncate">{fmtCompact(a.depense)} / {fmtCompact(a.budget)} FCFA</p>
                </div>
                <Badge tone={a.tone}>{Math.round(a.taux * 100)}%</Badge>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Filtres — source, période, + bouton d'ajout (la recherche est dans la TopBar) */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-48">
          <label className="block text-[11.5px] font-semibold text-ink-soft mb-1.5 ml-1">Source</label>
          <Select value={filtreOrigine} onChange={(e) => setFiltreOrigine(e.target.value)}>
            <option value="">Toutes</option>
            {ORIGINES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft mb-2.5 cursor-pointer">
          <input type="checkbox" checked={respecterPeriode} onChange={(e) => setRespecterPeriode(e.target.checked)} className="w-4 h-4 rounded accent-[#0A84FF]" />
          Limiter à la période sélectionnée
        </label>
        <span className="text-[12.5px] text-ink-soft font-medium mb-2.5">{list.length} entrée(s) · {fmtFCFA(totalPeriode)}</span>
        <Button icon={Plus} onClick={() => setOpen(true)} className="ml-auto">Nouvelle recette</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-4 py-3">Secteur</th>
                <th className="px-4 py-3">Origine</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune recette trouvée.</td>
                </tr>
              )}
              {list.map((r, i) => {
                const s = secteurOf(r.secteurId);
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 8) * 0.02 }}
                    onClick={() => setDetail(r)}
                    className="text-[13.5px] hover:bg-white/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: s?.color }} />
                        <span className="font-semibold text-ink">{s?.nom}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ORIGINE_TONE[r.origine] || "ink"}>{r.origine}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-soft tabular">{new Date(r.date).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3 text-right font-bold tabular text-[#1a7d34]">+{fmtFCFA(r.montant)}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <RecetteDetailModal
        recette={detail}
        secteurs={secteurs}
        peutModifier={peutModifier}
        modifierRecette={modifierRecette}
        supprimerRecette={supprimerRecette}
        onClose={() => setDetail(null)}
      />

      {/* Nouvelle recette */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Enregistrer une recette"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button icon={Wallet} onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </>
        }
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Secteur">
            <Select value={form.secteurId} onChange={(e) => setForm({ ...form, secteurId: e.target.value })}>
              {secteurs.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </Select>
          </Field>
          <Field label="Origine">
            <Select value={form.origine} onChange={(e) => setForm({ ...form, origine: e.target.value })}>
              {ORIGINES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant (FCFA)">
              <TextInput type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="180 000" />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
