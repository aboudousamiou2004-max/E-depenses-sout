import { useMemo, useState } from "react";
import { Plus, Phone, Pencil, Trash2 } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Field, { TextInput } from "../components/ui/Field";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import { ROLES_ACCES_TOTAL } from "../lib/modules";

// Contacts externes (fournisseurs, prestataires, banque…) — pas des employés.
// Porté depuis termitiere-platform/src/shared/partenaires/Partenaires.jsx.
export default function Partenaires() {
  const { partenaires, addPartenaire, modifierPartenaire, supprimerPartenaire } = useDataStore();
  const { user } = useAuthStore();
  const peutGerer = ROLES_ACCES_TOTAL.includes(user?.role);
  const [modal, setModal] = useState(null); // { data, id }
  const [toDelete, setToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const liste = useMemo(() => [...partenaires].sort((a, b) => (a.nom || "").localeCompare(b.nom || "")), [partenaires]);

  function openCreate() { setModal({ data: { nom: "", type: "", contact: "" }, id: null }); }
  function openEdit(p) { setModal({ data: { nom: p.nom, type: p.type, contact: p.contact }, id: p.id }); }

  async function submit(e) {
    e.preventDefault();
    if (!modal.data.nom.trim()) return setError("Nom du partenaire requis");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierPartenaire(modal.id, modal.data) : await addPartenaire(modal.data);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function confirmerSuppression() {
    setSaving(true);
    await supprimerPartenaire(toDelete.id);
    setSaving(false);
    setToDelete(null);
  }

  return (
    <div>
      <TopBar title="Partenaires" subtitle="Contacts externes du secteur — fournisseurs, prestataires, banque…" />

      {peutGerer ? (
        <div className="flex justify-end mb-4">
          <Button icon={Plus} onClick={openCreate}>Nouveau partenaire</Button>
        </div>
      ) : (
        <GlassCard className="p-4 mb-4">
          <p className="text-[13px] text-ink-soft">👁️ Consultation seule — la gestion des partenaires est réservée à la direction.</p>
        </GlassCard>
      )}

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Type / spécificité</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && (
              <tr><td colSpan={4} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun partenaire enregistré.</td></tr>
            )}
            {liste.map((p) => (
              <tr key={p.id} className="text-[13.5px] hover:bg-white/50 transition-colors">
                <td className="px-4 py-3 font-semibold text-ink">{p.nom}</td>
                <td className="px-4 py-3">{p.type ? <Badge tone="ink">{p.type}</Badge> : <span className="text-ink-soft/60">—</span>}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {p.contact ? <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {p.contact}</span> : "—"}
                </td>
                <td className="px-4 py-3">
                  {peutGerer && (
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-[#0A84FF] hover:bg-[#0A84FF]/10"><Pencil size={14} /></button>
                      <button onClick={() => setToDelete(p)} className="rounded-lg p-1.5 text-[#FF453A] hover:bg-[#FF453A]/10"><Trash2 size={14} /></button>
                    </div>
                  )}
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
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {modal && (
          <form onSubmit={submit}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Nom du partenaire">
              <TextInput value={modal.data.nom} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, nom: e.target.value } }))} placeholder="ex : Kofi Adjovi" autoFocus />
            </Field>
            <Field label="Type / spécificité" hint="Ex : Fournisseur, Prestataire, Banque…">
              <TextInput value={modal.data.type} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, type: e.target.value } }))} placeholder="ex : Fournisseur" />
            </Field>
            <Field label="Contact / téléphone">
              <TextInput value={modal.data.contact} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, contact: e.target.value } }))} placeholder="ex : 22890000000" />
            </Field>
          </form>
        )}
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Supprimer ce partenaire ?"
        footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>Annuler</Button><Button variant="danger" onClick={confirmerSuppression} disabled={saving}>Supprimer</Button></>}
      >
        {toDelete && <p className="text-[13px] text-ink-soft">Vous allez supprimer « <strong className="text-ink">{toDelete.nom}</strong> ». Cette action est irréversible.</p>}
      </Modal>
    </div>
  );
}
