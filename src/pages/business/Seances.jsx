import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Ticket, Plus, Pencil, Trash2 } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput } from "../../components/ui/Field";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { useGymStore, niveauLabel } from "../../store/gymStore";
import { peutModifier, peutSupprimer } from "../../lib/modules";
import { fmtFCFA, fmtCompact, totalMontant } from "../../lib/logic";
import ConfirmSuppressionModal from "../../components/ui/ConfirmSuppressionModal";
import { enregistrerMotifSuppression } from "../../lib/motifSuppression";

const VIDE = { forfaitNiveau: "simple", client: "", montant: "", date: new Date().toISOString().slice(0, 10), note: "" };

// Séances — volet spécifique à MAXI GYM : liste ET saisie des séances
// facturées à l'unité (remplace « Prestations », masqué pour ce secteur —
// la facturation gym passe uniquement par ici et par Abonnements). Chaque
// séance crée une recette du secteur, exactement comme depuis Prestations.
export default function Seances() {
  const config = useOutletContext();
  const { recettes, addRecette, modifierRecette, supprimerRecette } = useDataStore();
  const { user } = useAuthStore();
  const { forfaits, chargerForfaits } = useGymStore();
  const modifierOk = peutModifier(user?.role);
  const supprimerOk = peutSupprimer(user?.role);
  const [modal, setModal] = useState(null); // { id, data } | null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmCible, setConfirmCible] = useState(null);

  useEffect(() => { chargerForfaits(config.secteurId); }, [config.secteurId]);

  const liste = useMemo(
    () => recettes.filter((r) => r.secteurId === config.secteurId && r.origine.startsWith("Séance")).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [recettes, config.secteurId]
  );
  const total = totalMontant(liste);

  const forfaitChoisi = forfaits.find((f) => f.niveau === modal?.data.forfaitNiveau);
  const prixLibre = modal?.id ? true : forfaitChoisi && (forfaitChoisi.prixSeance === null || !forfaitChoisi.seanceProposee);

  function ouvrirCreation() {
    setModal({ id: null, data: { ...VIDE, forfaitNiveau: forfaits.find((f) => f.seanceProposee)?.niveau || "simple" } });
    setError("");
  }
  function ouvrirEdition(r) {
    const niveau = forfaits.find((f) => niveauLabel(f.niveau) === r.origine.replace("Séance : ", ""))?.niveau || "simple";
    setModal({ id: r.id, data: { forfaitNiveau: niveau, client: r.client, montant: String(r.montant), date: r.date } });
    setError("");
  }

  async function enregistrer() {
    const montant = prixLibre ? Number(modal.data.montant) || 0 : Number(forfaitChoisi?.prixSeance) || 0;
    if (montant <= 0) return setError("Montant requis");
    setSaving(true);
    setError("");
    const res = modal.id
      ? await modifierRecette(modal.id, { secteurId: config.secteurId, montant, date: modal.data.date, origine: `Séance : ${niveauLabel(modal.data.forfaitNiveau)}` })
      : await addRecette({ secteurId: config.secteurId, montant, date: modal.data.date, origine: `Séance : ${niveauLabel(modal.data.forfaitNiveau)}`, client: modal.data.client, description: modal.data.note }, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function confirmerSuppression(motif) {
    const r = confirmCible;
    await enregistrerMotifSuppression({ user, table: "recettes", label: `Séance : ${fmtFCFA(r.montant)}`, motif, secteurId: config.secteurId });
    return supprimerRecette(r.id);
  }

  return (
    <div>
      <TopBarSimple title="Séances" subtitle={`${config.nom} : séances facturées à l'unité`} icon={Ticket} accent={config.color} />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatTile icon={Ticket} label="Séances enregistrées" value={String(liste.length)} tone={config.color} />
        <StatTile icon={Ticket} label="Total facturé" value={fmtCompact(total) + " FCFA"} tone="#8E8E93" />
      </div>

      <div className="flex justify-end mb-4">
        <Button icon={Plus} onClick={ouvrirCreation} style={{ background: config.color }}>Nouvelle séance</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Forfait</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3 text-right">Montant</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune séance enregistrée.</td></tr>}
            {liste.map((r) => (
              <tr key={r.id} className="text-[13px]">
                <td className="px-3 py-2.5 font-semibold text-ink">{r.origine.replace("Séance : ", "")}</td>
                <td className="px-3 py-2.5 text-ink-soft">{r.client || "—"}</td>
                <td className="px-3 py-2.5 text-ink-soft tabular">{new Date(r.date).toLocaleDateString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-right tabular font-bold text-[#1a7d34]">+{fmtFCFA(r.montant)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {modifierOk && <button onClick={() => ouvrirEdition(r)} className="text-ink-soft hover:text-ink"><Pencil size={14} /></button>}
                    {supprimerOk && <button onClick={() => setConfirmCible(r)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Modifier la séance" : "Nouvelle séance"}
        icon={Ticket}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {modal && (
          <form onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Catégorie">
              <div className="flex gap-2">
                {(modal.id ? forfaits : forfaits.filter((f) => f.seanceProposee)).map((f) => (
                  <button key={f.niveau} type="button" onClick={() => setModal((m) => ({ ...m, data: { ...m.data, forfaitNiveau: f.niveau } }))}
                    className={`flex-1 rounded-2xl border px-3 py-2.5 text-[13px] font-bold transition-colors ${modal.data.forfaitNiveau === f.niveau ? "text-white" : "border-black/10 text-ink-soft"}`}
                    style={modal.data.forfaitNiveau === f.niveau ? { borderColor: config.color, background: config.color } : undefined}
                  >
                    {niveauLabel(f.niveau)}
                  </button>
                ))}
              </div>
              {forfaitChoisi?.description && <p className="mt-1.5 text-[11.5px] text-ink-soft">{forfaitChoisi.description}</p>}
            </Field>
            {!modal.id && forfaitChoisi && !forfaitChoisi.seanceProposee && (
              <p className="text-[12px] text-[#b3241b] -mt-2 mb-3">Ce forfait ne propose pas de séance à l'unité : le montant reste à saisir librement, ou changez de forfait.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {prixLibre ? (
                <Field label="Montant (FCFA)"><TextInput type="number" min="0" value={modal.data.montant} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, montant: e.target.value } }))} /></Field>
              ) : (
                <Field label="Montant"><p className="glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] font-bold text-ink">{fmtFCFA(forfaitChoisi?.prixSeance || 0)}</p></Field>
              )}
              <Field label="Date"><TextInput type="date" value={modal.data.date} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, date: e.target.value } }))} /></Field>
            </div>
            {!modal.id && (
              <>
                <Field label="Client" hint="Optionnel"><TextInput value={modal.data.client} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, client: e.target.value } }))} /></Field>
                <Field label="Notes" hint="Optionnel"><TextInput value={modal.data.note} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, note: e.target.value } }))} /></Field>
              </>
            )}
          </form>
        )}
      </Modal>

      <ConfirmSuppressionModal
        open={!!confirmCible}
        titre="Supprimer cette séance ?"
        description={confirmCible ? `Vous allez supprimer cette séance de ${fmtFCFA(confirmCible.montant)}.` : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmCible(null)}
      />
    </div>
  );
}
