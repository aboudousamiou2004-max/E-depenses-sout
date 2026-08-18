import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Receipt, FileText, FileDown, Paperclip, Layers, RefreshCw } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Field, { TextInput, Select } from "../components/ui/Field";
import DepenseDetailModal from "../components/DepenseDetailModal";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { fmtFCFA, statutLabel, evaluationAutorisation, matchPeriode, SEUIL_APPROBATION_FIXE } from "../lib/logic";
import { exporterDepensesExcel } from "../lib/exportExcel";
import { exporterDepensesPDF, exporterDepensesCSV } from "../lib/exportDocs";
import { lireFichier, formatTaille } from "../lib/fichiers";
import { ROLES_ACCES_TOTAL } from "../lib/modules";

const ligneVide = () => ({ secteurId: "", categorie: "", montant: "", date: new Date().toISOString().slice(0, 10), natureFlux: "exploitation", sourceFinancement: "entreprise", description: "", imprevue: false });

export default function Depenses() {
  const { secteurs, depenses, categories, budgets, addDepense, modifierDepense, supprimerDepense, reconduireDepenses } = useDataStore();
  const { secteurFiltre, periode, recherche } = useUIStore();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [respecterPeriode, setRespecterPeriode] = useState(false);
  const [selection, setSelection] = useState(null);
  const [form, setForm] = useState({ secteurId: "", categorie: "", montant: "", date: "2026-07-27", natureFlux: "exploitation", sourceFinancement: "entreprise", description: "", beneficiaireNom: "", imprevue: false, recurrente: false, piece: null });
  const [uploading, setUploading] = useState(false);
  const [lot, setLot] = useState(null);
  const [savingLot, setSavingLot] = useState(false);
  const [reconduisant, setReconduisant] = useState(false);
  // Mêmes rôles que le circuit d'autorisation (is_approbateur côté RLS) — un
  // agent peut soumettre une dépense mais pas la modifier/effacer après coup.
  const peutModifier = ROLES_ACCES_TOTAL.includes(user?.role);

  const categoriesDuSecteur = useMemo(
    () => categories.filter((c) => c.secteurId === form.secteurId).map((c) => c.nom),
    [categories, form.secteurId]
  );

  // `secteurs` se charge de façon asynchrone (Supabase) — vide au premier
  // rendu, donc on ne peut pas présélectionner secteurs[0] dans l'état initial.
  useEffect(() => {
    if (!form.secteurId && secteurs.length > 0) setForm((f) => ({ ...f, secteurId: secteurs[0].id }));
  }, [secteurs, form.secteurId]);

  // La catégorie sélectionnée doit rester cohérente avec le secteur choisi —
  // les catégories sont désormais propres à chaque secteur (voir Paramètres).
  useEffect(() => {
    if (categoriesDuSecteur.length > 0 && !categoriesDuSecteur.includes(form.categorie)) {
      setForm((f) => ({ ...f, categorie: categoriesDuSecteur[0] }));
    }
  }, [categoriesDuSecteur, form.categorie]);

  const filtrees = useMemo(() => {
    let rows = secteurFiltre === "tous" ? depenses : depenses.filter((d) => d.secteurId === secteurFiltre);
    if (respecterPeriode) rows = rows.filter((d) => matchPeriode(d.date, periode));
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      rows = rows.filter((d) => d.categorie.toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q));
    }
    return rows;
  }, [depenses, secteurFiltre, respecterPeriode, periode, recherche]);
  const list = useMemo(() => [...filtrees].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60), [filtrees]);

  function secteurOf(id) {
    return secteurs.find((s) => s.id === id);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.montant) return;
    setSaving(true);
    setError("");
    const res = await addDepense({ ...form, montant: Number(form.montant) }, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setForm((f) => ({ ...f, montant: "", description: "", beneficiaireNom: "", imprevue: false, recurrente: false, piece: null }));
  }

  async function handlePieceChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const piece = await lireFichier(file);
      setForm((f) => ({ ...f, piece }));
    } catch (err) {
      setError(err.message || "Fichier illisible");
    } finally {
      setUploading(false);
    }
  }

  // Reconduit les dépenses récurrentes du mois précédent dans le mois courant.
  async function handleReconduire() {
    setReconduisant(true);
    const res = await reconduireDepenses(user);
    setReconduisant(false);
    alert(res.ok ? `${res.nb} dépense(s) récurrente(s) reconduite(s) ✓` : res.error || "Échec de la reconduction");
  }

  // ── Ajout multiple (lot) ──
  function openLot() { setLot([ligneVide(), ligneVide(), ligneVide()]); }
  const setLigneLot = (i, k, v) => setLot((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const ajouterLigneLot = () => setLot((rows) => [...rows, ligneVide()]);
  const retirerLigneLot = (i) => setLot((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));

  async function enregistrerLot() {
    const valides = (lot || []).filter((r) => r.secteurId && r.categorie && Number(r.montant) > 0 && r.date);
    if (valides.length === 0) return;
    setSavingLot(true);
    let nb = 0;
    let derniereErreur = "";
    for (const r of valides) {
      const res = await addDepense({ ...r, montant: Number(r.montant) }, user);
      if (res.ok) nb++;
      else derniereErreur = res.error;
    }
    setSavingLot(false);
    setLot(null);
    alert(derniereErreur ? `${nb} dépense(s) enregistrée(s), ${valides.length - nb} échec(s) : ${derniereErreur}` : `${nb} dépense(s) enregistrée(s) ✓`);
  }

  const montantNum = Number(form.montant || 0);
  const dateForm = form.date ? new Date(form.date) : new Date();
  const evaluation = evaluationAutorisation(depenses, budgets, form.secteurId, dateForm.getFullYear(), dateForm.getMonth(), montantNum, form.imprevue);

  return (
    <div>
      <TopBar title="Dépenses" subtitle="Saisie et suivi des dépenses par secteur d'activité" icon={Receipt} accent="#FF453A" />

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft cursor-pointer">
          <input type="checkbox" checked={respecterPeriode} onChange={(e) => setRespecterPeriode(e.target.checked)} className="w-4 h-4 rounded accent-[#0A84FF]" />
          Limiter à la période sélectionnée
        </label>
        <span className="text-[12.5px] text-ink-soft font-medium">{list.length} entrée(s)</span>
        <div className="flex gap-2.5 w-full flex-wrap sm:w-auto sm:ml-auto">
          <Button variant="ghost" icon={FileDown} onClick={() => exporterDepensesExcel(filtrees, secteurs, "depenses-e-depenses")} className="flex-1 sm:flex-none">
            Excel
          </Button>
          <Button variant="ghost" icon={FileText} onClick={() => exporterDepensesPDF(filtrees, secteurs, "depenses-e-depenses")} className="flex-1 sm:flex-none">
            PDF
          </Button>
          <Button variant="ghost" icon={FileDown} onClick={() => exporterDepensesCSV(filtrees, secteurs, "depenses-e-depenses")} className="flex-1 sm:flex-none">
            CSV
          </Button>
          <Button variant="ghost" icon={RefreshCw} onClick={handleReconduire} disabled={reconduisant} className="flex-1 sm:flex-none">
            {reconduisant ? "Reconduction…" : "Reconduire les récurrentes"}
          </Button>
          <Button variant="ghost" icon={Layers} onClick={openLot} className="flex-1 sm:flex-none">Ajout multiple</Button>
          <Button icon={Plus} onClick={() => setOpen(true)} className="flex-1 sm:flex-none">Nouvelle dépense</Button>
        </div>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <div className="max-h-[calc(100vh-230px)] overflow-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-4 py-3">Secteur</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3">Nature</th>
                <th className="px-4 py-3">Bénéficiaire</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {list.map((d, i) => {
                  const s = secteurOf(d.secteurId);
                  const st = statutLabel(d.statut);
                  return (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i, 8) * 0.02 }}
                      onClick={() => setSelection(d)}
                      className="text-[13.5px] hover:bg-white/50 rounded-2xl transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: s?.color }} />
                          <span className="font-semibold text-ink">{s?.nom}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {d.categorie}
                        {d.imprevue && <span className="ml-1.5 text-[10px] font-bold text-[#FF9F0A]" title="Dépense imprévue">⚠</span>}
                        {d.recurrente && <span className="ml-1 text-[10px] font-bold text-[#5E5CE6]" title="Dépense récurrente">🔁</span>}
                        {d.piece && <Paperclip size={11} className="inline ml-1 text-ink-soft/70" />}
                      </td>
                      <td className="px-4 py-3 text-ink-soft tabular">{new Date(d.date).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right font-bold tabular text-ink">{fmtFCFA(d.montant)}</td>
                      <td className="px-4 py-3 capitalize text-ink-soft">{d.natureFlux}</td>
                      <td className="px-4 py-3 text-ink-soft">{d.beneficiaireNom || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
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
          <Field label="Secteur">
            <Select value={form.secteurId} onChange={(e) => setForm({ ...form, secteurId: e.target.value })}>
              {secteurs.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </Select>
          </Field>
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
          <Field label="Bénéficiaire" hint="Optionnel — qui reçoit l'argent">
            <TextInput value={form.beneficiaireNom} onChange={(e) => setForm({ ...form, beneficiaireNom: e.target.value })} placeholder="ex : Kofi Adjovi" />
          </Field>

          <Field label="Type de dépense">
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, imprevue: false })}
                className={`flex-1 rounded-2xl border px-3 py-2 text-[12.5px] font-semibold transition-colors ${!form.imprevue ? "border-[#0A84FF] bg-[#0A84FF1a] text-[#0A84FF]" : "border-black/10 text-ink-soft"}`}>
                Prévue
              </button>
              <button type="button" onClick={() => setForm({ ...form, imprevue: true })}
                className={`flex-1 rounded-2xl border px-3 py-2 text-[12.5px] font-semibold transition-colors ${form.imprevue ? "border-[#FF9F0A] bg-[#FF9F0A1a] text-[#FF9F0A]" : "border-black/10 text-ink-soft"}`}>
                Imprévue
              </button>
            </div>
          </Field>

          <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-soft cursor-pointer mb-3.5">
            <input type="checkbox" checked={form.recurrente} onChange={(e) => setForm({ ...form, recurrente: e.target.checked })} className="w-4 h-4 rounded accent-[#5E5CE6]" />
            🔁 Dépense récurrente (à reconduire chaque mois)
          </label>

          <Field label="Justificatif" hint="Photo ou PDF, optionnel">
            {form.piece ? (
              <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-[13px]">
                <span className="flex items-center gap-1.5 text-ink"><Paperclip size={14} /> {form.piece.nom} <span className="text-[11px] text-ink-soft">({formatTaille(form.piece.taille)})</span></span>
                <button type="button" onClick={() => setForm({ ...form, piece: null })} className="text-[11px] text-[#FF453A] hover:underline">Retirer</button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-3.5 py-3 text-[13px] text-ink-soft cursor-pointer hover:bg-black/[0.04]">
                <Paperclip size={15} /> {uploading ? "Chargement…" : "Ajouter un justificatif"}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handlePieceChange} disabled={uploading} />
              </label>
            )}
          </Field>

          <div className="flex items-center gap-2 text-[12.5px] font-medium px-3.5 py-2.5 rounded-2xl bg-black/[0.03] text-ink-soft">
            <FileText size={14} strokeWidth={2.2} className="shrink-0" />
            {evaluation.declenche
              ? evaluation.imprevue
                ? "Dépense marquée imprévue — le circuit d'autorisation sera déclenché, PAU et GE en seront notifiés."
                : evaluation.depasseSeuil
                  ? `Ce montant dépasse le seuil de ${fmtFCFA(SEUIL_APPROBATION_FIXE)} — le circuit d'autorisation sera déclenché, PAU et GE en seront notifiés.`
                  : evaluation.budget === 0
                    ? "Aucun budget défini pour ce secteur ce mois-ci — cette dépense déclenchera automatiquement le circuit d'autorisation (PAU et GE en seront notifiés)."
                    : `Ce montant dépasserait le budget restant du secteur (${fmtFCFA(evaluation.restant)} sur ${fmtFCFA(evaluation.budget)}) — le circuit d'autorisation sera déclenché, PAU et GE en seront notifiés.`
              : `Ce montant reste dans le budget alloué (${fmtFCFA(evaluation.restant)} restant sur ${fmtFCFA(evaluation.budget)}) — décaissement direct.`}
          </div>
        </form>
      </Modal>

      {/* Modal ajout multiple (lot) */}
      <Modal
        open={!!lot}
        onClose={() => setLot(null)}
        title="Ajouter plusieurs dépenses d'un coup"
        footer={lot && (() => {
          const completes = lot.filter((r) => r.secteurId && r.categorie && Number(r.montant) > 0 && r.date);
          const totalLot = completes.reduce((s, r) => s + Number(r.montant), 0);
          return (
            <>
              <span className="mr-auto text-[11.5px] text-ink-soft">{completes.length} ligne(s) prête(s) · <strong className="text-ink">{fmtFCFA(totalLot)}</strong></span>
              <Button variant="ghost" onClick={() => setLot(null)} disabled={savingLot}>Annuler</Button>
              <Button onClick={enregistrerLot} disabled={savingLot || completes.length === 0}>{savingLot ? "Enregistrement…" : "Enregistrer tout"}</Button>
            </>
          );
        })()}
      >
        {lot && (
          <div className="space-y-2.5">
            <p className="text-[12px] text-ink-soft bg-black/[0.03] rounded-2xl px-3 py-2">
              Renseignez chaque ligne (secteur, catégorie, montant, date). Les lignes incomplètes sont ignorées.
            </p>
            {lot.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-2xl border border-black/5 bg-white/60 p-2.5 sm:grid-cols-12 sm:items-center">
                <div className="sm:col-span-3">
                  <Select value={r.secteurId} onChange={(e) => setLigneLot(i, "secteurId", e.target.value)}>
                    <option value="">— Secteur —</option>
                    {secteurs.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Select value={r.categorie} onChange={(e) => setLigneLot(i, "categorie", e.target.value)}>
                    <option value="">— Catégorie —</option>
                    {categories.filter((c) => c.secteurId === r.secteurId).map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <TextInput type="number" min="0" value={r.montant} onChange={(e) => setLigneLot(i, "montant", e.target.value)} placeholder="Montant" />
                </div>
                <div className="sm:col-span-2">
                  <TextInput type="date" value={r.date} onChange={(e) => setLigneLot(i, "date", e.target.value)} />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <TextInput value={r.description} onChange={(e) => setLigneLot(i, "description", e.target.value)} placeholder="Motif (optionnel)" />
                </div>
                <div className="flex items-center justify-between gap-1 sm:col-span-1">
                  <label className="flex items-center gap-1 text-[10px] text-ink-soft" title="Dépense imprévue">
                    <input type="checkbox" checked={r.imprevue} onChange={(e) => setLigneLot(i, "imprevue", e.target.checked)} />
                    Imprévue
                  </label>
                  <button type="button" onClick={() => retirerLigneLot(i)} disabled={lot.length <= 1} className="text-[#FF453A] disabled:opacity-30 text-[11px]">✕</button>
                </div>
              </div>
            ))}
            <Button variant="ghost" icon={Plus} onClick={ajouterLigneLot}>Ajouter une ligne</Button>
          </div>
        )}
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
