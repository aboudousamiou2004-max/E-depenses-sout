import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Handshake, Plus, Trash2, Pencil, Phone } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useGymStore, NIVEAUX_FORFAIT, niveauLabel } from "../../store/gymStore";
import { useAuthStore } from "../../store/authStore";
import { peutModifier, peutSupprimer } from "../../lib/modules";
import ConfirmSuppressionModal from "../../components/ui/ConfirmSuppressionModal";
import { enregistrerMotifSuppression } from "../../lib/motifSuppression";

const VIDE = { nom: "", entreprise: "", telephone: "", forfaitNiveau: "simple", dateDebut: new Date().toISOString().slice(0, 10), estPartenaire: true, note: "" };

// Clients partenaires — volet spécifique à MAXI GYM : entreprises ayant un
// partenariat (abonnements collectifs pour leurs employés), distinctes des
// clients individuels (Clients.jsx) — même table gym_clients, filtrée sur
// `estPartenaire`.
export default function ClientsPartenaires() {
  const config = useOutletContext();
  const { clients, chargerClients, ajouterClient, modifierClient, toggleActifClient, supprimerClient } = useGymStore();
  const { user } = useAuthStore();
  const modifierOk = peutModifier(user?.role);
  const supprimerOk = peutSupprimer(user?.role);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmCible, setConfirmCible] = useState(null);

  useEffect(() => { chargerClients(config.secteurId); }, [config.secteurId]);

  const partenaires = useMemo(() => clients.filter((c) => c.estPartenaire), [clients]);
  const actifs = partenaires.filter((c) => c.actif).length;

  function openCreate() { setModal({ id: null, data: { ...VIDE } }); setError(""); }
  function openEdit(c) {
    setModal({ id: c.id, data: { nom: c.nom, entreprise: c.entreprise, telephone: c.telephone, forfaitNiveau: c.forfaitNiveau, dateDebut: c.dateDebut, estPartenaire: true, note: c.note } });
    setError("");
  }

  async function enregistrer() {
    if (!modal.data.entreprise.trim()) return setError("Nom de l'entreprise requis");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierClient(modal.id, modal.data) : await ajouterClient(config.secteurId, { ...modal.data, nom: modal.data.nom || modal.data.entreprise });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function confirmerSuppression(motif) {
    const c = confirmCible;
    await enregistrerMotifSuppression({ user, table: "gym_clients", label: c.entreprise || c.nom, motif, secteurId: config.secteurId });
    return supprimerClient(c.id);
  }

  return (
    <div>
      <TopBarSimple title="Clients partenaires" subtitle={`${config.nom} : entreprises partenaires`} icon={Handshake} accent={config.color} />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatTile icon={Handshake} label="Partenariats actifs" value={String(actifs)} tone={config.color} />
        <StatTile icon={Handshake} label="Total" value={String(partenaires.length)} tone="#8E8E93" />
      </div>

      <div className="flex justify-end mb-4">
        <Button icon={Plus} onClick={openCreate} style={{ background: config.color }}>Nouveau partenaire</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Entreprise</th>
              <th className="px-3 py-3">Contact</th>
              <th className="px-3 py-3">Forfait</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {partenaires.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun partenaire.</td></tr>}
            {partenaires.map((c) => (
              <tr key={c.id} className="text-[13px] hover:bg-white/50 transition-colors">
                <td className="px-3 py-2.5 font-semibold text-ink">{c.entreprise || c.nom}</td>
                <td className="px-3 py-2.5">
                  <p className="text-ink-soft">{c.nom}</p>
                  {c.telephone && <p className="text-[11.5px] text-ink-soft flex items-center gap-1 mt-0.5"><Phone size={11} /> {c.telephone}</p>}
                </td>
                <td className="px-3 py-2.5"><Badge tone="accent">{niveauLabel(c.forfaitNiveau)}</Badge></td>
                <td className="px-3 py-2.5 text-center">
                  <button onClick={() => toggleActifClient(c.id, !c.actif)}>
                    <Badge tone={c.actif ? "mint" : "ink"}>{c.actif ? "Actif" : "Inactif"}</Badge>
                  </button>
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
        title={modal?.id ? "Modifier le partenaire" : "Nouveau partenaire"}
        icon={Handshake}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {modal && (
          <form onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Entreprise"><TextInput value={modal.data.entreprise} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, entreprise: e.target.value } }))} autoFocus /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact" hint="Optionnel"><TextInput value={modal.data.nom} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, nom: e.target.value } }))} /></Field>
              <Field label="Téléphone" hint="Optionnel"><TextInput value={modal.data.telephone} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, telephone: e.target.value } }))} /></Field>
            </div>
            <Field label="Forfait">
              <Select value={modal.data.forfaitNiveau} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, forfaitNiveau: e.target.value } }))}>
                {NIVEAUX_FORFAIT.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </Select>
            </Field>
            <Field label="Date de début"><TextInput type="date" value={modal.data.dateDebut} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateDebut: e.target.value } }))} /></Field>
            <Field label="Note" hint="Optionnel"><TextInput value={modal.data.note} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, note: e.target.value } }))} /></Field>
          </form>
        )}
      </Modal>

      <ConfirmSuppressionModal
        open={!!confirmCible}
        titre="Supprimer ce partenariat ?"
        description={confirmCible ? `Vous allez supprimer le partenariat avec ${confirmCible.entreprise || confirmCible.nom}.` : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmCible(null)}
      />
    </div>
  );
}
