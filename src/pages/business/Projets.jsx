import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, FolderKanban, Coins, Play, CheckCircle2 } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useEgproStore } from "../../store/egproStore";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";

const TYPES_PROJET = [
  { id: "construction", label: "Construction" }, { id: "amenagement", label: "Aménagement" },
  { id: "informatique", label: "Informatique" }, { id: "commercial", label: "Commercial" },
  { id: "evenementiel", label: "Événementiel" }, { id: "autre", label: "Autre" },
];
const STATUTS = {
  planification: { label: "Planification", tone: "accent" }, en_cours: { label: "En cours", tone: "amber" },
  en_pause: { label: "En pause", tone: "ink" }, termine: { label: "Terminé", tone: "mint" }, annule: { label: "Annulé", tone: "coral" },
};
const PRIORITES = {
  basse: { label: "Basse", tone: "ink" }, normale: { label: "Normale", tone: "accent" },
  haute: { label: "Haute", tone: "amber" }, urgente: { label: "Urgente", tone: "coral" },
};
const labelType = (id) => TYPES_PROJET.find((t) => t.id === id)?.label || id;
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR");

const VIDE = { nom: "", type: "construction", priorite: "normale", responsable: "", budget: "", dateDebut: "", dateFin: "", dureeIndeterminee: false, pourClient: true, clientNom: "", clientTelephone: "", montantContrat: "", usageInterne: "", description: "" };

// Projets E-G.PRO — porté (simplifié) depuis
// termitiere-platform/src/modules/projet/Projets.jsx : suivi budget +
// contrat client + avancement des tâches. Simplifié : pas de
// collaborateurs multiples, pas de pièces jointes/commentaires/export PDF,
// pas d'historique de révision (juste la valeur courante du budget/contrat).
export default function Projets() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { projets, taches, versementsClient, chargerEgpro, ajouterProjet, modifierProjet, supprimerProjet, demarrerProjet, terminerProjet, ajouterVersementClient, supprimerVersementClient } = useEgproStore();
  const { depenses, chargerDepenses } = useDataStore();

  useEffect(() => { chargerEgpro(); chargerDepenses(); }, [chargerEgpro, chargerDepenses]);

  const [modal, setModal] = useState(null); // { data, id } | null
  const [detailId, setDetailId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [versForm, setVersForm] = useState({ montant: "", date: new Date().toISOString().slice(0, 10), note: "" });

  const depenseParProjet = useMemo(() => {
    const map = {};
    depenses.forEach((d) => { if (d.projetId) map[d.projetId] = (map[d.projetId] || 0) + (Number(d.montant) || 0); });
    return map;
  }, [depenses]);
  const recuParProjet = useMemo(() => {
    const map = {};
    versementsClient.forEach((v) => { map[v.projetId] = (map[v.projetId] || 0) + v.montant; });
    return map;
  }, [versementsClient]);
  const tachesParProjet = (id) => taches.filter((t) => t.projetId === id);
  const versementsDuProjet = (id) => versementsClient.filter((v) => v.projetId === id);

  const enCours = projets.filter((p) => p.statut === "en_cours").length;
  const budgetTotal = projets.reduce((s, p) => s + p.budget, 0);
  const totalRecu = versementsClient.reduce((s, v) => s + v.montant, 0);

  const detail = projets.find((p) => p.id === detailId) || null;

  function openCreate() { setModal({ data: { ...VIDE }, id: null }); setError(""); }
  function openEdit(p) {
    setModal({ data: { nom: p.nom, type: p.type, priorite: p.priorite, responsable: p.responsable, budget: String(p.budget || ""), dateDebut: p.dateDebut || "", dateFin: p.dateFin || "", dureeIndeterminee: p.dureeIndeterminee, pourClient: p.pourClient, clientNom: p.clientNom, clientTelephone: p.clientTelephone, montantContrat: String(p.montantContrat || ""), usageInterne: p.usageInterne, description: p.description }, id: p.id });
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    if (!modal.data.nom.trim()) return setError("Nom du projet requis");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierProjet(modal.id, modal.data) : await ajouterProjet(modal.data, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function supprimer(p) {
    if (!window.confirm(`Supprimer le projet « ${p.nom} » et ses tâches ?`)) return;
    await supprimerProjet(p.id);
    if (detailId === p.id) setDetailId(null);
  }

  async function submitVersement(e) {
    e.preventDefault();
    if (!versForm.montant || Number(versForm.montant) <= 0) return;
    await ajouterVersementClient(detailId, versForm, user);
    setVersForm({ montant: "", date: new Date().toISOString().slice(0, 10), note: "" });
  }

  return (
    <div>
      <TopBarSimple title="Projets" subtitle={`${config.nom} — suivi budget, contrat client et avancement`} icon={FolderKanban} accent={config.color} />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatTile icon={FolderKanban} label="Projets en cours" value={String(enCours)} tone={config.color} />
        <StatTile icon={Coins} label="Budget total" value={fmt(budgetTotal) + " FCFA"} tone="#B45309" />
        <StatTile icon={Coins} label="Reçu des clients" value={fmt(totalRecu) + " FCFA"} tone="#30D158" />
      </div>

      <div className="flex justify-end mb-4">
        <Button icon={Plus} onClick={openCreate} style={{ background: config.color }}>Nouveau projet</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">N°</th>
              <th className="px-3 py-3">Nom</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Responsable</th>
              <th className="px-3 py-3 text-right">Budget</th>
              <th className="px-3 py-3 text-right">Dépensé</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {projets.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun projet.</td></tr>}
            {projets.map((p) => (
              <tr key={p.id} onClick={() => setDetailId(p.id)} className="text-[13px] hover:bg-white/50 transition-colors cursor-pointer">
                <td className="px-3 py-2.5 font-mono text-[12px] text-ink-soft">{p.num}</td>
                <td className="px-3 py-2.5 font-semibold text-ink">{p.nom}</td>
                <td className="px-3 py-2.5 text-ink-soft">{labelType(p.type)}</td>
                <td className="px-3 py-2.5 text-ink-soft">{p.responsable || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular text-ink-soft">{p.budget ? fmt(p.budget) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular font-bold text-[#B45309]">{fmt(depenseParProjet[p.id] || 0)}</td>
                <td className="px-3 py-2.5 text-center"><Badge tone={STATUTS[p.statut]?.tone}>{STATUTS[p.statut]?.label}</Badge></td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => supprimer(p)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      {/* Création / édition */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Modifier le projet" : "Nouveau projet"}
        icon={FolderKanban} accent={config.color} moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        {modal && (
          <form onSubmit={submit}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Nom du projet"><TextInput value={modal.data.nom} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, nom: e.target.value } }))} placeholder="ex : Construction entrepôt Golfe 4" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={modal.data.type} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, type: e.target.value } }))}>
                  {TYPES_PROJET.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label="Priorité">
                <Select value={modal.data.priorite} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, priorite: e.target.value } }))}>
                  {Object.entries(PRIORITES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Responsable"><TextInput value={modal.data.responsable} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, responsable: e.target.value } }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date de début"><TextInput type="date" value={modal.data.dateDebut} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateDebut: e.target.value } }))} /></Field>
              {!modal.data.dureeIndeterminee && (
                <Field label="Date de fin prévue"><TextInput type="date" value={modal.data.dateFin} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateFin: e.target.value } }))} /></Field>
              )}
            </div>
            <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-soft mb-3.5 -mt-1">
              <input type="checkbox" checked={modal.data.dureeIndeterminee} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dureeIndeterminee: e.target.checked } }))} />
              Durée indéterminée
            </label>

            <Field label="Budget prévu (FCFA)"><TextInput type="number" min="0" value={modal.data.budget} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, budget: e.target.value } }))} placeholder="0" /></Field>

            <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-soft mb-3.5">
              <input type="checkbox" checked={modal.data.pourClient} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, pourClient: e.target.checked } }))} />
              Projet pour un client (facturé)
            </label>
            {modal.data.pourClient ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nom du client"><TextInput value={modal.data.clientNom} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, clientNom: e.target.value } }))} /></Field>
                  <Field label="Téléphone client"><TextInput value={modal.data.clientTelephone} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, clientTelephone: e.target.value } }))} /></Field>
                </div>
                <Field label="Montant du contrat (FCFA)"><TextInput type="number" min="0" value={modal.data.montantContrat} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, montantContrat: e.target.value } }))} /></Field>
              </>
            ) : (
              <Field label="Usage interne"><TextInput value={modal.data.usageInterne} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, usageInterne: e.target.value } }))} placeholder="ex : Rénovation bureau" /></Field>
            )}
            <Field label="Description"><TextInput value={modal.data.description} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
          </form>
        )}
      </Modal>

      {/* Détail */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? detail.nom : ""}
        icon={FolderKanban} accent={config.color} moduleLabel={config.nom}
        footer={<Button variant="ghost" onClick={() => setDetailId(null)}>Fermer</Button>}>
        {detail && (() => {
          const depense = depenseParProjet[detail.id] || 0;
          const reste = detail.budget - depense;
          const pctBudget = detail.budget > 0 ? Math.min(100, Math.round((depense / detail.budget) * 100)) : 0;
          const recu = recuParProjet[detail.id] || 0;
          const resteDu = detail.montantContrat - recu;
          const pctRecu = detail.montantContrat > 0 ? Math.min(100, Math.round((recu / detail.montantContrat) * 100)) : 0;
          const marge = detail.montantContrat > 0 ? detail.montantContrat - depense : null;
          const tp = tachesParProjet(detail.id);
          const tachesTerminees = tp.filter((t) => t.statut === "terminee").length;
          const pctTaches = tp.length > 0 ? Math.round((tachesTerminees / tp.length) * 100) : 0;
          const vers = versementsDuProjet(detail.id);
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={STATUTS[detail.statut]?.tone}>{STATUTS[detail.statut]?.label}</Badge>
                <Badge tone={PRIORITES[detail.priorite]?.tone}>{PRIORITES[detail.priorite]?.label}</Badge>
                <span className="text-[12.5px] text-ink-soft">{labelType(detail.type)}</span>
                <div className="ml-auto flex gap-2">
                  {detail.statut === "planification" && <Button size="sm" icon={Play} onClick={() => demarrerProjet(detail)}>Démarrer</Button>}
                  {detail.statut === "en_cours" && <Button size="sm" icon={CheckCircle2} onClick={() => terminerProjet(detail.id)}>Terminer</Button>}
                  <button onClick={() => { setDetailId(null); openEdit(detail); }} className="text-[12px] text-[#0A84FF] hover:underline">Modifier</button>
                </div>
              </div>

              {detail.description && <p className="text-[13px] text-ink-soft">{detail.description}</p>}

              {detail.pourClient ? (
                <p className="text-[12.5px] text-ink-soft">Client : <span className="font-semibold text-ink">{detail.clientNom || "—"}</span>{detail.clientTelephone && ` · ${detail.clientTelephone}`}</p>
              ) : (
                <p className="text-[12.5px] text-ink-soft">Usage interne : <span className="font-semibold text-ink">{detail.usageInterne || "Projet entreprise"}</span></p>
              )}

              {tp.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase text-ink-soft/70 mb-1.5">Avancement des tâches</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-black/5"><div className="h-2 rounded-full" style={{ width: `${pctTaches}%`, background: config.color }} /></div>
                    <span className="text-[12px] font-bold text-ink-soft whitespace-nowrap">{pctTaches}% · {tachesTerminees}/{tp.length}</span>
                  </div>
                </div>
              )}

              {detail.budget > 0 && (
                <div className="rounded-2xl bg-black/[0.03] p-3">
                  <p className="text-[11px] font-bold uppercase text-ink-soft/70 mb-2">Suivi budgétaire</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    <span className="text-ink-soft">Budget <b className="text-ink">{fmt(detail.budget)}</b></span>
                    <span className="text-ink-soft">Dépensé <b className="text-[#B45309]">{fmt(depense)}</b></span>
                    <span className="text-ink-soft">Reste <b className={reste < 0 ? "text-[#FF453A]" : "text-[#1a7d34]"}>{fmt(reste)}</b></span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white"><div className={`h-1.5 rounded-full ${reste <= 0 ? "bg-[#FF453A]" : "bg-[#FF9F0A]"}`} style={{ width: `${pctBudget}%` }} /></div>
                </div>
              )}

              {detail.pourClient && (detail.montantContrat > 0 || vers.length > 0) && (
                <div className="rounded-2xl bg-[#BF5AF2]/8 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold uppercase text-[#7c2ea6]">Suivi du client</p>
                  </div>
                  {detail.montantContrat > 0 && (
                    <>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                        <span className="text-ink-soft">Contrat <b className="text-ink">{fmt(detail.montantContrat)}</b></span>
                        <span className="text-ink-soft">Reçu <b className="text-[#7c2ea6]">{fmt(recu)}</b></span>
                        <span className="text-ink-soft">Reste dû <b className={resteDu > 0 ? "text-[#9a5f00]" : "text-[#1a7d34]"}>{fmt(resteDu > 0 ? resteDu : 0)}</b></span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-white"><div className={`h-1.5 rounded-full ${resteDu <= 0 ? "bg-[#30D158]" : "bg-[#BF5AF2]"}`} style={{ width: `${pctRecu}%` }} /></div>
                      {marge !== null && <p className={`mt-2 text-[12.5px] font-bold ${marge >= 0 ? "text-[#1a7d34]" : "text-[#FF453A]"}`}>Marge (contrat − dépenses) : {marge >= 0 ? "+" : ""}{fmt(marge)}</p>}
                    </>
                  )}
                  {vers.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {vers.map((v) => (
                        <div key={v.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-2.5 py-1.5 text-[12px]">
                          <span className="text-ink-soft">{new Date(v.date).toLocaleDateString("fr-FR")}</span>
                          {v.note && <span className="flex-1 truncate italic text-ink-soft">« {v.note} »</span>}
                          <span className="font-mono font-bold text-ink">{fmt(v.montant)}</span>
                          <button onClick={() => supprimerVersementClient(v.id)} className="text-[#FF453A]/60 hover:text-[#FF453A]"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={submitVersement} className="mt-3 flex items-end gap-2">
                    <div className="flex-1"><TextInput type="number" min="0" placeholder="Montant reçu" value={versForm.montant} onChange={(e) => setVersForm((f) => ({ ...f, montant: e.target.value }))} /></div>
                    <TextInput type="date" className="w-auto" value={versForm.date} onChange={(e) => setVersForm((f) => ({ ...f, date: e.target.value }))} />
                    <Button type="submit" size="sm">Ajouter</Button>
                  </form>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
