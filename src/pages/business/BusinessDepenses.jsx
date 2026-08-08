import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Receipt, FileText, FileDown } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import DepenseDetailModal from "../../components/DepenseDetailModal";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { fmtFCFA, statutLabel, evaluationAutorisation, matchPeriode } from "../../lib/logic";
import { exporterDepensesExcel } from "../../lib/exportExcel";
import { ROLES_ACCES_TOTAL } from "../../lib/modules";

export default function BusinessDepenses() {
  const config = useOutletContext();
  const { secteurs, depenses, categories, budgets, addDepense, modifierDepense, supprimerDepense } = useDataStore();
  const { user } = useAuthStore();
  const { periode, recherche } = useUIStore();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [respecterPeriode, setRespecterPeriode] = useState(false);
  const [selection, setSelection] = useState(null);
  const [form, setForm] = useState({ categorie: "", montant: "", date: "2026-07-27", natureFlux: "exploitation", sourceFinancement: "entreprise", description: "" });
  const peutModifier = ROLES_ACCES_TOTAL.includes(user?.role);

  const categoriesDuSecteur = useMemo(
    () => categories.filter((c) => c.secteurId === config.secteurId).map((c) => c.nom),
    [categories, config.secteurId]
  );

  useEffect(() => {
    if (categoriesDuSecteur.length > 0 && !categoriesDuSecteur.includes(form.categorie)) {
      setForm((f) => ({ ...f, categorie: categoriesDuSecteur[0] }));
    }
  }, [categoriesDuSecteur, form.categorie]);

  const toutes = useMemo(
    () => depenses.filter((d) => d.secteurId === config.secteurId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [depenses, config.secteurId]
  );
  const filtrees = useMemo(() => {
    let rows = toutes;
    if (respecterPeriode) rows = rows.filter((d) => matchPeriode(d.date, periode));
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      rows = rows.filter((d) => d.categorie.toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q));
    }
    return rows;
  }, [toutes, respecterPeriode, periode, recherche]);
  const liste = useMemo(() => filtrees.slice(0, 60), [filtrees]);

  async function submit(e) {
    e.preventDefault();
    if (!form.montant) return;
    setSaving(true);
    setError("");
    const res = await addDepense({ ...form, secteurId: config.secteurId, montant: Number(form.montant), piece: "justificatif.pdf" }, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setForm((f) => ({ ...f, montant: "", description: "" }));
  }

  const dateForm = form.date ? new Date(form.date) : new Date();
  const evaluation = evaluationAutorisation(depenses, budgets, config.secteurId, dateForm.getFullYear(), dateForm.getMonth(), Number(form.montant || 0));

  return (
    <div>
      <TopBarSimple title="Dépenses" subtitle={`${config.nom} — saisie des dépenses du secteur`} accent={config.color} />

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft cursor-pointer">
          <input type="checkbox" checked={respecterPeriode} onChange={(e) => setRespecterPeriode(e.target.checked)} className="w-4 h-4 rounded accent-[#0A84FF]" />
          Limiter à la période sélectionnée
        </label>
        <div className="flex gap-2.5 w-full sm:w-auto sm:ml-auto">
          <Button
            variant="ghost"
            icon={FileDown}
            onClick={() => exporterDepensesExcel(filtrees, [{ id: config.secteurId, nom: config.nom }], `depenses-${config.secteurId}`)}
            className="flex-1 sm:flex-none"
          >
            Exporter Excel
          </Button>
          <Button icon={Plus} onClick={() => setOpen(true)} className="flex-1 sm:flex-none">Nouvelle dépense</Button>
        </div>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <div className="max-h-[calc(100vh-260px)] overflow-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3">Nature</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {liste.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune dépense pour ce secteur.</td>
                  </tr>
                )}
                {liste.map((d, i) => {
                  const st = statutLabel(d.statut);
                  return (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i, 8) * 0.02 }}
                      onClick={() => setSelection(d)}
                      className="text-[13.5px] hover:bg-white/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-semibold text-ink">{d.categorie}</td>
                      <td className="px-4 py-3 text-ink-soft tabular">{new Date(d.date).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right font-bold tabular text-ink">{fmtFCFA(d.montant)}</td>
                      <td className="px-4 py-3 capitalize text-ink-soft">{d.natureFlux}</td>
                      <td className="px-4 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Enregistrer une dépense"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button icon={Receipt} onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </>
        }
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Catégorie">
            <Select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
              {categoriesDuSecteur.length === 0 && <option value="">Aucune catégorie configurée pour ce secteur</option>}
              {categoriesDuSecteur.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Montant (FCFA)">
              <TextInput type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="35 000" />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nature du flux">
              <Select value={form.natureFlux} onChange={(e) => setForm({ ...form, natureFlux: e.target.value })}>
                <option value="exploitation">Exploitation</option>
                <option value="investissement">Investissement</option>
                <option value="perte">Perte</option>
              </Select>
            </Field>
            <Field label="Source de financement">
              <Select value={form.sourceFinancement} onChange={(e) => setForm({ ...form, sourceFinancement: e.target.value })}>
                <option value="entreprise">Entreprise</option>
                <option value="pau">PAU</option>
              </Select>
            </Field>
          </div>
          <Field label="Motif">
            <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Motif de la dépense" />
          </Field>
          <div className="flex items-center gap-2 text-[12.5px] font-medium px-3.5 py-2.5 rounded-2xl bg-black/[0.03] text-ink-soft">
            <FileText size={14} strokeWidth={2.2} className="shrink-0" />
            {evaluation.declenche
              ? evaluation.budget === 0
                ? "Aucun budget défini pour ce secteur ce mois-ci — cette dépense déclenchera automatiquement le circuit d'autorisation d'E-DÉPENSES (PAU et GE en seront notifiés)."
                : `Ce montant dépasserait le budget restant du secteur (${fmtFCFA(evaluation.restant)} sur ${fmtFCFA(evaluation.budget)}) — le circuit d'autorisation d'E-DÉPENSES sera déclenché, PAU et GE en seront notifiés.`
              : `Ce montant reste dans le budget alloué (${fmtFCFA(evaluation.restant)} restant sur ${fmtFCFA(evaluation.budget)}) — décaissement direct.`}
          </div>
        </form>
      </Modal>

      <DepenseDetailModal
        depense={selection}
        secteurs={secteurs}
        categories={categories}
        peutModifier={peutModifier}
        modifierDepense={modifierDepense}
        supprimerDepense={supprimerDepense}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}
