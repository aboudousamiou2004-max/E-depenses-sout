import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { ArrowLeft, Plus, UserPlus, Check, Trash2, ChevronDown, QrCode, Copy, CopyCheck, Pencil, Save } from "lucide-react";
import GlassCard from "../../components/ui/GlassCard";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { ROLES } from "../../data/seed";
import { tousLesModules, ROLES_ACCES_TOTAL, groupesModules } from "../../lib/modules";
import ConfirmSuppressionModal from "../../components/ui/ConfirmSuppressionModal";
import { enregistrerMotifSuppression } from "../../lib/motifSuppression";

const empty = () => ({ login: "", nom: "", pass: "", role: "agent", secteur: "", poste: "", telephone: "", actif: true, modules: [] });

export default function Utilisateurs() {
  const { users, secteurs, addUser, modifierAccesUtilisateur, modifierActifUtilisateur, modifierUtilisateur, supprimerUtilisateur } = useDataStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const modulesM = tousLesModules(secteurs);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [supprimantId, setSupprimantId] = useState(null);
  const [confirmCible, setConfirmCible] = useState(null);
  const [editCible, setEditCible] = useState(null); // utilisateur en cours d'édition (rôle/secteur/poste/téléphone)
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [qrPourUtilisateur, setQrPourUtilisateur] = useState(null); // utilisateur dont le QR est affiché
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [lienCopie, setLienCopie] = useState(false);
  const lienConnexion = `${window.location.origin}/login`;

  // QR code vers la page de connexion — pour un utilisateur DÉJÀ créé (pas
  // pendant la création) : l'admin clique sur l'icône QR de sa ligne dans le
  // tableau, tend le téléphone de l'agent, celui-ci scanne et arrive
  // directement sur l'écran de connexion pour taper son identifiant/mot de
  // passe — à la demande explicite de l'utilisateur (2026-09-17). Généré
  // côté client (aucun service tiers) ; le lien est le même pour tous les
  // comptes, seul le contexte (« pour qui ») change.
  async function ouvrirQr(u) {
    if (!qrDataUrl) {
      const url = await QRCode.toDataURL(lienConnexion, { margin: 1, width: 200 });
      setQrDataUrl(url);
    }
    setLienCopie(false);
    setQrPourUtilisateur(u);
  }

  async function copierLien() {
    try {
      await navigator.clipboard.writeText(lienConnexion);
      setLienCopie(true);
      setTimeout(() => setLienCopie(false), 1500);
    } catch {
      // Presse-papiers indisponible (permission navigateur) : le lien reste affichable/sélectionnable à la main.
    }
  }

  function toggleModule(id) {
    setForm((f) => ({ ...f, modules: f.modules.includes(id) ? f.modules.filter((m) => m !== id) : [...f.modules, id] }));
  }

  async function toggleAccesExistant(u, moduleId) {
    const modules = (u.modules || []).includes(moduleId) ? u.modules.filter((m) => m !== moduleId) : [...(u.modules || []), moduleId];
    const res = await modifierAccesUtilisateur(u.uid, modules, user);
    if (!res.ok) alert(res.error);
  }

  async function toggleActif(u) {
    const res = await modifierActifUtilisateur(u.uid, !u.actif);
    if (!res.ok) alert(res.error);
  }

  function ouvrirEdition(u) {
    setEditForm({ nom: u.nom, role: u.role, secteur: u.secteur || "", poste: u.poste || "", telephone: u.telephone || "" });
    setEditError("");
    setEditCible(u);
  }

  async function submitEdition(e) {
    e.preventDefault();
    if (!editForm.nom.trim()) return;
    setEditSaving(true);
    setEditError("");
    const res = await modifierUtilisateur(editCible.uid, editForm);
    setEditSaving(false);
    if (!res.ok) return setEditError(res.error);
    setEditCible(null);
  }

  async function confirmerSuppression(motif) {
    const u = confirmCible;
    setSupprimantId(u.uid);
    await enregistrerMotifSuppression({ user, table: "profiles", label: `${u.nom} (${u.login})`, motif, secteurId: u.secteur });
    const res = await supprimerUtilisateur(u.uid);
    setSupprimantId(null);
    return res;
  }

  async function submit(e) {
    e.preventDefault();
    // Échouait silencieusement (aucun retour visible) si un champ obligatoire
    // était vide. Un message précis remplace le no-op.
    if (!form.nom.trim()) return setError("Le nom complet est obligatoire.");
    if (!form.login.trim()) return setError("L'identifiant de connexion est obligatoire.");
    if (!form.pass.trim()) return setError("Le mot de passe du nouvel utilisateur est obligatoire.");
    setSaving(true);
    setError("");
    const res = await addUser(form);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setForm(empty());
  }

  return (
    <div className="min-h-screen relative">
      <div className="mesh-bg">
        <div className="blob" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <button onClick={() => navigate("/portal")} className="btn-signal-glow glass rounded-2xl px-3.5 py-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink hover:bg-white/70 transition-colors mb-4">
          <motion.span
            className="flex items-center"
            animate={{ x: [0, -4, 0] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowLeft size={14} strokeWidth={2.4} />
          </motion.span>
          Retour au portail
        </button>

        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-ink">Utilisateurs</h1>
            <p className="text-[13.5px] text-ink-soft font-medium mt-0.5">Accès aux modules par utilisateur</p>
          </div>
          <Button icon={UserPlus} onClick={() => setOpen(true)}>Ajouter un utilisateur</Button>
        </div>

        <GlassCard className="p-2 overflow-auto" hover={false}>
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="text-left text-[11px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Accès aux modules</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const accesTotal = ROLES_ACCES_TOTAL.includes(u.role);
                return (
                  <motion.tr key={u.uid} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="text-[13.5px] hover:bg-white/50 transition-colors align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{u.nom}</p>
                      <p className="text-[11.5px] text-ink-soft">{u.login}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{ROLES[u.role] || u.role}</td>
                    <td className="px-4 py-3">
                      {accesTotal ? (
                        <Badge tone="accent">Accès total (rôle dirigeant)</Badge>
                      ) : (
                        <SelecteurModules modules={modulesM} actifs={u.modules || []} onToggle={(id) => toggleAccesExistant(u, id)} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActif(u)}
                        disabled={u.uid === user?.uid}
                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                        title={u.uid === user?.uid ? "Impossible de modifier son propre statut" : undefined}
                      >
                        <Badge tone={u.actif ? "mint" : "ink"}>{u.actif ? "Actif" : "Désactivé"}</Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => ouvrirEdition(u)}
                          title="Modifier le rôle, le secteur, le poste ou le téléphone"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-[#0A84FF]/10 hover:text-[#0A84FF] transition-colors"
                        >
                          <Pencil size={15} strokeWidth={2.2} />
                        </button>
                        <button
                          onClick={() => ouvrirQr(u)}
                          title="QR code d'accès mobile (à faire scanner par le téléphone de cet utilisateur)"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-[#0A84FF]/10 hover:text-[#0A84FF] transition-colors"
                        >
                          <QrCode size={15} strokeWidth={2.2} />
                        </button>
                        {u.uid !== user?.uid && (
                          <button
                            onClick={() => setConfirmCible(u)}
                            disabled={supprimantId === u.uid}
                            title="Supprimer"
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-[#FF453A]/10 hover:text-[#FF453A] transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={15} strokeWidth={2.2} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </GlassCard>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajouter un utilisateur"
        icon={UserPlus}
        accent="#0A84FF"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button icon={Plus} onClick={submit} disabled={saving}>{saving ? "Création…" : "Créer l'utilisateur"}</Button>
          </>
        }
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nom complet *">
              <TextInput value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex : A. KOFFI" />
            </Field>
            <Field label="Identifiant de connexion *">
              <TextInput value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="ex : agent.agro2" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Mot de passe *" hint="6 caractères minimum">
              <TextInput type="password" value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} placeholder="••••••••" />
            </Field>
            <Field label="Rôle">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLES).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Secteur">
              <Select value={form.secteur} onChange={(e) => setForm({ ...form, secteur: e.target.value })}>
                <option value="">Aucun</option>
                {secteurs.map((s) => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </Select>
            </Field>
            <Field label="Poste">
              <TextInput value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} placeholder="ex : Agent de saisie" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Téléphone WhatsApp">
              <TextInput type="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="ex : 90 00 00 00" />
            </Field>
            <label className="flex items-center gap-2.5 mt-6">
              <input
                type="checkbox"
                checked={form.actif}
                onChange={(e) => setForm({ ...form, actif: e.target.checked })}
                className="w-4 h-4 rounded accent-[#0A84FF]"
              />
              <span className="text-[13px] font-semibold text-ink">Compte actif</span>
            </label>
          </div>

          {ROLES_ACCES_TOTAL.includes(form.role) ? (
            <p className="text-[12.5px] text-ink-soft px-3.5 py-2.5 rounded-2xl bg-black/[0.03]">
              Ce rôle a un accès total à tous les modules : aucune sélection nécessaire.
            </p>
          ) : (
            <Field label="Modules accessibles">
              <SelecteurModules modules={modulesM} actifs={form.modules} onToggle={toggleModule} />
            </Field>
          )}
        </form>
      </Modal>

      <Modal
        open={!!qrPourUtilisateur}
        onClose={() => setQrPourUtilisateur(null)}
        title="QR code d'accès mobile"
        icon={QrCode}
        accent="#0A84FF"
        footer={<Button variant="ghost" onClick={() => setQrPourUtilisateur(null)}>Fermer</Button>}
      >
        {qrPourUtilisateur && (
          <div className="flex flex-col items-center gap-3.5 text-center">
            <p className="text-[13px] text-ink-soft">
              Fais scanner ce code par le téléphone de <strong className="text-ink">{qrPourUtilisateur.nom}</strong> : il ouvre directement la page de connexion de l'appli, où {qrPourUtilisateur.nom} pourra saisir son identifiant (<strong className="text-ink">{qrPourUtilisateur.login}</strong>) et son mot de passe.
            </p>
            {qrDataUrl && <img src={qrDataUrl} alt="QR code vers la page de connexion" className="w-[180px] h-[180px] rounded-2xl bg-white p-2 shadow-sm" />}
            <div className="w-full flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-[11.5px] bg-black/[0.03] rounded-xl px-2.5 py-2 text-ink-soft text-left">{lienConnexion}</code>
              <button
                type="button"
                onClick={copierLien}
                title="Copier le lien"
                className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-ink-soft hover:bg-black/5 hover:text-ink transition-colors"
              >
                {lienCopie ? <CopyCheck size={15} className="text-[#1a7d34]" /> : <Copy size={15} />}
              </button>
            </div>
            <p className="text-[11.5px] text-ink-soft/70">Pas avec toi ? Envoie-lui simplement ce lien (WhatsApp, SMS…).</p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!editCible}
        onClose={() => setEditCible(null)}
        title={editCible ? `Modifier : ${editCible.nom}` : "Modifier"}
        icon={Pencil}
        accent="#0A84FF"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditCible(null)}>Annuler</Button>
            <Button icon={Save} onClick={submitEdition} disabled={editSaving}>{editSaving ? "Enregistrement…" : "Enregistrer"}</Button>
          </>
        }
      >
        {editForm && (
          <form onSubmit={submitEdition}>
            {editError && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{editError}</p>}
            <Field label="Nom complet *">
              <TextInput value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Rôle">
                <Select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                  {Object.entries(ROLES).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Secteur">
                <Select value={editForm.secteur} onChange={(e) => setEditForm({ ...editForm, secteur: e.target.value })}>
                  <option value="">Aucun</option>
                  {secteurs.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Poste">
                <TextInput value={editForm.poste} onChange={(e) => setEditForm({ ...editForm, poste: e.target.value })} placeholder="ex : Agent de saisie" />
              </Field>
              <Field label="Téléphone WhatsApp">
                <TextInput type="tel" value={editForm.telephone} onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })} placeholder="ex : 90 00 00 00" />
              </Field>
            </div>
            <p className="text-[12px] text-ink-soft">
              Pour les modules accessibles, utilise les boutons directement dans le tableau — ce formulaire ne gère que le rôle, le secteur, le poste et le téléphone.
            </p>
          </form>
        )}
      </Modal>

      <ConfirmSuppressionModal
        open={!!confirmCible}
        titre="Supprimer ce compte ?"
        description={confirmCible ? `Vous allez supprimer définitivement le compte de ${confirmCible.nom} (${confirmCible.login}).` : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmCible(null)}
      />
    </div>
  );
}

// Sélecteur de modules — un module décliné par ville (MAXI GYM, MAXI
// LOGISTIQUE...) se présente comme UN SEUL bouton (pas un par ville) qui
// ouvre un choix de ville vers le bas, à la demande explicite de
// l'utilisateur (2026-09-15) : on donne accès soit à Lomé, soit à Kara,
// jamais implicitement aux deux. Un module sans ville garde un bouton simple.
function SelecteurModules({ modules, actifs, onToggle }) {
  const [ouvert, setOuvert] = useState(null); // base du groupe dont le choix de ville est ouvert
  const groupes = groupesModules(modules);

  return (
    <div className="flex flex-wrap gap-1.5">
      {groupes.map((g) => {
        if (g.modules.length === 1) {
          const m = g.modules[0];
          const actif = actifs.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggle(m.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold border transition-colors"
              style={actif ? { borderColor: m.color, background: `${m.color}1a`, color: m.color } : { borderColor: "rgba(0,0,0,0.1)", color: "#3c4048" }}
            >
              {actif && <Check size={11} strokeWidth={3} />} {m.nom}
            </button>
          );
        }

        const actives = g.modules.filter((m) => actifs.includes(m.id));
        const estOuvert = ouvert === g.base;
        const couleur = g.modules[0].color;

        return (
          <div key={g.base} className="relative">
            <button
              type="button"
              onClick={() => setOuvert(estOuvert ? null : g.base)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold border transition-colors"
              style={actives.length > 0 ? { borderColor: couleur, background: `${couleur}1a`, color: couleur } : { borderColor: "rgba(0,0,0,0.1)", color: "#3c4048" }}
            >
              {actives.length > 0 && <Check size={11} strokeWidth={3} />} {g.base}
              {actives.length > 0 && ` (${actives.map((m) => m.ville).join(", ")})`}
              <ChevronDown size={12} strokeWidth={2.6} className={`transition-transform ${estOuvert ? "rotate-180" : ""}`} />
            </button>
            {estOuvert && (
              <div className="absolute z-20 top-full left-0 mt-1.5 min-w-[150px] glass-strong rounded-2xl shadow-lg p-1.5 flex flex-col gap-0.5">
                <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft/60">Quelle ville ?</p>
                {g.modules.map((m) => {
                  const actif = actifs.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { onToggle(m.id); setOuvert(null); }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12.5px] font-semibold text-left hover:bg-black/5 transition-colors"
                      style={{ color: actif ? m.color : "#3c4048" }}
                    >
                      {actif ? <Check size={12} strokeWidth={3} /> : <span className="w-3 shrink-0" />} {m.ville}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
