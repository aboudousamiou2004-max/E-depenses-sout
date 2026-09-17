import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Truck, Plus, Trash2, Pencil, ArrowRight, CheckCircle2, Receipt } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useTransportStore, STATUTS_TRANSPORT, statutTransportLabel } from "../../store/transportStore";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { peutModifier, peutSupprimer } from "../../lib/modules";
import { totalMontant } from "../../lib/logic";
import ConfirmSuppressionModal from "../../components/ui/ConfirmSuppressionModal";
import { enregistrerMotifSuppression } from "../../lib/motifSuppression";

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR");
const VIDE = {
  client: "", depart: "", arrivee: "", vehicule: "", chauffeur: "", montant: "", statut: "planifie",
  date: new Date().toISOString().slice(0, 10), note: "", depenseMontant: "", depenseDescription: "",
};
const VIDE_DEPENSE = { montant: "", description: "" };

// Transport — volet spécifique aux secteurs avec `transport: true` (MAXI
// LOGISTIQUE, E-BRIQUETERIE — voir PRESETS dans lib/modules.js) : suivi
// opérationnel des courses. Seules l'heure de départ et le montant sont
// obligatoires — l'heure d'arrivée peut être inconnue à la création et se
// renseigne soit à la main, soit automatiquement via le bouton « Arrivé ».
// Les dépenses liées à une course (carburant, péage...) peuvent être
// mentionnées à la création, ou ajoutées après coup depuis la bande de la
// course — elles restent de vraies dépenses du secteur (visibles dans
// Dépenses/E-DÉPENSES), juste rattachées à la course via `transport_id`.
export default function Transport() {
  const config = useOutletContext();
  const { transports, chargerTransports, ajouterTransport, modifierTransport, changerStatutTransport, marquerArriveeTransport, supprimerTransport } = useTransportStore();
  const { depenses, addDepense } = useDataStore();
  const { user } = useAuthStore();
  const modifierOk = peutModifier(user?.role);
  const supprimerOk = peutSupprimer(user?.role);
  const [modal, setModal] = useState(null);
  const [depenseModal, setDepenseModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [confirmCible, setConfirmCible] = useState(null);

  useEffect(() => { chargerTransports(config.secteurId); }, [config.secteurId]);

  const filtres = useMemo(
    () => transports.filter((t) => !filtreStatut || t.statut === filtreStatut),
    [transports, filtreStatut]
  );
  const enCours = transports.filter((t) => t.statut === "en_cours").length;
  const totalFacture = transports.filter((t) => t.statut !== "annule").reduce((s, t) => s + t.montant, 0);

  const depensesParCourse = useMemo(() => {
    const map = {};
    for (const d of depenses) {
      if (!d.transportId) continue;
      (map[d.transportId] ||= []).push(d);
    }
    return map;
  }, [depenses]);

  function openCreate() { setModal({ id: null, data: { ...VIDE } }); setError(""); }
  function openEdit(t) {
    setModal({ id: t.id, data: { client: t.client, depart: t.depart, arrivee: t.arrivee, vehicule: t.vehicule, chauffeur: t.chauffeur, montant: String(t.montant || ""), statut: t.statut, date: t.date, note: t.note, depenseMontant: "", depenseDescription: "" } });
    setError("");
  }

  async function enregistrer() {
    if (!modal.data.depart || !modal.data.montant) return setError("Heure de départ et montant requis");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierTransport(modal.id, modal.data) : await ajouterTransport(config.secteurId, modal.data);
    if (!res.ok) {
      setSaving(false);
      return setError(res.error);
    }
    if (!modal.id && Number(modal.data.depenseMontant) > 0) {
      await addDepense(
        {
          secteurId: config.secteurId, categorie: "Transport", montant: Number(modal.data.depenseMontant), date: modal.data.date,
          natureFlux: "exploitation", sourceFinancement: "entreprise",
          description: modal.data.depenseDescription || `Course ${modal.data.depart}${modal.data.client ? ` : ${modal.data.client}` : ""}`,
          transportId: res.id,
        },
        user
      );
    }
    setSaving(false);
    setModal(null);
  }

  async function marquerArrivee(t) {
    const res = await marquerArriveeTransport(t.id);
    if (!res.ok) alert(res.error);
  }

  async function confirmerSuppression(motif) {
    const t = confirmCible;
    await enregistrerMotifSuppression({ user, table: "logistique_transports", label: `${t.depart} → ${t.arrivee || ""}`, motif, secteurId: config.secteurId });
    return supprimerTransport(t.id);
  }

  function openDepense(t) { setDepenseModal({ transport: t, data: { ...VIDE_DEPENSE } }); setError(""); }

  async function enregistrerDepense() {
    const montant = Number(depenseModal.data.montant);
    if (montant <= 0) return setError("Montant requis");
    setSaving(true);
    setError("");
    const res = await addDepense(
      {
        secteurId: config.secteurId, categorie: "Transport", montant, date: depenseModal.transport.date,
        natureFlux: "exploitation", sourceFinancement: "entreprise",
        description: depenseModal.data.description || `Course ${depenseModal.transport.depart}${depenseModal.transport.client ? ` : ${depenseModal.transport.client}` : ""}`,
        transportId: depenseModal.transport.id,
      },
      user
    );
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setDepenseModal(null);
  }

  return (
    <div>
      <TopBarSimple title="Transport" subtitle={`${config.nom} : suivi des courses et trajets`} icon={Truck} accent={config.color} />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatTile icon={Truck} label="Courses en cours" value={String(enCours)} tone={config.color} />
        <StatTile icon={Truck} label="Montant total (affiché)" value={fmt(totalFacture) + " FCFA"} tone="#8E8E93" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select className="!w-auto" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUTS_TRANSPORT.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <Button icon={Plus} onClick={openCreate} style={{ background: config.color }} className="ml-auto">Nouvelle course</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Horaire</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">Véhicule / Chauffeur</th>
              <th className="px-3 py-3 text-right">Montant</th>
              <th className="px-3 py-3">Dépenses liées</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtres.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune course.</td></tr>}
            {filtres.map((t) => {
              const depensesLiees = depensesParCourse[t.id] || [];
              return (
                <tr key={t.id} className="text-[13px] hover:bg-white/50 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-ink flex items-center gap-1.5">
                      {t.depart}
                      {t.arrivee ? (<><ArrowRight size={12} className="text-ink-soft" /> {t.arrivee}</>) : (
                        <button onClick={() => marquerArrivee(t)} className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: `${config.color}1f`, color: config.color }}>
                          <CheckCircle2 size={12} /> Arrivé
                        </button>
                      )}
                    </p>
                    <p className="text-[11.5px] text-ink-soft tabular mt-0.5">{t.date ? new Date(t.date).toLocaleDateString("fr-FR") : "—"}</p>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">{t.client || "—"}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{[t.vehicule, t.chauffeur].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular font-bold text-ink">{fmt(t.montant)}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openDepense(t)} className="flex items-center gap-1 text-[11.5px] font-semibold text-ink-soft hover:text-ink">
                      <Receipt size={13} />
                      {depensesLiees.length > 0 ? `${fmt(totalMontant(depensesLiees))} FCFA (${depensesLiees.length})` : "+ Dépense"}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Select className="!w-auto !py-1 !text-[11.5px]" value={t.statut} onChange={(e) => changerStatutTransport(t.id, e.target.value)}>
                      {STATUTS_TRANSPORT.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </Select>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {modifierOk && <button onClick={() => openEdit(t)} className="text-ink-soft hover:text-ink"><Pencil size={14} /></button>}
                      {supprimerOk && <button onClick={() => setConfirmCible(t)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Modifier la course" : "Nouvelle course"}
        icon={Truck}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {modal && (
          <form onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heure de départ"><TextInput type="time" value={modal.data.depart} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, depart: e.target.value } }))} autoFocus /></Field>
              <Field label="Heure d'arrivée" hint="Optionnel : ou bouton « Arrivé »"><TextInput type="time" value={modal.data.arrivee} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, arrivee: e.target.value } }))} /></Field>
            </div>
            <Field label="Client" hint="Optionnel"><TextInput value={modal.data.client} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, client: e.target.value } }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Véhicule" hint="Optionnel"><TextInput value={modal.data.vehicule} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, vehicule: e.target.value } }))} /></Field>
              <Field label="Chauffeur" hint="Optionnel"><TextInput value={modal.data.chauffeur} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, chauffeur: e.target.value } }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Montant (FCFA)"><TextInput type="number" min="0" value={modal.data.montant} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, montant: e.target.value } }))} /></Field>
              <Field label="Date"><TextInput type="date" value={modal.data.date} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, date: e.target.value } }))} /></Field>
            </div>
            <Field label="Statut">
              <Select value={modal.data.statut} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, statut: e.target.value } }))}>
                {STATUTS_TRANSPORT.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Note" hint="Optionnel"><TextInput value={modal.data.note} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, note: e.target.value } }))} /></Field>
            {!modal.id && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Dépense liée (FCFA)" hint="Optionnel : carburant, péage..."><TextInput type="number" min="0" value={modal.data.depenseMontant} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, depenseMontant: e.target.value } }))} /></Field>
                  <Field label="Motif de la dépense" hint="Optionnel"><TextInput value={modal.data.depenseDescription} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, depenseDescription: e.target.value } }))} /></Field>
                </div>
                <p className="text-[12px] text-ink-soft -mt-1 mb-2">Si renseignée, cette dépense sera enregistrée avec la course et visible dans Dépenses. D'autres dépenses pourront être ajoutées ensuite depuis la ligne de la course.</p>
              </>
            )}
            <p className="text-[12px] text-ink-soft">Ce suivi n'enregistre pas de recette : facturez la course depuis Prestations si nécessaire.</p>
          </form>
        )}
      </Modal>

      <Modal
        open={!!depenseModal}
        onClose={() => setDepenseModal(null)}
        title="Ajouter une dépense liée"
        icon={Receipt}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setDepenseModal(null)}>Annuler</Button><Button onClick={enregistrerDepense} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {depenseModal && (
          <form onSubmit={(e) => { e.preventDefault(); enregistrerDepense(); }}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <p className="text-[12.5px] text-ink-soft mb-3">Course de {depenseModal.transport.depart}{depenseModal.transport.client ? ` : ${depenseModal.transport.client}` : ""}</p>
            <Field label="Montant (FCFA)"><TextInput type="number" min="0" value={depenseModal.data.montant} onChange={(e) => setDepenseModal((m) => ({ ...m, data: { ...m.data, montant: e.target.value } }))} autoFocus placeholder="Carburant, péage..." /></Field>
            <Field label="Motif" hint="Optionnel"><TextInput value={depenseModal.data.description} onChange={(e) => setDepenseModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
          </form>
        )}
      </Modal>

      <ConfirmSuppressionModal
        open={!!confirmCible}
        titre="Supprimer cette course ?"
        description={confirmCible ? `Vous allez supprimer la course de ${confirmCible.depart}${confirmCible.client ? ` : ${confirmCible.client}` : ""}.` : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmCible(null)}
      />
    </div>
  );
}
