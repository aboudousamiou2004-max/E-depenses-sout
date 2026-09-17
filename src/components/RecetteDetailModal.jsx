import { useEffect, useState } from "react";
import { Pencil, Trash2, Save } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import Field, { TextInput, Select } from "./ui/Field";
import ConfirmSuppressionModal from "./ui/ConfirmSuppressionModal";
import { fmtFCFA } from "../lib/logic";
import { enregistrerMotifSuppression } from "../lib/motifSuppression";

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
// Recettes.jsx et BusinessFacturation.jsx. `peutModifier` et `peutSupprimer`
// sont distincts : Superviseur/Gérant peuvent supprimer sans pouvoir
// modifier (à la demande de l'utilisateur, 2026-09-14).
export default function RecetteDetailModal({ recette, secteurs, peutModifier, peutSupprimer, modifierRecette, supprimerRecette, currentUser, onClose, onDeleted }) {
  const [mode, setMode] = useState("vue");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [confirmOuvert, setConfirmOuvert] = useState(false);
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

  async function confirmerSuppression(motif) {
    setDeleting(true);
    await enregistrerMotifSuppression({ user: currentUser, table: "recettes", label: `${affichee.origine} : ${fmtFCFA(affichee.montant)}`, motif, secteurId: affichee.secteurId });
    const res = await supprimerRecette(recette.id);
    setDeleting(false);
    if (res.ok) {
      onDeleted?.(recette.id);
      onClose();
    }
    return res;
  }

  return (
    <Modal
      open={!!recette}
      onClose={onClose}
      title={mode === "edition" ? "Modifier la recette" : affichee.origine || "Détail de la recette"}
      footer={
        (peutModifier || peutSupprimer) &&
        (mode === "edition" ? (
          <>
            <Button variant="ghost" onClick={() => setMode("vue")}>Annuler</Button>
            <Button icon={Save} onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </>
        ) : (
          <>
            {peutSupprimer && (
              <Button variant="ghost" icon={Trash2} onClick={() => setConfirmOuvert(true)} disabled={deleting} className="text-[#FF453A]">
                {deleting ? "Suppression…" : "Supprimer"}
              </Button>
            )}
            {peutModifier && <Button icon={Pencil} onClick={() => setMode("edition")}>Modifier</Button>}
          </>
        ))
      }
    >
      {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}

      {mode === "vue" ? (
        <div className="flex flex-col gap-2">
          <Row label="Secteur"><span className="font-bold" style={{ color: secteur?.color }}>{secteur?.nom}</span></Row>
          <Row label="Source"><Badge tone={ORIGINE_TONE[affichee.origine] || "ink"}>{affichee.origine}</Badge></Row>
          <Row label="Date de sortie"><span className="font-bold text-ink">{new Date(affichee.date).toLocaleDateString("fr-FR")}</span></Row>
          {affichee.dateRetour && (
            <Row label="Date de retour"><span className="font-bold text-ink">{new Date(affichee.dateRetour).toLocaleDateString("fr-FR")}</span></Row>
          )}
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

      <ConfirmSuppressionModal
        open={confirmOuvert}
        titre="Supprimer cette recette ?"
        description={`Vous allez supprimer définitivement la recette « ${affichee.origine} » de ${fmtFCFA(affichee.montant)}.`}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmOuvert(false)}
      />
    </Modal>
  );
}
