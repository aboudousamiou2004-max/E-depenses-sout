import { useEffect, useState } from "react";
import { Pencil, Trash2, Save, Paperclip, Eye, Receipt, Check, X } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import Field, { TextInput, Select } from "./ui/Field";
import ConfirmSuppressionModal from "./ui/ConfirmSuppressionModal";
import { fmtFCFA, statutLabel } from "../lib/logic";
import { lireFichier, ouvrirPiece, formatTaille } from "../lib/fichiers";
import { enregistrerMotifSuppression } from "../lib/motifSuppression";

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-3.5 py-2.5 gap-3">
      <span className="text-[13px] text-ink-soft shrink-0">{label}</span>
      {children}
    </div>
  );
}

// Vue détaillée d'une dépense, avec bascule vers un formulaire d'édition et
// suppression — réutilisée par Depenses.jsx, BusinessDepenses.jsx, et par le
// détail ouvert en cliquant sur un KPI (TransactionsListModal). `peutModifier`
// (édition + validation) et `peutSupprimer` sont distincts : Superviseur/
// Gérant peuvent supprimer sans pouvoir modifier ni valider (à la demande de
// l'utilisateur, 2026-09-14).
export default function DepenseDetailModal({ depense, secteurs, categories, users = [], peutModifier, peutSupprimer, modifierDepense, supprimerDepense, changerStatutDepense, currentUser, onClose, onDeleted }) {
  const [mode, setMode] = useState("vue");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  // `depense` est un instantané pris au clic sur la ligne — le rechargement
  // du store après une modification ne le met pas à jour automatiquement.
  // `enregistree` porte donc la version affichée après une sauvegarde
  // réussie, pour ne pas ré-afficher les anciennes valeurs en repassant en
  // mode vue.
  const [enregistree, setEnregistree] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirmOuvert, setConfirmOuvert] = useState(false);

  useEffect(() => {
    if (depense) {
      setForm({
        secteurId: depense.secteurId,
        categorie: depense.categorie,
        montant: depense.montant,
        date: depense.date,
        natureFlux: depense.natureFlux || "exploitation",
        sourceFinancement: depense.sourceFinancement || "entreprise",
        description: depense.description || "",
        beneficiaireNom: depense.beneficiaireNom || "",
        imprevue: !!depense.imprevue,
        recurrente: !!depense.recurrente,
        piece: depense.piece || null,
      });
      setMode("vue");
      setError("");
      setEnregistree(null);
    }
  }, [depense]);

  async function handlePieceChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const piece = await lireFichier(file);
      setForm((f) => ({ ...f, piece }));
    } catch (err) {
      setError(err.message || "Fichier illisible");
    } finally {
      setUploading(false);
    }
  }

  if (!depense || !form) return null;

  const affichee = enregistree || depense;
  const secteur = secteurs.find((s) => s.id === affichee.secteurId);
  const demandeur = users.find((u) => u.uid === affichee.creeParUid);
  const st = statutLabel(affichee.statut);
  const peutValider = affichee.statut === "en_attente" && typeof changerStatutDepense === "function" && peutModifier;
  const categoriesDuSecteur = [
    ...new Set([...categories.filter((c) => c.secteurId === form.secteurId).map((c) => c.nom), form.categorie].filter(Boolean)),
  ];

  async function enregistrer() {
    setSaving(true);
    setError("");
    const payload = { ...form, montant: Number(form.montant) };
    const res = await modifierDepense(depense.id, payload);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setEnregistree({ ...affichee, ...payload });
    setMode("vue");
  }

  async function confirmerSuppression(motif) {
    setDeleting(true);
    await enregistrerMotifSuppression({ user: currentUser, table: "depenses", label: `${affichee.categorie} : ${fmtFCFA(affichee.montant)}`, motif, secteurId: affichee.secteurId });
    const res = await supprimerDepense(depense.id);
    setDeleting(false);
    if (res.ok) {
      onDeleted?.(depense.id);
      onClose();
    }
    return res;
  }

  async function valider(statut) {
    setValidating(true);
    setError("");
    const res = await changerStatutDepense(depense.id, statut, currentUser);
    setValidating(false);
    if (!res.ok) return setError(res.error);
    setEnregistree({ ...affichee, statut });
  }

  return (
    <Modal
      open={!!depense}
      onClose={onClose}
      title={mode === "edition" ? "Modifier la dépense" : "Détail de la dépense"}
      icon={Receipt}
      accent={secteur?.color || "#FF453A"}
      moduleLabel={secteur?.nom}
      footer={
        (peutModifier || peutSupprimer) &&
        (mode === "edition" ? (
          <>
            <Button variant="ghost" onClick={() => setMode("vue")}>Annuler</Button>
            <Button icon={Save} onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </>
        ) : (
          <>
            {peutValider && (
              <>
                <Button variant="danger" icon={X} onClick={() => valider("refusee")} disabled={validating} className="mr-auto">
                  {validating ? "…" : "Refuser"}
                </Button>
                <Button variant="success" icon={Check} onClick={() => valider("approuvee")} disabled={validating}>
                  {validating ? "…" : "Valider"}
                </Button>
              </>
            )}
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
          <Row label="Catégorie"><span className="font-bold text-ink">{affichee.categorie}</span></Row>
          <Row label="Montant"><span className="font-bold text-ink">{fmtFCFA(affichee.montant)}</span></Row>
          <Row label="Date"><span className="font-bold text-ink">{new Date(affichee.date).toLocaleDateString("fr-FR")}</span></Row>
          <Row label="Nature du flux"><span className="font-bold text-ink capitalize">{affichee.natureFlux}</span></Row>
          <Row label="Source de financement"><span className="font-bold text-ink capitalize">{affichee.sourceFinancement}</span></Row>
          <Row label="Statut"><Badge tone={st.tone}>{st.label}</Badge></Row>
          <Row label="Demandé par">
            <span className="font-semibold text-ink text-right">
              {demandeur ? demandeur.nom : "—"}
              {demandeur?.poste && <span className="block text-[11.5px] font-normal text-ink-soft">{demandeur.poste}</span>}
            </span>
          </Row>
          <Row label="Motif"><span className="font-medium text-ink text-right">{affichee.description || "—"}</span></Row>
          <Row label="Bénéficiaire"><span className="font-medium text-ink text-right">{affichee.beneficiaireNom || "—"}</span></Row>
          <Row label="Type">
            <span className="flex gap-1.5">
              {affichee.imprevue && <Badge tone="amber">⚠ Imprévue</Badge>}
              {affichee.recurrente && <Badge tone="accent">🔁 Récurrente</Badge>}
              {!affichee.imprevue && !affichee.recurrente && <span className="text-ink-soft text-[13px]">—</span>}
            </span>
          </Row>
          <Row label="Justificatif">
            {affichee.piece ? (
              <button type="button" onClick={() => ouvrirPiece(affichee.piece)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0A84FF] hover:underline">
                <Eye size={14} /> {affichee.piece.nom} <span className="text-ink-soft font-normal">({formatTaille(affichee.piece.taille)})</span>
              </button>
            ) : <span className="text-ink-soft text-[13px]">—</span>}
          </Row>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
          <Field label="Secteur">
            <Select value={form.secteurId} onChange={(e) => setForm({ ...form, secteurId: e.target.value })}>
              {secteurs.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </Select>
          </Field>
          <Field label="Catégorie" hint="Suggestions du secteur, ou saisie libre">
            <TextInput list="categories-suggestions-edition" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} />
            <datalist id="categories-suggestions-edition">
              {categoriesDuSecteur.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Montant (FCFA)">
              <TextInput type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nature du flux">
              <Select value={form.natureFlux} onChange={(e) => setForm({ ...form, natureFlux: e.target.value })}>
                <option value="exploitation">Exploitation</option>
                <option value="investissement">Investissement</option>
                <option value="perte">Perte</option>
              </Select>
            </Field>
            <Field label="Source de financement">
              <Select value={form.sourceFinancement} onChange={(e) => setForm({ ...form, sourceFinancement: e.target.value })}>
                <option value="entreprise">Entreprise</option>
                <option value="pau">PAU</option>
              </Select>
            </Field>
          </div>
          <Field label="Motif">
            <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Bénéficiaire" hint="Optionnel">
            <TextInput value={form.beneficiaireNom} onChange={(e) => setForm({ ...form, beneficiaireNom: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3.5">
            <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-soft cursor-pointer">
              <input type="checkbox" checked={form.imprevue} onChange={(e) => setForm({ ...form, imprevue: e.target.checked })} className="w-4 h-4 rounded accent-[#FF9F0A]" />
              ⚠ Imprévue
            </label>
            <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-soft cursor-pointer">
              <input type="checkbox" checked={form.recurrente} onChange={(e) => setForm({ ...form, recurrente: e.target.checked })} className="w-4 h-4 rounded accent-[#5E5CE6]" />
              🔁 Récurrente
            </label>
          </div>
          <Field label="Justificatif" hint="Photo ou PDF, optionnel">
            {form.piece ? (
              <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-[13px]">
                <span className="flex items-center gap-1.5 text-ink"><Paperclip size={14} /> {form.piece.nom} <span className="text-[11px] text-ink-soft">({formatTaille(form.piece.taille)})</span></span>
                <button type="button" onClick={() => setForm({ ...form, piece: null })} className="text-[11px] text-[#FF453A] hover:underline">Retirer</button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-3.5 py-3 text-[13px] text-ink-soft cursor-pointer hover:bg-black/[0.04]">
                <Paperclip size={15} /> {uploading ? "Chargement…" : "Ajouter un justificatif"}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handlePieceChange} disabled={uploading} />
              </label>
            )}
          </Field>
          <p className="text-[12px] text-ink-soft">
            Le statut (« {st.label} ») n'est pas modifiable ici : il suit le circuit d'autorisation.
          </p>
        </form>
      )}

      <ConfirmSuppressionModal
        open={confirmOuvert}
        titre="Supprimer cette dépense ?"
        description={`Vous allez supprimer définitivement la dépense « ${affichee.categorie} » de ${fmtFCFA(affichee.montant)}.`}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmOuvert(false)}
      />
    </Modal>
  );
}
