import { useEffect, useState } from "react";
import { Pencil, Trash2, Save } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import Field, { TextInput, Select } from "./ui/Field";
import { fmtFCFA } from "../lib/logic";

const ORIGINES = ["Vente", "Prestation", "Facturation client", "Subvention"];
const ORIGINE_TONE = { "Vente": "mint", "Prestation": "accent", "Facturation client": "mint", "Subvention": "grape" };

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-3.5 py-2.5 gap-3">
      <span className="text-[13px] text-ink-soft shrink-0">{label}</span>
      {children}
    </div>
  );
}

// Équivalent de DepenseDetailModal pour les recettes — réutilisée par
// Recettes.jsx et BusinessFacturation.jsx.
export default function RecetteDetailModal({ recette, secteurs, peutModifier, modifierRecette, supprimerRecette, onClose, onDeleted }) {
  const [mode, setMode] = useState("vue");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  // Voir DepenseDetailModal — `recette` est un instantané pris au clic, non
  // reconnecté au store après un rechargement suite à une sauvegarde.
  const [enregistree, setEnregistree] = useState(null);

  useEffect(() => {
    if (recette) {
      setForm({ secteurId: recette.secteurId, montant: recette.montant, date: recette.date, origine: recette.origine });
      setMode("vue");
      setError("");
      setEnregistree(null);
    }
  }, [recette]);

  if (!recette || !form) return null;

  const affichee = enregistree || recette;
  const secteur = secteurs.find((s) => s.id === affichee.secteurId);

  async function enregistrer() {
    setSaving(true);
    setError("");
    const payload = { ...form, montant: Number(form.montant) };
    const res = await modifierRecette(recette.id, payload);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setEnregistree({ ...affichee, ...payload });
    setMode("vue");
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer définitivement cette recette de ${fmtFCFA(affichee.montant)} ?`)) return;
    setDeleting(true);
    const res = await supprimerRecette(recette.id);
    setDeleting(false);
    if (!res.ok) return setError(res.error);
    onDeleted?.(recette.id);
    onClose();
  }

  return (
    <Modal
      open={!!recette}
      onClose={onClose}
      title={mode === "edition" ? "Modifier la recette" : affichee.origine || "Détail de la recette"}
      footer={
        peutModifier &&
        (mode === "edition" ? (
          <>
            <Button variant="ghost" onClick={() => setMode("vue")}>Annuler</Button>
            <Button icon={Save} onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" icon={Trash2} onClick={supprimer} disabled={deleting} className="text-[#FF453A]">
              {deleting ? "Suppression…" : "Supprimer"}
            </Button>
            <Button icon={Pencil} onClick={() => setMode("edition")}>Modifier</Button>
          </>
        ))
      }
    >
      {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}

      {mode === "vue" ? (
        <div className="flex flex-col gap-2">
          <Row label="Secteur"><span className="font-bold" style={{ color: secteur?.color }}>{secteur?.nom}</span></Row>
          <Row label="Source"><Badge tone={ORIGINE_TONE[affichee.origine] || "ink"}>{affichee.origine}</Badge></Row>
          <Row label="Date"><span className="font-bold text-ink">{new Date(affichee.date).toLocaleDateString("fr-FR")}</span></Row>
          <Row label="Montant"><span className="font-bold text-[#1a7d34]">+{fmtFCFA(affichee.montant)}</span></Row>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
          <Field label="Secteur">
            <Select value={form.secteurId} onChange={(e) => setForm({ ...form, secteurId: e.target.value })}>
              {secteurs.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </Select>
          </Field>
          <Field label="Origine">
            <Select value={form.origine} onChange={(e) => setForm({ ...form, origine: e.target.value })}>
              {ORIGINES.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Montant (FCFA)">
              <TextInput type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
        </form>
      )}
    </Modal>
  );
}
