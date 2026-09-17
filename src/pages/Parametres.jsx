import { useState } from "react";
import { Save, Plus, Trash2, FolderPlus, Building2, ShieldCheck, Settings, AlertTriangle, MapPin, LayoutGrid, ChevronRight } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Field, { TextInput, Select } from "../components/ui/Field";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import { ROLES_ACCES_TOTAL, decoupeNomVille, groupesModules } from "../lib/modules";
import { reinitialiserBaseDeDonnees, TABLES_A_REINITIALISER, TABLES_NON_SCOPABLES } from "../lib/resetApplication";
import { supabase } from "../lib/supabaseClient";
import ConfirmSuppressionModal from "../components/ui/ConfirmSuppressionModal";
import { enregistrerMotifSuppression } from "../lib/motifSuppression";

export default function Parametres() {
  const { user } = useAuthStore();
  const { secteurs, categories, addCategorie, supprimerCategorie, addSecteur, modifierSecteur, dupliquerSecteurVille, archiverEtSupprimerModule } = useDataStore();

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
        <SectionCategories secteurs={secteurs} categories={categories} addCategorie={addCategorie} supprimerCategorie={supprimerCategorie} user={user} />
        <SectionSecteurs secteurs={secteurs} addSecteur={addSecteur} modifierSecteur={modifierSecteur} dupliquerSecteurVille={dupliquerSecteurVille} archiverEtSupprimerModule={archiverEtSupprimerModule} user={user} />
        {user?.role === "super_admin" && <SectionZoneDanger user={user} secteurs={secteurs} />}
      </div>
    </div>
  );
}

const PHRASE_TOUT = "SUPPRIMER TOUT";

// Réinitialisation des DONNÉES — soit TOUT (tous secteurs + tous les autres
// comptes), soit CIBLÉE sur un secteur précis ou un module entier décliné
// par ville (Lomé + Kara...), à la demande explicite de l'utilisateur
// (2026-09-15) : « quand tu cliques sur la réinitialisation on doit te
// demander quel secteur/module tu veux réinitialiser ». Strictement réservé
// au super-administrateur. Double confirmation volontairement lourde (phrase
// à recopier + mot de passe re-saisi) dans les deux cas : action IRRÉVERSIBLE.
function SectionZoneDanger({ user, secteurs }) {
  const { login, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [etape, setEtape] = useState("cible"); // "cible" | "phrase" | "motdepasse" | "suppression" | "termine"
  const [cible, setCible] = useState(null); // { type: "tout" } | { type: "secteur", ids, label }
  const [phrase, setPhrase] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [verification, setVerification] = useState(false);
  const [progression, setProgression] = useState(null);
  const groupes = groupesModules(secteurs.filter((s) => s.actif !== false));
  const phraseAttendue = cible?.type === "tout" ? PHRASE_TOUT : cible?.label?.toUpperCase() || "";

  function fermer() {
    if (etape === "suppression") return; // pas d'annulation en cours de suppression
    setOpen(false);
    setEtape("cible");
    setCible(null);
    setPhrase("");
    setMotDePasse("");
    setErreur("");
    setProgression(null);
  }

  function choisirCible(c) {
    setCible(c);
    setPhrase("");
    setErreur("");
    setEtape("phrase");
  }

  async function confirmerMotDePasse() {
    setErreur("");
    if (!motDePasse) return setErreur("Saisissez votre mot de passe.");
    setVerification(true);
    try {
      const res = await login(user.login, motDePasse);
      if (!res.ok) return setErreur(res.error || "Mot de passe incorrect.");
      setEtape("suppression");
      const scoped = cible.type === "secteur";
      const resultats = await reinitialiserBaseDeDonnees({
        keepUserId: user.uid,
        secteurIds: scoped ? cible.ids : undefined,
        onProgress: (info) => setProgression(info),
      });
      const totalSupprime = resultats.reduce((s, r) => s + r.removed, 0);
      const echecs = resultats.filter((r) => !r.ok);
      await supabase.from("journal").insert({
        user_id: user.uid,
        user_nom: user.nom,
        role: user.role,
        module: "parametres",
        action: scoped ? "RESET_SECTEUR" : "RESET_BASE_DE_DONNEES",
        details: scoped
          ? `Réinitialisation ciblée « ${cible.label} » (${totalSupprime} enregistrements supprimés sur ${resultats.length} tables${echecs.length ? `, ${echecs.length} table(s) en échec` : ""})`
          : `Réinitialisation de la base (${totalSupprime} enregistrements supprimés sur ${resultats.length} tables${echecs.length ? `, ${echecs.length} table(s) en échec` : ""})`,
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
    if (cible?.type === "tout") await logout();
    window.location.reload();
  }

  return (
    <>
      <GlassCard className="p-6" hover={false} style={{ border: "1px solid rgba(255,69,58,0.3)" }}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#FF453A]" />
          <div>
            <h3 className="font-bold tracking-tight text-[#b3241b]">⚠️ Zone de danger : réinitialiser des données</h3>
            <p className="mt-1 text-[12.5px] text-[#b3241b]">
              Supprime définitivement soit TOUTES les données de tous les secteurs et modules ({TABLES_A_REINITIALISER.length} tables), soit UNIQUEMENT celles d'un secteur ou d'un module précis, à choisir juste après. Les secteurs eux-mêmes restent toujours conservés. Cette action est irréversible.
            </p>
            <Button variant="danger" className="mt-3" icon={Trash2} onClick={() => setOpen(true)}>
              Réinitialiser des données
            </Button>
          </div>
        </div>
      </GlassCard>

      <Modal
        open={open}
        onClose={fermer}
        title="Réinitialisation de données"
        icon={AlertTriangle}
        accent="#FF453A"
        footer={
          etape === "phrase" ? (
            <>
              <Button variant="ghost" onClick={() => setEtape("cible")}>Retour</Button>
              <Button variant="danger" disabled={phrase.trim().toUpperCase() !== phraseAttendue} onClick={() => setEtape("motdepasse")}>
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
            <Button variant="danger" onClick={terminerEtRecharger}>
              {cible?.type === "tout" ? "Fermer et recharger l'application" : "Fermer et actualiser"}
            </Button>
          ) : null
        }
      >
        {etape === "cible" && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-soft">Que veux-tu réinitialiser ?</p>
            <button
              type="button"
              onClick={() => choisirCible({ type: "tout" })}
              className="flex items-center gap-3 rounded-2xl border border-[#FF453A]/30 bg-[#FF453A]/[0.06] px-4 py-3 text-left hover:bg-[#FF453A]/10 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF453A]/15 text-[#b3241b]">
                <AlertTriangle size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[13px] text-[#b3241b]">Toute la base</p>
                <p className="text-[11.5px] text-[#b3241b]/80">Tous les secteurs, tous les modules, tous les autres comptes utilisateurs.</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-[#b3241b]/60" />
            </button>

            <p className="mt-1 text-[11.5px] font-bold uppercase tracking-wide text-ink-soft/70">Ou un seul secteur / module</p>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {groupes.map((g) => {
                const ids = g.modules.map((m) => m.id);
                const label = g.modules.length > 1 ? g.base : g.modules[0].nom;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => choisirCible({ type: "secteur", ids, label })}
                    className="flex items-center gap-3 rounded-2xl bg-black/[0.03] px-4 py-2.5 text-left hover:bg-black/[0.06] transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.modules[0].color }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[12.5px] text-ink">{label}</p>
                      {g.modules.length > 1 && <p className="text-[10.5px] text-ink-soft">{g.modules.map((m) => m.ville).join(" + ")}</p>}
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-ink-soft/50" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {etape === "phrase" && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-[#b3241b]">
              {cible?.type === "tout"
                ? "Cette action supprime définitivement toutes les données de tous les secteurs et modules. Irréversible."
                : `Cette action supprime définitivement les données de « ${cible?.label} » (dépenses, recettes, budgets, catégories, transport/clients/etc. selon le module). Irréversible.`}
            </p>
            {cible?.type === "secteur" && (
              <p className="text-[11.5px] text-ink-soft bg-black/[0.03] rounded-xl px-3 py-2">
                Certaines données ({TABLES_NON_SCOPABLES.length} tables) ne sont pas (encore) séparées par lieu : stock/magasin partagé de MAXI AGRO et E-BRIQUETERIE, fiches E-GARDERIE/E-FONCIER/E-G.PRO tant qu'un seul lieu existe, banque, partenaires... Celles-ci ne seront jamais touchées par un reset ciblé, pour ne pas risquer de vider les données d'un autre secteur du même module.
              </p>
            )}
            <p className="text-[13px] text-ink-soft">Pour continuer, recopiez exactement la phrase suivante :</p>
            <p className="rounded-xl bg-black/[0.04] px-3 py-2 text-center font-mono text-[13px] font-bold tracking-wide text-ink">
              {phraseAttendue}
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
            <p className="text-[13px] font-semibold text-ink">Réinitialisation en cours : ne fermez pas cette fenêtre…</p>
            {progression && (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full bg-[#FF453A] transition-all"
                    style={{ width: `${Math.round((progression.index / progression.total) * 100)}%` }}
                  />
                </div>
                <p className="text-[11.5px] text-ink-soft">
                  {progression.index} / {progression.total} tables traitées : {progression.table}
                </p>
              </>
            )}
          </div>
        )}

        {etape === "termine" && (
          <div className="flex flex-col gap-2 py-2 text-center">
            <p className="text-[13px] font-semibold text-[#1a7d34]">Réinitialisation terminée ✓</p>
            <p className="text-[13px] text-ink-soft">
              {cible?.type === "tout"
                ? "L'application va se déconnecter et recharger sur un état vierge."
                : `Les données de « ${cible?.label} » ont été réinitialisées. La page va s'actualiser.`}
            </p>
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

function SectionCategories({ secteurs, categories, addCategorie, supprimerCategorie, user }) {
  const [secteurId, setSecteurId] = useState(secteurs[0]?.id || "");
  const [nouvelle, setNouvelle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmCible, setConfirmCible] = useState(null);

  const liste = categories.filter((c) => c.secteurId === (secteurId || secteurs[0]?.id));

  async function confirmerSuppression(motif) {
    await enregistrerMotifSuppression({ user, table: "categories", label: confirmCible.nom, motif, secteurId: confirmCible.secteurId });
    return supprimerCategorie(confirmCible.id);
  }

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
            <button onClick={() => setConfirmCible(c)} className="text-ink-soft hover:text-[#FF453A] transition-colors" title="Supprimer">
              <Trash2 size={12} strokeWidth={2.4} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <TextInput value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} placeholder="Nouvelle catégorie" className="max-w-xs" />
        <Button variant="ghost" icon={FolderPlus} onClick={ajouter} disabled={saving}>Ajouter</Button>
      </div>

      <ConfirmSuppressionModal
        open={!!confirmCible}
        titre="Supprimer cette catégorie ?"
        description={confirmCible ? `Vous allez supprimer la catégorie « ${confirmCible.nom} ».` : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmCible(null)}
      />
    </GlassCard>
  );
}

// Modules dont le stock/magasin est encore une liste UNIQUE, partagée par
// tous les secteurs (pas de colonne secteur_id) : MAXI AGRO (cheptel +
// magasin) et E-BRIQUETERIE (matériel + types de briques). Contrairement à
// MAXI GYM/MAXI LOGISTIQUE (déjà scindés par ville), dupliquer l'un de ces
// modules aujourd'hui donnerait deux secteurs qui PARTAGENT le même stock —
// on prévient l'utilisateur dans la modale plutôt que de le laisser
// découvrir le problème en usage réel.
const PREFIXES_STOCK_PARTAGE = ["MAXI AGRO", "E-BRIQUETERIE"];

function SectionSecteurs({ secteurs, addSecteur, modifierSecteur, dupliquerSecteurVille, archiverEtSupprimerModule, user }) {
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
      <p className="text-[12.5px] text-ink-soft mb-4">Modifier le nom, la couleur ou désactiver un secteur (un secteur désactivé reste visible dans l'historique mais disparaît des formulaires de saisie). « Ajouter un lieu » décline un module existant sur une autre ville (ex. « E-BRIQUETERIE SOKODÉ ») avec les mêmes volets, sans toucher au code — les villes d'un même module apparaissent ensuite groupées sur une seule ligne, comme des pastilles cliquables (clic = activer/désactiver ce lieu précis).</p>

      <div className="flex flex-col gap-2">
        {groupesModules(secteurs).map((g) =>
          g.modules.length > 1 ? (
            <GroupeSecteurVilles key={g.base} groupe={g} modifierSecteur={modifierSecteur} dupliquerSecteurVille={dupliquerSecteurVille} archiverEtSupprimerModule={archiverEtSupprimerModule} user={user} />
          ) : (
            <RowSecteur key={g.modules[0].id} secteur={g.modules[0]} modifierSecteur={modifierSecteur} dupliquerSecteurVille={dupliquerSecteurVille} archiverEtSupprimerModule={archiverEtSupprimerModule} user={user} />
          )
        )}
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

function RowSecteur({ secteur, modifierSecteur, dupliquerSecteurVille, archiverEtSupprimerModule, user }) {
  const [nom, setNom] = useState(secteur.nom);
  const [color, setColor] = useState(secteur.color || "#0A84FF");
  const [actif, setActif] = useState(secteur.actif !== false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [confirmSuppression, setConfirmSuppression] = useState(false);
  const [ajoutLieu, setAjoutLieu] = useState(null); // { ville, color } | null
  const [ajoutSaving, setAjoutSaving] = useState(false);
  const [ajoutError, setAjoutError] = useState("");
  const dirty = nom !== secteur.nom || color !== (secteur.color || "#0A84FF") || actif !== (secteur.actif !== false);
  const stockPartage = PREFIXES_STOCK_PARTAGE.some((p) => secteur.nom.toUpperCase().startsWith(p));

  async function enregistrer() {
    await modifierSecteur(secteur.id, { nom, label: secteur.label, color, actif });
  }

  async function confirmerSuppression(motif) {
    setDeleting(true);
    setError("");
    await enregistrerMotifSuppression({ user, table: "secteurs", label: secteur.nom, motif, secteurId: secteur.id });
    const res = await archiverEtSupprimerModule({ secteurIds: [secteur.id], label: secteur.nom, user });
    setDeleting(false);
    if (!res.ok) setError(res.error);
    return res;
  }

  function ouvrirAjoutLieu() {
    setAjoutLieu({ ville: "", color: "#0A84FF" });
    setAjoutError("");
  }

  async function confirmerAjoutLieu() {
    if (!ajoutLieu.ville.trim()) return setAjoutError("Nom de la ville requis");
    setAjoutSaving(true);
    setAjoutError("");
    const res = await dupliquerSecteurVille(secteur.id, ajoutLieu.ville, ajoutLieu.color);
    setAjoutSaving(false);
    if (!res.ok) return setAjoutError(res.error);
    setAjoutLieu(null);
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
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {dirty && (
            <Button variant="ghost" icon={Save} onClick={enregistrer} className="shrink-0">Enregistrer</Button>
          )}
          <button
            onClick={ouvrirAjoutLieu}
            title="Ajouter un lieu (décliner ce module sur une autre ville)"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-[#0A84FF]/10 hover:text-[#0A84FF] transition-colors shrink-0"
          >
            <MapPin size={15} strokeWidth={2.2} />
          </button>
          <button
            onClick={() => setConfirmSuppression(true)}
            disabled={deleting}
            title="Supprimer"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-[#FF453A]/10 hover:text-[#FF453A] transition-colors shrink-0"
          >
            <Trash2 size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>
      {error && <p className="text-[12px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2">{error}</p>}

      <ConfirmSuppressionModal
        open={confirmSuppression}
        titre="Supprimer ce secteur ?"
        description={`Vous allez supprimer définitivement le secteur « ${secteur.nom} ». Cette action est irréversible.`}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmSuppression(false)}
      />

      <Modal
        open={!!ajoutLieu}
        onClose={() => setAjoutLieu(null)}
        title="Ajouter un lieu"
        icon={MapPin}
        accent="#0A84FF"
        footer={<><Button variant="ghost" onClick={() => setAjoutLieu(null)}>Annuler</Button><Button onClick={confirmerAjoutLieu} disabled={ajoutSaving}>{ajoutSaving ? "Création…" : "Créer"}</Button></>}
      >
        {ajoutLieu && (
          <form onSubmit={(e) => { e.preventDefault(); confirmerAjoutLieu(); }}>
            {ajoutError && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{ajoutError}</p>}
            <p className="text-[12.5px] text-ink-soft mb-3">
              Décline « {decoupeNomVille(secteur.nom).base || secteur.nom} » sur une autre ville : un nouveau secteur est créé, avec les mêmes volets, des données totalement séparées. {!decoupeNomVille(secteur.nom).ville && <>« {secteur.nom} » devient automatiquement « {secteur.nom} LOMÉ » (le lieu déjà en service).</>}
            </p>
            <Field label="Nom de la ville *">
              <TextInput value={ajoutLieu.ville} onChange={(e) => setAjoutLieu((a) => ({ ...a, ville: e.target.value }))} placeholder="ex : Sokodé" autoFocus />
            </Field>
            <Field label="Couleur">
              <input type="color" value={ajoutLieu.color} onChange={(e) => setAjoutLieu((a) => ({ ...a, color: e.target.value }))} className="h-10 w-20 rounded-xl cursor-pointer" />
            </Field>
            {stockPartage && (
              <p className="flex items-start gap-2 text-[12px] text-[#93400a] bg-[#FF9F0A1a] rounded-xl px-3 py-2 mt-1">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                Le stock de ce module (magasin/cheptel) est aujourd'hui une liste unique, partagée entre tous ses lieux — les deux villes verront le même stock tant que ce n'est pas séparé (comme cela a été fait pour MAXI GYM et MAXI LOGISTIQUE). Dépenses, recettes et budgets restent bien séparés dès maintenant.
              </p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

// Un module déjà décliné en plusieurs villes (MAXI GYM, MAXI LOGISTIQUE...)
// tient sur UNE SEULE ligne : chaque ville devient une pastille cliquable
// (clic = activer/désactiver CE lieu précis, croix = le supprimer), plutôt
// que d'empiler une ligne complète par ville — à la demande explicite de
// l'utilisateur (2026-09-15).
function GroupeSecteurVilles({ groupe, modifierSecteur, dupliquerSecteurVille, archiverEtSupprimerModule, user }) {
  const [confirmCible, setConfirmCible] = useState(null); // secteur (un seul lieu) à supprimer
  const [confirmModule, setConfirmModule] = useState(false); // suppression du module entier (tous les lieux)
  const [ajoutLieu, setAjoutLieu] = useState(null);
  const [ajoutSaving, setAjoutSaving] = useState(false);
  const [ajoutError, setAjoutError] = useState("");
  const [error, setError] = useState("");
  const principal = groupe.modules[0];
  const stockPartage = PREFIXES_STOCK_PARTAGE.some((p) => groupe.base.toUpperCase().startsWith(p));

  async function toggleActif(secteur) {
    setError("");
    const res = await modifierSecteur(secteur.id, { nom: secteur.nom, label: secteur.label, color: secteur.color, actif: !(secteur.actif !== false) });
    if (!res.ok) setError(res.error);
  }

  async function confirmerSuppression(motif) {
    const s = confirmCible;
    await enregistrerMotifSuppression({ user, table: "secteurs", label: s.nom, motif, secteurId: s.id });
    return archiverEtSupprimerModule({ secteurIds: [s.id], label: s.nom, user });
  }

  async function confirmerSuppressionModule(motif) {
    const ids = groupe.modules.map((m) => m.id);
    await enregistrerMotifSuppression({ user, table: "secteurs", label: groupe.base, motif, secteurId: principal.id });
    return archiverEtSupprimerModule({ secteurIds: ids, label: groupe.base, user });
  }

  function ouvrirAjoutLieu() {
    setAjoutLieu({ ville: "", color: principal.color });
    setAjoutError("");
  }

  async function confirmerAjoutLieu() {
    if (!ajoutLieu.ville.trim()) return setAjoutError("Nom de la ville requis");
    setAjoutSaving(true);
    setAjoutError("");
    const res = await dupliquerSecteurVille(principal.id, ajoutLieu.ville, ajoutLieu.color);
    setAjoutSaving(false);
    if (!res.ok) return setAjoutError(res.error);
    setAjoutLieu(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-black/[0.02] flex-wrap">
        <div className="w-8 h-8 rounded-lg shrink-0" style={{ background: principal.color }} />
        <p className="font-semibold text-[13.5px] text-ink shrink-0">{groupe.base}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {groupe.modules.map((s) => {
            const actif = s.actif !== false;
            return (
              <span
                key={s.id}
                className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[11.5px] font-bold"
                style={actif ? { background: `${s.color}1a`, color: s.color } : { background: "rgba(0,0,0,0.05)", color: "#8E8E93" }}
              >
                <button type="button" onClick={() => toggleActif(s)} title={actif ? "Cliquer pour désactiver ce lieu" : "Cliquer pour réactiver ce lieu"}>
                  {s.ville}
                </button>
                <button type="button" onClick={() => setConfirmCible(s)} title="Supprimer ce lieu" className="opacity-70 hover:opacity-100 hover:text-[#FF453A] transition-colors">
                  <Trash2 size={12} strokeWidth={2.4} />
                </button>
              </span>
            );
          })}
        </div>
        <button
          onClick={ouvrirAjoutLieu}
          title="Ajouter un lieu (décliner ce module sur une autre ville)"
          className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-[#0A84FF]/10 hover:text-[#0A84FF] transition-colors shrink-0 ml-auto"
        >
          <MapPin size={15} strokeWidth={2.2} />
        </button>
        <button
          onClick={() => setConfirmModule(true)}
          title="Supprimer tout le module (tous les lieux)"
          className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-[#FF453A]/10 hover:text-[#FF453A] transition-colors shrink-0"
        >
          <Trash2 size={15} strokeWidth={2.2} />
        </button>
      </div>
      {error && <p className="text-[12px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2">{error}</p>}

      <ConfirmSuppressionModal
        open={!!confirmCible}
        titre="Supprimer ce lieu ?"
        description={confirmCible ? `Vous allez supprimer définitivement « ${confirmCible.nom} ». Ses dépenses, recettes et actions déjà enregistrées seront conservées dans les Archives. Cette action est irréversible.` : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmCible(null)}
      />

      <ConfirmSuppressionModal
        open={confirmModule}
        titre="Supprimer tout le module ?"
        description={`Vous allez supprimer définitivement « ${groupe.base} » et TOUS ses lieux (${groupe.modules.map((m) => m.ville).join(", ")}). Ses dépenses, recettes et actions déjà enregistrées seront conservées dans les Archives. Cette action est irréversible.`}
        onConfirm={confirmerSuppressionModule}
        onClose={() => setConfirmModule(false)}
      />

      <Modal
        open={!!ajoutLieu}
        onClose={() => setAjoutLieu(null)}
        title="Ajouter un lieu"
        icon={MapPin}
        accent="#0A84FF"
        footer={<><Button variant="ghost" onClick={() => setAjoutLieu(null)}>Annuler</Button><Button onClick={confirmerAjoutLieu} disabled={ajoutSaving}>{ajoutSaving ? "Création…" : "Créer"}</Button></>}
      >
        {ajoutLieu && (
          <form onSubmit={(e) => { e.preventDefault(); confirmerAjoutLieu(); }}>
            {ajoutError && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{ajoutError}</p>}
            <p className="text-[12.5px] text-ink-soft mb-3">Décline « {groupe.base} » sur une autre ville : un nouveau secteur est créé, avec les mêmes volets, des données totalement séparées.</p>
            <Field label="Nom de la ville *">
              <TextInput value={ajoutLieu.ville} onChange={(e) => setAjoutLieu((a) => ({ ...a, ville: e.target.value }))} placeholder="ex : Sokodé" autoFocus />
            </Field>
            <Field label="Couleur">
              <input type="color" value={ajoutLieu.color} onChange={(e) => setAjoutLieu((a) => ({ ...a, color: e.target.value }))} className="h-10 w-20 rounded-xl cursor-pointer" />
            </Field>
            {stockPartage && (
              <p className="flex items-start gap-2 text-[12px] text-[#93400a] bg-[#FF9F0A1a] rounded-xl px-3 py-2 mt-1">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                Le stock de ce module (magasin/cheptel) est aujourd'hui une liste unique, partagée entre tous ses lieux — les villes verront le même stock tant que ce n'est pas séparé. Dépenses, recettes et budgets restent bien séparés dès maintenant.
              </p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
