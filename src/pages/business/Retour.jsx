import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput } from "../../components/ui/Field";
import Badge from "../../components/ui/Badge";
import { useStockStore } from "../../store/stockStore";
import { useAuthStore } from "../../store/authStore";

const RETOUR_TONE = { retour_ok: "mint", retour_casse: "coral", retour_perdu: "amber" };
const RETOUR_LABEL = { retour_ok: "Bon état", retour_casse: "Cassé", retour_perdu: "Perdu" };

// Retour matériel MAXI LOGISTIQUE — valide les retours de matériel sorti
// (loué ou envoyé sur chantier) et permet de déclarer une partie cassée ou
// perdue, à la demande explicite de l'utilisateur (2026-08-18). Porté du
// principe de termitiere-platform/src/modules/logistique/Retours.jsx :
// les retours ne se saisissent plus depuis Stock magasin (« Nouveau
// mouvement » n'y propose plus qu'achat/sortie), uniquement ici.
//
// « En attente de retour » par article = sorties cumulées − retours
// cumulés (OK + cassé + perdu, qui closent tous une sortie). Ce projet ne
// garde pas de lien direct entre une sortie précise et son retour (pas de
// numéro de prestation comme sur la plateforme) — approximation assumée,
// suffisante pour savoir combien reste dehors par article.
export default function Retour() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { referentielMateriel, mouvementsMateriel, addMouvementMateriel } = useStockStore();

  const [modal, setModal] = useState(null); // { article, enAttente }
  const [form, setForm] = useState({ ok: "", casse: "", perdu: "", motif: "", date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const enAttente = useMemo(() => {
    return referentielMateriel.map((a) => {
      const mvts = mouvementsMateriel.filter((m) => m.articleId === a.id);
      const sorties = mvts.filter((m) => m.type === "sortie").reduce((s, m) => s + m.quantite, 0);
      const retours = mvts.filter((m) => m.type.startsWith("retour_")).reduce((s, m) => s + m.quantite, 0);
      return { ...a, sorties, retours, reste: Math.max(0, sorties - retours) };
    }).filter((a) => a.reste > 0).sort((a, b) => b.reste - a.reste);
  }, [referentielMateriel, mouvementsMateriel]);

  const historique = useMemo(
    () => mouvementsMateriel.filter((m) => m.type.startsWith("retour_")).slice(0, 30),
    [mouvementsMateriel]
  );

  function ouvrir(article) {
    setModal(article);
    setForm({ ok: "", casse: "", perdu: "", motif: "", date: new Date().toISOString().slice(0, 10) });
    setError("");
  }

  const totalSaisi = (Number(form.ok) || 0) + (Number(form.casse) || 0) + (Number(form.perdu) || 0);

  async function valider() {
    if (totalSaisi <= 0) return setError("Renseignez au moins une quantité");
    if (totalSaisi > modal.reste) return setError(`Le total (${totalSaisi}) dépasse la quantité en attente (${modal.reste})`);
    setSaving(true);
    setError("");
    const lignes = [
      ["retour_ok", Number(form.ok) || 0],
      ["retour_casse", Number(form.casse) || 0],
      ["retour_perdu", Number(form.perdu) || 0],
    ].filter(([, qte]) => qte > 0);
    for (const [type, quantite] of lignes) {
      const res = await addMouvementMateriel({ articleId: modal.id, type, quantite, motif: form.motif, date: form.date }, user);
      if (!res.ok) {
        setSaving(false);
        return setError(res.error);
      }
    }
    setSaving(false);
    setModal(null);
  }

  return (
    <div>
      <TopBarSimple title="Retour" subtitle={`${config.nom} — validation des retours de matériel, casse et pertes`} icon={RotateCcw} accent={config.color} />

      <GlassCard className="p-2 overflow-hidden mb-5" hover={false}>
        <p className="font-bold tracking-tight text-ink px-3 pt-3 mb-1">En attente de retour</p>
        <p className="px-3 pb-2 text-[11px] text-ink-soft/60">Matériel sorti dont le retour n'a pas encore été enregistré.</p>
        {enAttente.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-soft/60">
            <CheckCircle2 size={22} className="inline-block mb-1.5 opacity-40" /><br />Aucun retour en attente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="text-left text-[11px] font-bold text-ink-soft/70 uppercase tracking-wide">
                  <th className="px-3 py-2">Article</th>
                  <th className="px-2 py-2 text-center">Sorti (cumul)</th>
                  <th className="px-2 py-2 text-center">Déjà retourné</th>
                  <th className="px-2 py-2 text-center">En attente</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {enAttente.map((a) => (
                  <tr key={a.id} className="text-[13px] hover:bg-white/50 transition-colors">
                    <td className="px-3 py-2 font-semibold text-ink">{a.nom}</td>
                    <td className="px-2 py-2 text-center tabular text-ink-soft">{a.sorties}</td>
                    <td className="px-2 py-2 text-center tabular text-ink-soft">{a.retours}</td>
                    <td className="px-2 py-2 text-center tabular font-bold" style={{ color: config.color }}>{a.reste} {a.unite}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" onClick={() => ouvrir(a)}>Enregistrer un retour</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <p className="font-bold tracking-tight text-ink px-3 pt-3 mb-1">Historique des retours</p>
        {historique.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-soft/60">Aucun retour enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="text-left text-[11px] font-bold text-ink-soft/70 uppercase tracking-wide">
                  <th className="px-3 py-2">Article</th>
                  <th className="px-2 py-2 text-center">État</th>
                  <th className="px-2 py-2 text-center">Qté</th>
                  <th className="px-3 py-2">Motif</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {historique.map((m) => {
                  const article = referentielMateriel.find((a) => a.id === m.articleId);
                  return (
                    <tr key={m.id} className="text-[13px]">
                      <td className="px-3 py-2 font-semibold text-ink">{article?.nom || "—"}</td>
                      <td className="px-2 py-2 text-center"><Badge tone={RETOUR_TONE[m.type]}>{RETOUR_LABEL[m.type]}</Badge></td>
                      <td className="px-2 py-2 text-center tabular">{m.quantite}</td>
                      <td className="px-3 py-2 text-ink-soft">{m.motif || "—"}</td>
                      <td className="px-3 py-2 text-ink-soft tabular whitespace-nowrap">{new Date(m.date).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? `Retour — ${modal.nom}` : ""}
        icon={RotateCcw}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={valider} disabled={saving}>{saving ? "Enregistrement…" : "Valider le retour"}</Button></>}
      >
        {modal && (
          <>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <p className="text-[12.5px] text-ink-soft mb-3">Quantité en attente : <strong className="text-ink">{modal.reste} {modal.unite}</strong></p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Bon état">
                <TextInput type="number" min="0" value={form.ok} onChange={(e) => setForm({ ...form, ok: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Cassé">
                <TextInput type="number" min="0" value={form.casse} onChange={(e) => setForm({ ...form, casse: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Perdu">
                <TextInput type="number" min="0" value={form.perdu} onChange={(e) => setForm({ ...form, perdu: e.target.value })} placeholder="0" />
              </Field>
            </div>
            {totalSaisi > 0 && (
              <p className={`text-[12px] mt-2 ${totalSaisi > modal.reste ? "text-[#b3241b]" : "text-ink-soft"}`}>
                Total : {totalSaisi} / {modal.reste} {modal.unite}
              </p>
            )}
            {(Number(form.casse) > 0 || Number(form.perdu) > 0) && (
              <p className="flex items-center gap-1.5 text-[12px] text-[#93400a] bg-[#FF9F0A1a] rounded-xl px-3 py-2 mt-2">
                <AlertTriangle size={13} /> La casse/perte est comptée comme une perte de capital (visible dans Analyses).
              </p>
            )}
            <Field label="Motif (optionnel)">
              <TextInput value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Ex : retour chantier client X" />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </>
        )}
      </Modal>
    </div>
  );
}
