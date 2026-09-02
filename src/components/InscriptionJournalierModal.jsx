import { useState } from "react";
import { CalendarClock } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Field, { TextInput, Select } from "./ui/Field";
import { useGarderieStore } from "../store/garderieStore";
import { useAuthStore } from "../store/authStore";

const MODES_PAIEMENT = [
  { id: "espece", label: "Espèces" },
  { id: "mobile", label: "Mobile money" },
  { id: "virement", label: "Virement" },
  { id: "cheque", label: "Chèque" },
];

function empty() {
  return {
    nom: "", prenom: "", ageApprox: "",
    parentNom: "", parentContact: "",
    date: new Date().toISOString().slice(0, 10), nombreJours: "1", apporteRepas: false, notes: "",
    montantPaye: "", modePaiement: "espece",
  };
}

export default function InscriptionJournalierModal({ open, onClose, accent, moduleLabel, onSaved }) {
  const { ajouterJournalier } = useGarderieStore();
  const { user } = useAuthStore();
  const [data, setData] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!data.nom.trim() || !data.prenom.trim()) return setError("Nom et prénom requis");
    setSaving(true);
    setError("");
    const res = await ajouterJournalier(data, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    await onSaved?.({ journalier: res.journalier, montantPaye: Number(data.montantPaye) || 0 });
    setData(empty());
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Accueil journalier"
      icon={CalendarClock}
      accent={accent}
      moduleLabel={moduleLabel}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
    >
      <form onSubmit={submit}>
        {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nom"><TextInput value={data.nom} onChange={(e) => set("nom", e.target.value)} autoFocus /></Field>
          <Field label="Prénom"><TextInput value={data.prenom} onChange={(e) => set("prenom", e.target.value)} /></Field>
        </div>
        <Field label="Âge approximatif" hint="Pas de fiche complète pour un accueil ponctuel">
          <TextInput value={data.ageApprox} onChange={(e) => set("ageApprox", e.target.value)} placeholder="Ex : 4 ans" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Parent / tuteur"><TextInput value={data.parentNom} onChange={(e) => set("parentNom", e.target.value)} /></Field>
          <Field label="Contact"><TextInput value={data.parentContact} onChange={(e) => set("parentContact", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date"><TextInput type="date" value={data.date} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Nombre de jours"><TextInput type="number" min="1" value={data.nombreJours} onChange={(e) => set("nombreJours", e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 mb-3.5 cursor-pointer">
          <input type="checkbox" checked={data.apporteRepas} onChange={(e) => set("apporteRepas", e.target.checked)} className="w-4 h-4 rounded accent-[#0A84FF]" />
          <span className="text-[13px] font-semibold text-ink">L'enfant apporte son repas</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Montant payé (FCFA)">
            <TextInput type="number" min="0" value={data.montantPaye} onChange={(e) => set("montantPaye", e.target.value)} placeholder="0" />
          </Field>
          <Field label="Mode de paiement">
            <Select value={data.modePaiement} onChange={(e) => set("modePaiement", e.target.value)}>
              {MODES_PAIEMENT.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes"><TextInput value={data.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Allergie, information utile…" /></Field>
        <p className="text-[12px] text-ink-soft">Un montant payé sera compté comme une recette du secteur {moduleLabel}, visible aussi dans E-DÉPENSES.</p>
      </form>
    </Modal>
  );
}
