import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, UserPlus, Check } from "lucide-react";
import GlassCard from "../../components/ui/GlassCard";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { ROLES } from "../../data/seed";
import { tousLesModules, modulesMetier, ROLES_ACCES_TOTAL } from "../../lib/modules";

const empty = () => ({ login: "", nom: "", pass: "", role: "agent", secteur: "", poste: "", telephone: "", actif: true, modules: [] });

export default function Utilisateurs() {
  const { users, secteurs, addUser, modifierAccesUtilisateur } = useDataStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const modulesM = modulesMetier(secteurs);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty());
  const [adminPass, setAdminPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleModule(id) {
    setForm((f) => ({ ...f, modules: f.modules.includes(id) ? f.modules.filter((m) => m !== id) : [...f.modules, id] }));
  }

  async function toggleAccesExistant(u, moduleId) {
    const modules = (u.modules || []).includes(moduleId) ? u.modules.filter((m) => m !== moduleId) : [...(u.modules || []), moduleId];
    const res = await modifierAccesUtilisateur(u.uid, modules, user);
    if (!res.ok) alert(res.error);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.login.trim() || !form.nom.trim() || !form.pass.trim() || !adminPass.trim()) return;
    setSaving(true);
    setError("");
    const res = await addUser(form, user, adminPass);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setForm(empty());
    setAdminPass("");
  }

  return (
    <div className="min-h-screen relative">
      <div className="mesh-bg">
        <div className="blob" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <button onClick={() => navigate("/portal")} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink mb-4 transition-colors">
          <ArrowLeft size={14} strokeWidth={2.4} /> Retour au portail
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
                        <div className="flex flex-wrap gap-1.5">
                          {modulesM.map((m) => {
                            const actif = (u.modules || []).includes(m.id);
                            return (
                              <button
                                key={m.id}
                                onClick={() => toggleAccesExistant(u, m.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors"
                                style={actif ? { background: `${m.color}1f`, color: m.color } : { background: "rgba(0,0,0,0.04)", color: "#3c4048" }}
                              >
                                {actif && <Check size={10} strokeWidth={3} />} {m.nom}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => toggleAccesExistant(u, "depense")}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors"
                            style={(u.modules || []).includes("depense") ? { background: "#0A84FF1f", color: "#0A84FF" } : { background: "rgba(0,0,0,0.04)", color: "#3c4048" }}
                          >
                            {(u.modules || []).includes("depense") && <Check size={10} strokeWidth={3} />} E-DÉPENSES
                          </button>
                        </div>
                      )}
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
            <Field label="Mot de passe *">
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

          <Field label="Votre mot de passe (pour rester connecté) *">
            <TextInput type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="••••••••" />
          </Field>
          <p className="text-[12px] text-ink-soft -mt-2 mb-3.5">
            La création d'un compte reconnecte automatiquement le nouvel utilisateur à sa place — votre mot de passe sert à restaurer votre propre session juste après.
          </p>

          {ROLES_ACCES_TOTAL.includes(form.role) ? (
            <p className="text-[12.5px] text-ink-soft px-3.5 py-2.5 rounded-2xl bg-black/[0.03]">
              Ce rôle a un accès total à tous les modules — aucune sélection nécessaire.
            </p>
          ) : (
            <Field label="Modules accessibles">
              <div className="flex flex-wrap gap-2">
                {tousLesModules(secteurs).map((m) => {
                  const actif = form.modules.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModule(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold border transition-colors"
                      style={actif ? { borderColor: m.color, background: `${m.color}1a`, color: m.color } : { borderColor: "rgba(0,0,0,0.1)", color: "#3c4048" }}
                    >
                      {actif && <Check size={12} strokeWidth={3} />} {m.nom}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
        </form>
      </Modal>
    </div>
  );
}
