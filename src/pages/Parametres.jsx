import { useState } from "react";
import { Save, Plus, Trash2, FolderPlus, Building2, ShieldCheck } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Field, { TextInput, Select } from "../components/ui/Field";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import { ROLES_ACCES_TOTAL } from "../lib/modules";

export default function Parametres() {
  const { user } = useAuthStore();
  const { secteurs, categories, addCategorie, supprimerCategorie, addSecteur, modifierSecteur, supprimerSecteur } = useDataStore();

  if (!ROLES_ACCES_TOTAL.includes(user?.role)) {
    return (
      <GlassCard className="p-8 text-center" hover={false}>
        <p className="text-[13.5px] text-ink-soft">Cette page est réservée aux rôles à accès total.</p>
      </GlassCard>
    );
  }

  return (
    <div>
      <TopBar title="Paramètres" subtitle="Configuration du module E-DÉPENSES" />
      <div className="flex flex-col gap-5">
        <SectionCircuitAutorisation />
        <SectionCategories secteurs={secteurs} categories={categories} addCategorie={addCategorie} supprimerCategorie={supprimerCategorie} />
        <SectionSecteurs secteurs={secteurs} addSecteur={addSecteur} modifierSecteur={modifierSecteur} supprimerSecteur={supprimerSecteur} />
      </div>
    </div>
  );
}

// Le circuit d'autorisation n'a plus de seuil fixe à configurer : il se
// déclenche automatiquement dès qu'une dépense ferait dépasser le budget
// alloué au secteur pour le mois (voir Tableau de bord → Budget par
// secteur) — panneau purement informatif, rien à enregistrer ici.
function SectionCircuitAutorisation() {
  return (
    <GlassCard className="p-6" hover={false}>
      <h3 className="font-bold tracking-tight text-ink mb-1 flex items-center gap-2">
        <ShieldCheck size={17} className="text-ink-soft" /> Circuit d'autorisation
      </h3>
      <p className="text-[12.5px] text-ink-soft">
        Une dépense déclenche automatiquement le circuit d'approbation (PAU / GE / direction) dès que son montant, ajouté aux dépenses déjà saisies ce mois-ci pour le secteur, dépasserait le budget alloué à ce secteur. En l'absence de budget défini pour le secteur et le mois, toute dépense passe systématiquement en attente d'approbation. Il n'y a plus de seuil fixe à configurer : ajustez plutôt le budget de chaque secteur, mois par mois, depuis le tableau de bord.
      </p>
    </GlassCard>
  );
}

function SectionCategories({ secteurs, categories, addCategorie, supprimerCategorie }) {
  const [secteurId, setSecteurId] = useState(secteurs[0]?.id || "");
  const [nouvelle, setNouvelle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const liste = categories.filter((c) => c.secteurId === (secteurId || secteurs[0]?.id));

  async function ajouter() {
    if (!nouvelle.trim() || !secteurId) return;
    setSaving(true);
    setError("");
    const res = await addCategorie(secteurId, nouvelle);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setNouvelle("");
  }

  return (
    <GlassCard className="p-6" hover={false}>
      <h3 className="font-bold tracking-tight text-ink mb-1">Catégories de dépense par secteur</h3>
      <p className="text-[12.5px] text-ink-soft mb-4">Chaque secteur dispose de sa propre liste de catégories, proposée dans le formulaire de saisie d'une dépense.</p>

      <Field label="Secteur">
        <Select value={secteurId} onChange={(e) => setSecteurId(e.target.value)} className="max-w-xs">
          {secteurs.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </Select>
      </Field>

      {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        {liste.length === 0 && <p className="text-[12.5px] text-ink-soft italic">Aucune catégorie pour ce secteur.</p>}
        {liste.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold bg-black/[0.04] text-ink">
            {c.nom}
            <button onClick={() => supprimerCategorie(c.id)} className="text-ink-soft hover:text-[#FF453A] transition-colors" title="Supprimer">
              <Trash2 size={12} strokeWidth={2.4} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <TextInput value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} placeholder="Nouvelle catégorie" className="max-w-xs" />
        <Button variant="ghost" icon={FolderPlus} onClick={ajouter} disabled={saving}>Ajouter</Button>
      </div>
    </GlassCard>
  );
}

function SectionSecteurs({ secteurs, addSecteur, modifierSecteur, supprimerSecteur }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nom: "", label: "", color: "#0A84FF" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);
    setError("");
    const res = await addSecteur(form);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setForm({ nom: "", label: "", color: "#0A84FF" });
  }

  return (
    <GlassCard className="p-6" hover={false}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold tracking-tight text-ink flex items-center gap-2">
          <Building2 size={17} className="text-ink-soft" /> Secteurs d'activité
        </h3>
        <Button variant="ghost" icon={Plus} onClick={() => setOpen(true)}>Ajouter un secteur</Button>
      </div>
      <p className="text-[12.5px] text-ink-soft mb-4">Modifier le nom, la couleur ou désactiver un secteur (un secteur désactivé reste visible dans l'historique mais disparaît des formulaires de saisie).</p>

      <div className="flex flex-col gap-2">
        {secteurs.map((s) => (
          <RowSecteur key={s.id} secteur={s} modifierSecteur={modifierSecteur} supprimerSecteur={supprimerSecteur} />
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajouter un secteur"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button icon={Plus} onClick={submit} disabled={saving}>{saving ? "Création…" : "Créer"}</Button>
          </>
        }
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Nom *">
            <TextInput value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex : MAXI COM" />
          </Field>
          <Field label="Libellé affiché">
            <TextInput value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="ex : Communication" />
          </Field>
          <Field label="Couleur">
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-20 rounded-xl cursor-pointer" />
          </Field>
        </form>
      </Modal>
    </GlassCard>
  );
}

function RowSecteur({ secteur, modifierSecteur, supprimerSecteur }) {
  const [nom, setNom] = useState(secteur.nom);
  const [color, setColor] = useState(secteur.color || "#0A84FF");
  const [actif, setActif] = useState(secteur.actif !== false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const dirty = nom !== secteur.nom || color !== (secteur.color || "#0A84FF") || actif !== (secteur.actif !== false);

  async function enregistrer() {
    await modifierSecteur(secteur.id, { nom, label: secteur.label, color, actif });
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer définitivement le secteur « ${secteur.nom} » ? Cette action est irréversible.`)) return;
    setDeleting(true);
    setError("");
    const res = await supprimerSecteur(secteur.id);
    setDeleting(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-black/[0.02]">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer shrink-0" />
        <TextInput value={nom} onChange={(e) => setNom(e.target.value)} className="max-w-[220px]" />
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink shrink-0">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="w-4 h-4 rounded accent-[#0A84FF]" />
          Actif
        </label>
        {dirty && (
          <Button variant="ghost" icon={Save} onClick={enregistrer} className="ml-auto shrink-0">Enregistrer</Button>
        )}
        <button
          onClick={supprimer}
          disabled={deleting}
          title="Supprimer"
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-[#FF453A]/10 hover:text-[#FF453A] transition-colors shrink-0 ${dirty ? "" : "ml-auto"}`}
        >
          <Trash2 size={15} strokeWidth={2.2} />
        </button>
      </div>
      {error && <p className="text-[12px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2">{error}</p>}
    </div>
  );
}
