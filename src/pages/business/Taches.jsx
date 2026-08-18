import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, ListTodo, Play, Eye, CheckCircle2, Wallet } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useEgproStore } from "../../store/egproStore";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";

const STATUTS = {
  a_faire: { label: "À faire", tone: "ink" }, en_cours: { label: "En cours", tone: "amber" },
  en_revision: { label: "En révision", tone: "grape" }, bloquee: { label: "Bloquée", tone: "coral" },
  terminee: { label: "Terminée", tone: "mint" }, annulee: { label: "Annulée", tone: "ink" },
};
const PRIORITES = {
  basse: { label: "Basse", tone: "ink" }, normale: { label: "Normale", tone: "accent" },
  haute: { label: "Haute", tone: "amber" }, urgente: { label: "Urgente", tone: "coral" },
};
const PROGRESSION = { a_faire: "en_cours", en_cours: "en_revision", en_revision: "terminee" };
const LABEL_BTN = { a_faire: "Commencer", en_cours: "Soumettre", en_revision: "Valider" };
const ICONE_BTN = { a_faire: Play, en_cours: Eye, en_revision: CheckCircle2 };
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR");

const VIDE = { projetId: "", titre: "", phase: "", assignee: "", priorite: "normale", statut: "a_faire", dateDebut: "", echeance: "", montantPrevu: "", note: "", prestataireNom: "", prestataireMetier: "", prestataireTelephone: "" };

// Tâches E-G.PRO — porté (simplifié) depuis
// termitiere-platform/src/modules/projet/Taches.jsx : le versement à un
// prestataire crée une dépense réelle (dataStore.addDepense, liée via
// tacheId/projetId), qui suit le circuit d'autorisation normal et apparaît
// dans le volet Dépenses — exactement comme sur la vraie plateforme.
// Simplifié : pas de pièces jointes, pas d'historique de révision du
// montant arrêté (juste la valeur courante), pas de report d'échéance dédié.
export default function Taches() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { projets, taches, chargerEgpro, ajouterTache, modifierTache, supprimerTache, avancerTache } = useEgproStore();
  const { depenses, chargerDepenses, addDepense } = useDataStore();

  useEffect(() => { chargerEgpro(); chargerDepenses(); }, [chargerEgpro, chargerDepenses]);

  const [filtreProjet, setFiltreProjet] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [modal, setModal] = useState(null); // { data, id } | null
  const [detailId, setDetailId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [versForm, setVersForm] = useState({ montant: "", date: new Date().toISOString().slice(0, 10) });
  const [versSaving, setVersSaving] = useState(false);

  const verseParTache = useMemo(() => {
    const map = {};
    depenses.forEach((d) => { if (d.tacheId) map[d.tacheId] = (map[d.tacheId] || 0) + (Number(d.montant) || 0); });
    return map;
  }, [depenses]);

  const liste = useMemo(() => taches
    .filter((t) => !filtreProjet || t.projetId === filtreProjet)
    .filter((t) => !filtreStatut || t.statut === filtreStatut),
  [taches, filtreProjet, filtreStatut]);

  const nomProjet = (id) => projets.find((p) => p.id === id)?.nom || "—";
  const detail = taches.find((t) => t.id === detailId) || null;
  const versementsDeTache = (id) => depenses.filter((d) => d.tacheId === id).sort((a, b) => (a.date < b.date ? 1 : -1));

  function openCreate() {
    if (!projets.length) return setError("Crée d'abord un projet.");
    setModal({ data: { ...VIDE, projetId: filtreProjet || projets[0]?.id || "" }, id: null });
    setError("");
  }
  function openEdit(t) {
    setModal({ data: { projetId: t.projetId, titre: t.titre, phase: t.phase, assignee: t.assignee, priorite: t.priorite, statut: t.statut, dateDebut: t.dateDebut || "", echeance: t.echeance || "", montantPrevu: t.montantPrevu ?? "", note: t.note, prestataireNom: t.prestataireNom, prestataireMetier: t.prestataireMetier, prestataireTelephone: t.prestataireTelephone }, id: t.id });
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    if (!modal.data.titre.trim()) return setError("Titre requis");
    if (!modal.data.projetId) return setError("Projet requis");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierTache(modal.id, modal.data) : await ajouterTache(modal.data);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function supprimer(t) {
    if (!window.confirm(`Supprimer la tâche « ${t.titre} » ?`)) return;
    await supprimerTache(t.id);
    if (detailId === t.id) setDetailId(null);
  }

  async function submitVersement(e) {
    e.preventDefault();
    if (!versForm.montant || Number(versForm.montant) <= 0 || !detail) return;
    setVersSaving(true);
    await addDepense({
      secteurId: config.secteurId, categorie: "Sous-traitance", montant: Number(versForm.montant), date: versForm.date,
      description: `Versement — ${detail.titre}`, natureFlux: "exploitation", sourceFinancement: "entreprise",
      beneficiaireNom: detail.prestataireNom || "", projetId: detail.projetId, tacheId: detail.id,
    }, user);
    setVersSaving(false);
    setVersForm({ montant: "", date: new Date().toISOString().slice(0, 10) });
  }

  return (
    <div>
      <TopBarSimple title="Tâches" subtitle={`${config.nom} — suivi des tâches et versements aux prestataires`} icon={ListTodo} accent={config.color} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select className="!w-auto" value={filtreProjet} onChange={(e) => setFiltreProjet(e.target.value)}>
          <option value="">Tous les projets</option>
          {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </Select>
        <Select className="!w-auto" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Button icon={Plus} onClick={openCreate} style={{ background: config.color }} className="ml-auto">Nouvelle tâche</Button>
      </div>
      {error && !modal && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {liste.length === 0 && <p className="col-span-full text-center py-10 text-[13px] text-ink-soft italic">Aucune tâche.</p>}
        {liste.map((t) => {
          const prevu = t.montantPrevu || 0;
          const verse = verseParTache[t.id] || 0;
          const reste = prevu - verse;
          const enRetard = t.echeance && !["terminee", "annulee"].includes(t.statut) && new Date(t.echeance) < new Date();
          return (
            <GlassCard key={t.id} onClick={() => setDetailId(t.id)} className="p-4 cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUTS[t.statut]?.tone}>{STATUTS[t.statut]?.label}</Badge>
                  <Badge tone={PRIORITES[t.priorite]?.tone}>{PRIORITES[t.priorite]?.label}</Badge>
                  {enRetard && <Badge tone="coral">En retard</Badge>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); supprimer(t); }} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>
              </div>
              <p className="mt-2 font-bold tracking-tight text-ink">{t.titre}</p>
              <p className="mt-1 text-[11.5px] text-ink-soft">{nomProjet(t.projetId)}{t.phase && ` · ${t.phase}`}</p>
              {t.assignee && <p className="mt-1 text-[11.5px] text-ink-soft">Assigné à {t.assignee}</p>}
              {t.prestataireNom && <p className="mt-1 text-[11.5px] text-ink-soft">Prestataire : {t.prestataireNom}</p>}
              {(prevu > 0 || verse > 0) && (
                <div className="mt-2.5 rounded-xl bg-black/[0.03] px-2.5 py-2 text-[11.5px]">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="text-ink-soft">Arrêté <b className="text-ink">{fmt(prevu)}</b></span>
                    <span className="text-ink-soft">Versé <b className="text-[#0a5cb3]">{fmt(verse)}</b></span>
                    <span className="text-ink-soft">Reste <b className={reste > 0 ? "text-[#9a5f00]" : "text-[#1a7d34]"}>{fmt(reste > 0 ? reste : 0)}</b></span>
                  </div>
                </div>
              )}
              {PROGRESSION[t.statut] && (
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => avancerTache(t)} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold text-white" style={{ background: config.color }}>
                    {(() => { const Icon = ICONE_BTN[t.statut]; return <Icon size={11} />; })()}{LABEL_BTN[t.statut]}
                  </button>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Création / édition */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Modifier la tâche" : "Nouvelle tâche"}
        icon={ListTodo} accent={config.color} moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        {modal && (
          <form onSubmit={submit}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Titre"><TextInput value={modal.data.titre} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, titre: e.target.value } }))} placeholder="ex : Coulage de la dalle" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Projet">
                <Select value={modal.data.projetId} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, projetId: e.target.value } }))}>
                  {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </Select>
              </Field>
              <Field label="Phase / étape"><TextInput value={modal.data.phase} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, phase: e.target.value } }))} placeholder="ex : Fondation" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Statut">
                <Select value={modal.data.statut} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, statut: e.target.value } }))}>
                  {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Priorité">
                <Select value={modal.data.priorite} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, priorite: e.target.value } }))}>
                  {Object.entries(PRIORITES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Assigné à"><TextInput value={modal.data.assignee} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, assignee: e.target.value } }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date de début"><TextInput type="date" value={modal.data.dateDebut} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateDebut: e.target.value } }))} /></Field>
              <Field label="Échéance"><TextInput type="date" value={modal.data.echeance} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, echeance: e.target.value } }))} /></Field>
            </div>
            <Field label="Montant arrêté (FCFA)"><TextInput type="number" min="0" value={modal.data.montantPrevu} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, montantPrevu: e.target.value } }))} placeholder="Montant convenu avec le prestataire" /></Field>
            <Field label="Note"><TextInput value={modal.data.note} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, note: e.target.value } }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prestataire"><TextInput value={modal.data.prestataireNom} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, prestataireNom: e.target.value } }))} /></Field>
              <Field label="Téléphone"><TextInput value={modal.data.prestataireTelephone} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, prestataireTelephone: e.target.value } }))} /></Field>
            </div>
            <Field label="Métier / spécialité"><TextInput value={modal.data.prestataireMetier} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, prestataireMetier: e.target.value } }))} placeholder="ex : Maçon, Électricien…" /></Field>
          </form>
        )}
      </Modal>

      {/* Détail — versements */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? detail.titre : ""}
        icon={ListTodo} accent={config.color} moduleLabel={config.nom}
        footer={<Button variant="ghost" onClick={() => setDetailId(null)}>Fermer</Button>}>
        {detail && (() => {
          const prevu = detail.montantPrevu || 0;
          const verse = verseParTache[detail.id] || 0;
          const reste = prevu - verse;
          const pct = prevu > 0 ? Math.min(100, Math.round((verse / prevu) * 100)) : 0;
          const vers = versementsDeTache(detail.id);
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={STATUTS[detail.statut]?.tone}>{STATUTS[detail.statut]?.label}</Badge>
                <Badge tone={PRIORITES[detail.priorite]?.tone}>{PRIORITES[detail.priorite]?.label}</Badge>
                <span className="text-[12.5px] text-ink-soft">{nomProjet(detail.projetId)}</span>
                <button onClick={() => { setDetailId(null); openEdit(detail); }} className="ml-auto text-[12px] text-[#0A84FF] hover:underline">Modifier</button>
              </div>
              {detail.note && <p className="text-[13px] text-ink-soft whitespace-pre-wrap">{detail.note}</p>}
              {(detail.prestataireNom || detail.prestataireMetier) && (
                <p className="text-[12.5px] text-ink-soft">Prestataire : <span className="font-semibold text-ink">{detail.prestataireNom || "—"}</span>{detail.prestataireMetier && ` — ${detail.prestataireMetier}`}{detail.prestataireTelephone && ` · ${detail.prestataireTelephone}`}</p>
              )}

              <div className="rounded-2xl bg-black/[0.03] p-3">
                <div className="flex items-center gap-1.5 mb-2"><Wallet size={13} className="text-ink-soft" /><p className="text-[11px] font-bold uppercase text-ink-soft/70">Suivi financier</p></div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  <span className="text-ink-soft">Arrêté <b className="text-ink">{fmt(prevu)}</b></span>
                  <span className="text-ink-soft">Versé <b className="text-[#0a5cb3]">{fmt(verse)}</b></span>
                  <span className="text-ink-soft">Reste <b className={reste > 0 ? "text-[#9a5f00]" : "text-[#1a7d34]"}>{fmt(reste > 0 ? reste : 0)}</b></span>
                </div>
                {prevu > 0 && <div className="mt-1.5 h-1.5 rounded-full bg-white"><div className={`h-1.5 rounded-full ${reste <= 0 ? "bg-[#30D158]" : "bg-[#0A84FF]"}`} style={{ width: `${pct}%` }} /></div>}
                {vers.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {vers.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-[12px]">
                        <span className="text-ink-soft">{new Date(d.date).toLocaleDateString("fr-FR")}</span>
                        <Badge tone="ink">{d.statut}</Badge>
                        <span className="font-mono font-bold text-ink">{fmt(d.montant)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={submitVersement} className="mt-3 flex items-end gap-2">
                  <div className="flex-1"><TextInput type="number" min="0" placeholder="Montant versé" value={versForm.montant} onChange={(e) => setVersForm((f) => ({ ...f, montant: e.target.value }))} /></div>
                  <TextInput type="date" className="w-auto" value={versForm.date} onChange={(e) => setVersForm((f) => ({ ...f, date: e.target.value }))} />
                  <Button type="submit" size="sm" disabled={versSaving}>{versSaving ? "…" : "Verser"}</Button>
                </form>
                <p className="mt-2 text-[11px] text-ink-soft/70">Le versement crée une dépense qui suit le circuit d'autorisation normal (visible dans Dépenses).</p>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
