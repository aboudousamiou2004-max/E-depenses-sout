import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import RecetteDetailModal from "../../components/RecetteDetailModal";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { useStockStore } from "../../store/stockStore";
import { useUIStore } from "../../store/uiStore";
import { fmtFCFA, fmtCompact, totalMontant, matchPeriode } from "../../lib/logic";
import { ROLES_ACCES_TOTAL } from "../../lib/modules";

export default function BusinessFacturation() {
  const config = useOutletContext();
  const { secteurs, recettes, addRecette, modifierRecette, supprimerRecette } = useDataStore();
  const { user } = useAuthStore();
  const { typesBriques, stockBriques, venteBriques } = useStockStore();
  const { periode, recherche } = useUIStore();
  const venteDeBriques = config.stock === "briques";
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [respecterPeriode, setRespecterPeriode] = useState(false);
  const [selection, setSelection] = useState(null);
  const peutModifier = ROLES_ACCES_TOTAL.includes(user?.role);

  const [form, setForm] = useState({
    type: config.typesFacturation[0],
    client: "",
    description: "",
    montant: "",
    date: "2026-07-27",
    briqueTypeId: typesBriques[0]?.id,
    briqueQuantite: "",
  });

  const isVenteBriques = venteDeBriques && form.type === "Vente de briques";
  const briqueChoisie = typesBriques.find((t) => t.id === form.briqueTypeId);
  const stockDispoBrique = briqueChoisie ? stockBriques[briqueChoisie.id]?.pret || 0 : 0;

  const liste = useMemo(() => {
    let rows = recettes.filter((r) => r.secteurId === config.secteurId).sort((a, b) => (a.date < b.date ? 1 : -1));
    if (respecterPeriode) rows = rows.filter((r) => matchPeriode(r.date, periode));
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      rows = rows.filter((r) => r.origine.toLowerCase().includes(q));
    }
    return rows.slice(0, 60);
  }, [recettes, config.secteurId, respecterPeriode, periode, recherche]);
  const total = totalMontant(liste);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    if (isVenteBriques) {
      const qte = Math.min(Number(form.briqueQuantite) || 0, stockDispoBrique);
      if (qte <= 0) {
        setSaving(false);
        return;
      }
      const montant = qte * (briqueChoisie?.tarifVente || 0);
      const res = await addRecette(
        { secteurId: config.secteurId, montant, date: form.date, origine: `${form.type} — ${briqueChoisie?.nom}`, client: form.client, description: form.description },
        user
      );
      if (!res.ok) {
        setSaving(false);
        return setError(res.error);
      }
      const resVente = await venteBriques(briqueChoisie.id, qte, user);
      setSaving(false);
      if (!resVente.ok) return setError(resVente.error);
    } else {
      if (!form.montant) {
        setSaving(false);
        return;
      }
      const res = await addRecette(
        { secteurId: config.secteurId, montant: Number(form.montant), date: form.date, origine: form.type, client: form.client, description: form.description },
        user
      );
      setSaving(false);
      if (!res.ok) return setError(res.error);
    }
    setOpen(false);
    setForm((f) => ({ ...f, montant: "", client: "", description: "", briqueQuantite: "" }));
  }

  return (
    <div>
      <TopBarSimple title="Facturation" subtitle={`${config.nom} — prestations et locations facturées`} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        <StatTile icon={FileText} label="Total facturé (affiché)" value={fmtCompact(total) + " FCFA"} tone={config.color} />
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft cursor-pointer">
          <input type="checkbox" checked={respecterPeriode} onChange={(e) => setRespecterPeriode(e.target.checked)} className="w-4 h-4 rounded accent-[#0A84FF]" />
          Limiter à la période sélectionnée
        </label>
        <Button icon={Plus} onClick={() => setOpen(true)} style={{ background: config.color }} className="w-full sm:w-auto sm:ml-auto">
          Nouvelle facture
        </Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {liste.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune facture pour ce secteur.</td>
                </tr>
              )}
              {liste.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 8) * 0.02 }}
                  onClick={() => setSelection(r)}
                  className="text-[13.5px] hover:bg-white/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: `${config.color}1f`, color: config.color }}>
                      {r.origine}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{r.client || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft tabular">{new Date(r.date).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right font-bold tabular text-[#1a7d34]">+{fmtFCFA(r.montant)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle facture"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button icon={FileText} onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </>
        }
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {config.typesFacturation.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Client">
            <TextInput value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Nom du client" />
          </Field>

          {isVenteBriques ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Type de brique">
                  <Select value={form.briqueTypeId} onChange={(e) => setForm({ ...form, briqueTypeId: e.target.value })}>
                    {typesBriques.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                  </Select>
                </Field>
                <Field label={`Quantité (stock prêt : ${stockDispoBrique})`}>
                  <TextInput type="number" value={form.briqueQuantite} onChange={(e) => setForm({ ...form, briqueQuantite: e.target.value })} placeholder="500" />
                </Field>
              </div>
              {Number(form.briqueQuantite) > stockDispoBrique && (
                <p className="text-[12px] text-[#b3241b] -mt-2 mb-3">Quantité limitée au stock prêt disponible ({stockDispoBrique}).</p>
              )}
              <p className="text-[12.5px] text-ink-soft -mt-1 mb-3">
                Montant estimé : <span className="font-bold text-ink">{fmtFCFA(Math.min(Number(form.briqueQuantite) || 0, stockDispoBrique) * (briqueChoisie?.tarifVente || 0))}</span>
              </p>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Montant (FCFA)">
                <TextInput type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="150 000" />
              </Field>
              <Field label="Date">
                <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
            </div>
          )}
          {isVenteBriques && (
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          )}
          <Field label="Description">
            <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Détail de la prestation" />
          </Field>
          <p className="text-[12px] text-ink-soft">Cette facture sera comptée comme une recette du secteur {config.nom}, visible aussi dans E-DÉPENSES.</p>
        </form>
      </Modal>

      <RecetteDetailModal
        recette={selection}
        secteurs={secteurs}
        peutModifier={peutModifier}
        modifierRecette={modifierRecette}
        supprimerRecette={supprimerRecette}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}
