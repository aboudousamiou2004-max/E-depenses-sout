import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Megaphone, Plus, Trash2, Pencil } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useComStore, STATUTS_CAMPAGNE, statutCampagneLabel, statutCampagneTone } from "../../store/comStore";
import { useAuthStore } from "../../store/authStore";
import { peutModifier, peutSupprimer } from "../../lib/modules";
import ConfirmSuppressionModal from "../../components/ui/ConfirmSuppressionModal";
import { enregistrerMotifSuppression } from "../../lib/motifSuppression";

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR");
const VIDE = { nom: "", client: "", budget: "", statut: "a_venir", dateDebut: new Date().toISOString().slice(0, 10), dateFin: "", description: "" };

// Campagnes — volet spécifique à MAXI COM : suivi par campagne (client,
// budget, période, statut), en complément des dépenses/recettes déjà
// génériques à tous les secteurs — utile pour voir d'un coup d'œil ce qui
// est en cours, à venir ou terminé, plutôt que de fouiller la liste des
// dépenses/recettes.
export default function Campagnes() {
  const config = useOutletContext();
  const { campagnes, chargerCampagnes, ajouterCampagne, modifierCampagne, changerStatutCampagne, supprimerCampagne } = useComStore();
  const { user } = useAuthStore();
  const modifierOk = peutModifier(user?.role);
  const supprimerOk = peutSupprimer(user?.role);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [confirmCible, setConfirmCible] = useState(null);

  useEffect(() => { chargerCampagnes(config.secteurId); }, [config.secteurId]);

  const filtrees = useMemo(
    () => campagnes.filter((c) => !filtreStatut || c.statut === filtreStatut),
    [campagnes, filtreStatut]
  );
  const enCours = campagnes.filter((c) => c.statut === "en_cours").length;
  const budgetTotal = campagnes.filter((c) => c.statut !== "annulee").reduce((s, c) => s + c.budget, 0);

  function openCreate() { setModal({ id: null, data: { ...VIDE } }); setError(""); }
  function openEdit(c) {
    setModal({ id: c.id, data: { nom: c.nom, client: c.client, budget: String(c.budget || ""), statut: c.statut, dateDebut: c.dateDebut || "", dateFin: c.dateFin || "", description: c.description } });
    setError("");
  }

  async function enregistrer() {
    if (!modal.data.nom.trim()) return setError("Nom de la campagne requis");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierCampagne(modal.id, modal.data) : await ajouterCampagne(config.secteurId, modal.data);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function confirmerSuppression(motif) {
    const c = confirmCible;
    await enregistrerMotifSuppression({ user, table: "com_campagnes", label: c.nom, motif, secteurId: config.secteurId });
    return supprimerCampagne(c.id);
  }

  return (
    <div>
      <TopBarSimple title="Campagnes" subtitle={`${config.nom} : suivi par campagne`} icon={Megaphone} accent={config.color} />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatTile icon={Megaphone} label="Campagnes en cours" value={String(enCours)} tone={config.color} />
        <StatTile icon={Megaphone} label="Budget total engagé" value={fmt(budgetTotal) + " FCFA"} tone="#8E8E93" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select className="!w-auto" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUTS_CAMPAGNE.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <Button icon={Plus} onClick={openCreate} style={{ background: config.color }} className="ml-auto">Nouvelle campagne</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Campagne</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">Période</th>
              <th className="px-3 py-3 text-right">Budget</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtrees.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune campagne.</td></tr>}
            {filtrees.map((c) => (
              <tr key={c.id} className="text-[13px] hover:bg-white/50 transition-colors">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-ink">{c.nom}</p>
                  {c.description && <p className="text-[11.5px] text-ink-soft truncate max-w-[220px]">{c.description}</p>}
                </td>
                <td className="px-3 py-2.5 text-ink-soft">{c.client || "—"}</td>
                <td className="px-3 py-2.5 text-ink-soft tabular text-[12px]">
                  {c.dateDebut ? new Date(c.dateDebut).toLocaleDateString("fr-FR") : "—"}
                  {c.dateFin ? ` → ${new Date(c.dateFin).toLocaleDateString("fr-FR")}` : ""}
                </td>
                <td className="px-3 py-2.5 text-right tabular font-bold text-ink">{fmt(c.budget)}</td>
                <td className="px-3 py-2.5 text-center">
                  <Select className="!w-auto !py-1 !text-[11.5px]" value={c.statut} onChange={(e) => changerStatutCampagne(c.id, e.target.value)}>
                    {STATUTS_CAMPAGNE.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </Select>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {modifierOk && <button onClick={() => openEdit(c)} className="text-ink-soft hover:text-ink"><Pencil size={14} /></button>}
                    {supprimerOk && <button onClick={() => setConfirmCible(c)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>}
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
        title={modal?.id ? "Modifier la campagne" : "Nouvelle campagne"}
        icon={Megaphone}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {modal && (
          <form onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Nom de la campagne"><TextInput value={modal.data.nom} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, nom: e.target.value } }))} autoFocus /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client" hint="Optionnel"><TextInput value={modal.data.client} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, client: e.target.value } }))} /></Field>
              <Field label="Budget (FCFA)"><TextInput type="number" min="0" value={modal.data.budget} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, budget: e.target.value } }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début" hint="Optionnel"><TextInput type="date" value={modal.data.dateDebut} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateDebut: e.target.value } }))} /></Field>
              <Field label="Fin" hint="Optionnel"><TextInput type="date" value={modal.data.dateFin} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateFin: e.target.value } }))} /></Field>
            </div>
            <Field label="Statut">
              <Select value={modal.data.statut} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, statut: e.target.value } }))}>
                {STATUTS_CAMPAGNE.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Description" hint="Optionnel"><TextInput value={modal.data.description} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
          </form>
        )}
      </Modal>

      <ConfirmSuppressionModal
        open={!!confirmCible}
        titre="Supprimer cette campagne ?"
        description={confirmCible ? `Vous allez supprimer la campagne « ${confirmCible.nom} ».` : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmCible(null)}
      />
    </div>
  );
}
