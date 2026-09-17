import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

// Confirmation de suppression avec motif obligatoire — remplace
// `window.confirm(...)` PARTOUT dans l'application (à la demande explicite
// de l'utilisateur, 2026-09-14 : toute suppression doit être justifiée).
// `onConfirm(motif)` doit retourner `{ ok, error }` (même convention que les
// actions des stores) ; le motif est enregistré séparément par l'appelant
// (voir lib/motifSuppression.js) avant ou pendant la suppression elle-même.
export default function ConfirmSuppressionModal({ open, titre, description, onConfirm, onClose }) {
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setMotif("");
      setError("");
      setSaving(false);
    }
  }, [open]);

  async function confirmer() {
    if (!motif.trim()) return setError("Le motif est obligatoire.");
    setSaving(true);
    setError("");
    const res = await onConfirm(motif.trim());
    setSaving(false);
    if (!res?.ok) return setError(res?.error || "Échec de la suppression.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titre || "Confirmer la suppression"}
      icon={Trash2}
      accent="#FF453A"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="danger" onClick={confirmer} disabled={saving}>{saving ? "Suppression…" : "Supprimer"}</Button>
        </>
      }
    >
      {description && <p className="text-[13px] text-ink-soft mb-3">{description}</p>}
      {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
      <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">Motif de la suppression <span className="text-[#FF453A]">*</span></label>
      <textarea
        autoFocus
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        rows={3}
        placeholder="Pourquoi supprimer cet élément ?"
        className="glass w-full rounded-2xl px-3.5 py-2.5 text-[13.5px] text-ink outline-none resize-none placeholder:text-ink-soft/60"
      />
      <p className="mt-1.5 text-[11px] text-ink-soft/70">Cette action est irréversible et le motif reste consultable dans l'audit.</p>
    </Modal>
  );
}
