import { useState } from "react";
import { Save, Plus, Trash2, FolderPlus, Building2, ShieldCheck, Settings, AlertTriangle } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Field, { TextInput, Select } from "../components/ui/Field";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import { ROLES_ACCES_TOTAL } from "../lib/modules";
import { reinitialiserBaseDeDonnees, TABLES_A_REINITIALISER } from "../lib/resetApplication";
import { supabase } from "../lib/supabaseClient";

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
      <TopBar title="Paramètres" subtitle="Configuration du module E-DÉPENSES" icon={Settings} accent="#8E8E93" />
      <div className="flex flex-col gap-5">
        <SectionCircuitAutorisation />
        <SectionCategories secteurs={secteurs} categories={categories} addCategorie={addCategorie} supprimerCategorie={supprimerCategorie} />
        <SectionSecteurs secteurs={secteurs} addSecteur={addSecteur} modifierSecteur={modifierSecteur} supprimerSecteur={supprimerSecteur} />
        {user?.role === "super_admin" && <SectionZoneDanger user={user} />}
      </div>
    </div>
  );
}

const PHRASE_CONFIRMATION = "SUPPRIMER TOUT";

// Réinitialisation complète des DONNÉES de l'application — strictement
// réservée au super-administrateur. Double confirmation volontairement lourde
// (phrase à recopier + mot de passe re-saisi) : action IRRÉVERSIBLE.
function SectionZoneDanger({ user }) {
  const { login, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [etape, setEtape] = useState("phrase"); // "phrase" | "motdepasse" | "suppression" | "termine"
  const [phrase, setPhrase] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [verification, setVerification] = useState(false);
  const [progression, setProgression] = useState(null);

  function fermer() {
    if (etape === "suppression") return; // pas d'annulation en cours de suppression
    setOpen(false);
    setEtape("phrase");
    setPhrase("");
    setMotDePasse("");
    setErreur("");
    setProgression(null);
  }

  async function confirmerMotDePasse() {
    setErreur("");
    if (!motDePasse) return setErreur("Saisissez votre mot de passe.");
    setVerification(true);
    try {
      const res = await login(user.login, motDePasse);
      if (!res.ok) return setErreur(res.error || "Mot de passe incorrect.");
      setEtape("suppression");
      const resultats = await reinitialiserBaseDeDonnees({
        keepUserId: user.uid,
        onProgress: (info) => setProgression(info),
      });
      const totalSupprime = resultats.reduce((s, r) => s + r.removed, 0);
      const echecs = resultats.filter((r) => !r.ok);
      await supabase.from("journal").insert({
        user_id: user.uid,
        user_nom: user.nom,
        role: user.role,
        module: "parametres",
        action: "RESET_BASE_DE_DONNEES",
        details: `Réinitialisation de la base (${totalSupprime} enregistrements supprimés sur ${resultats.length} tables${echecs.length ? `, ${echecs.length} table(s) en échec` : ""})`,
      });
      setEtape("termine");
    } catch (e) {
      setErreur(e?.message || "Une erreur est survenue pendant la réinitialisation.");
      setEtape("motdepasse");
    } finally {
      setVerification(false);
    }
  }

  async function terminerEtRecharger() {
    await logout();
    window.location.reload();
  }

  return (
    <>
      <GlassCard className="p-6" hover={false} style={{ border: "1px solid rgba(255,69,58,0.3)" }}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#FF453A]" />
          <div>
            <h3 className="font-bold tracking-tight text-[#b3241b]">⚠️ Zone de danger — réinitialiser la base de données</h3>
            <p className="mt-1 text-[12.5px] text-[#b3241b]">
              Supprime définitivement les données de tous les secteurs et modules ({TABLES_A_REINITIALISER.length} tables :
              dépenses, recettes, stocks, budgets, journal…). Les secteurs eux-mêmes et les autres comptes
              utilisateurs sont conservés (seuls leurs mouvements/données sont vidés). Cette action est irréversible.
            </p>
            <Button variant="danger" className="mt-3" icon={Trash2} onClick={() => setOpen(true)}>
              Réinitialiser la base de données
            </Button>
          </div>
        </div>
      </GlassCard>

      <Modal
        open={open}
        onClose={fermer}
        title="Réinitialisation de la base de données"
        icon={AlertTriangle}
        accent="#FF453A"
        footer={
          etape === "phrase" ? (
            <>
              <Button variant="ghost" onClick={fermer}>Annuler</Button>
              <Button variant="danger" disabled={phrase !== PHRASE_CONFIRMATION} onClick={() => setEtape("motdepasse")}>
                Continuer
              </Button>
            </>
          ) : etape === "motdepasse" ? (
            <>
              <Button variant="ghost" onClick={fermer}>Annuler</Button>
              <Button variant="danger" disabled={verification} onClick={confirmerMotDePasse}>
                {verification ? "Vérification…" : "Confirmer la réinitialisation"}
              </Button>
            </>
          ) : etape === "termine" ? (
            <Button variant="danger" onClick={terminerEtRecharger}>Fermer et recharger l'application</Button>
          ) : null
        }
      >
        {etape === "phrase" && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-[#b3241b]">
              Cette action supprime définitivement toutes les données de tous les secteurs et modules. Irréversible.
            </p>
            <p className="text-[13px] text-ink-soft">Pour continuer, recopiez exactement la phrase suivante :</p>
            <p className="rounded-xl bg-black/[0.04] px-3 py-2 text-center font-mono text-[13px] font-bold tracking-wide text-ink">
              {PHRASE_CONFIRMATION}
            </p>
            <TextInput
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="Recopiez la phrase ci-dessus"
              autoFocus
            />
          </div>
        )}

        {etape === "motdepasse" && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-soft">Dernière étape : ressaisissez votre mot de passe pour confirmer.</p>
            <TextInput
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="Votre mot de passe"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && confirmerMotDePasse()}
            />
            {erreur && <p className="text-[12.5px] font-semibold text-[#FF453A]">{erreur}</p>}
          </div>
        )}

        {etape === "suppression" && (
          <div className="flex flex-col gap-3 py-4 text-center">
            <p className="text-[13px] font-semibold text-ink">Réinitialisation en cours — ne fermez pas cette fenêtre…</p>
            {progression && (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full bg-[#FF453A] transition-all"
                    style={{ width: `${Math.round((progression.index / progression.total) * 100)}%` }}
                  />
                </div>
                <p className="text-[11.5px] text-ink-soft">
                  {progression.index} / {progression.total} tables traitées — {progression.table}
                </p>
              </>
            )}
          </div>
        )}

        {etape === "termine" && (
          <div className="flex flex-col gap-2 py-2 text-center">
            <p className="text-[13px] font-semibold text-[#1a7d34]">Réinitialisation terminée ✓</p>
            <p className="text-[13px] text-ink-soft">L'application va se déconnecter et recharger sur un état vierge.</p>
          </div>
        )}

        {erreur && etape === "phrase" && <p className="mt-2 text-[12.5px] font-semibold text-[#FF453A]">{erreur}</p>}
      </Modal>
    </>
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
        icon={Settings}
        accent="#8E8E93"
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
