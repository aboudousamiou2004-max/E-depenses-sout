import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, PackagePlus, Check, X, Play, CheckCircle2, XCircle, MessageSquarePlus, Pencil } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useBesoinsStore, CATEGORIES_BESOIN, catLabelBesoin } from "../../store/besoinsStore";
import { useAuthStore } from "../../store/authStore";

const STATUTS = {
  a_traiter: { label: "À traiter", tone: "amber" }, en_cours: { label: "En cours", tone: "accent" },
  satisfait: { label: "Satisfait", tone: "mint" }, annule: { label: "Annulé", tone: "ink" },
};
const VALIDATIONS = {
  en_attente: { label: "⏳ En attente", tone: "amber" }, valide: { label: "✅ Validé", tone: "mint" }, refuse: { label: "❌ Refusé", tone: "coral" },
};
const PRIORITES = {
  basse: { label: "Basse", tone: "ink" }, normale: { label: "Normale", tone: "accent" },
  haute: { label: "Haute", tone: "amber" }, urgente: { label: "Urgente", tone: "coral" },
};
const ROLES_ADMIN = ["pau", "ge", "super_admin", "directeur"];
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR");

const VIDE = { titre: "", categorie: "materiaux", quantite: "", unite: "", prixUnitaire: "", priorite: "normale", dateSouhaitee: "", note: "" };

// Besoins — volet transversal (tous les modules métier), porté (simplifié)
// depuis termitiere-platform/src/shared/besoins/SectorBesoins.jsx, à la
// demande de l'utilisateur (2026-08-18) : reçus par les directeurs et les
// membres de l'administration (rôles pau/ge/super_admin/directeur, mêmes
// que is_approbateur() côté serveur). Simplifié : pas de pièces jointes, pas
// de validation/refus en masse.
export default function Besoins() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { besoins, chargerBesoins, ajouterBesoin, modifierBesoin, supprimerBesoin, changerStatutBesoin, validerBesoin, refuserBesoin, enregistrerObservation } = useBesoinsStore();

  useEffect(() => { chargerBesoins(); }, [chargerBesoins]);

  const estAdmin = ROLES_ADMIN.includes(user?.role);
  const liste = useMemo(() => besoins.filter((b) => b.secteurId === config.secteurId), [besoins, config.secteurId]);

  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreValidation, setFiltreValidation] = useState("");
  const [modal, setModal] = useState(null); // { data, id } | null
  const [detailId, setDetailId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [observationTexte, setObservationTexte] = useState("");
  const [observationOuverte, setObservationOuverte] = useState(false);

  const filtree = useMemo(() => liste
    .filter((b) => !filtreStatut || b.statut === filtreStatut)
    .filter((b) => !filtreValidation || b.validation === filtreValidation),
  [liste, filtreStatut, filtreValidation]);

  const enAttente = liste.filter((b) => b.statut === "a_traiter" || b.statut === "en_cours").length;
  const montantEnAttente = liste.filter((b) => b.validation === "en_attente").reduce((s, b) => s + b.montant, 0);
  const detail = liste.find((b) => b.id === detailId) || null;

  function openCreate() { setModal({ data: { ...VIDE }, id: null }); setError(""); }
  function openEdit(b) {
    setModal({ data: { titre: b.titre, categorie: b.categorie, quantite: String(b.quantite), unite: b.unite, prixUnitaire: String(b.prixUnitaire || ""), priorite: b.priorite, dateSouhaitee: b.dateSouhaitee || "", note: b.note }, id: b.id });
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    if (!modal.data.titre.trim()) return setError("Titre requis");
    if (!modal.data.quantite || Number(modal.data.quantite) <= 0) return setError("Quantité requise");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierBesoin(modal.id, modal.data) : await ajouterBesoin(config.secteurId, modal.data);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function supprimer(b) {
    if (!window.confirm(`Supprimer le besoin « ${b.titre} » ?`)) return;
    const res = await supprimerBesoin(b.id);
    if (!res.ok) return alert(res.error);
    if (detailId === b.id) setDetailId(null);
  }

  async function refuser(b) {
    const motif = window.prompt(`Motif du refus de « ${b.titre} » (optionnel) :`);
    if (motif === null) return;
    await refuserBesoin(b.id, motif.trim(), user);
  }

  function ouvrirObservation(b) { setObservationTexte(b.observationAdmin || ""); setObservationOuverte(true); }
  async function submitObservation() {
    if (!observationTexte.trim() || !detail) return;
    await enregistrerObservation(detail.id, observationTexte, user);
    setObservationOuverte(false);
  }

  return (
    <div>
      <TopBarSimple title="Besoins" subtitle={`${config.nom} — demandes reçues par les directeurs et l'administration`} icon={PackagePlus} accent={config.color} />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatTile icon={PackagePlus} label="À traiter" value={String(enAttente)} tone={config.color} />
        <StatTile icon={Check} label="Montant en attente de validation" value={fmt(montantEnAttente) + " FCFA"} tone="#FF9F0A" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select className="!w-auto" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select className="!w-auto" value={filtreValidation} onChange={(e) => setFiltreValidation(e.target.value)}>
          <option value="">Validation : toutes</option>
          {Object.entries(VALIDATIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Button icon={Plus} onClick={openCreate} style={{ background: config.color }} className="ml-auto">Nouveau besoin</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Besoin</th>
              <th className="px-3 py-3">Demandé par</th>
              <th className="px-3 py-3 text-right">Montant</th>
              <th className="px-3 py-3 text-center">Validation</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtree.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun besoin.</td></tr>}
            {filtree.map((b) => (
              <tr key={b.id} onClick={() => setDetailId(b.id)} className="text-[13px] hover:bg-white/50 transition-colors cursor-pointer">
                <td className="px-3 py-2.5">
                  <p className={`font-semibold ${b.statut === "satisfait" ? "text-ink-soft line-through" : "text-ink"}`}>{b.titre}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="ink" className="!py-0.5 !px-2 !text-[10px]">{catLabelBesoin(b.categorie)}</Badge>
                    <Badge tone={PRIORITES[b.priorite]?.tone} className="!py-0.5 !px-2 !text-[10px]">{PRIORITES[b.priorite]?.label}</Badge>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-ink-soft">{b.demandeParNom || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular font-bold text-ink">{fmt(b.montant)}</td>
                <td className="px-3 py-2.5 text-center"><Badge tone={VALIDATIONS[b.validation]?.tone}>{VALIDATIONS[b.validation]?.label}</Badge></td>
                <td className="px-3 py-2.5 text-center"><Badge tone={STATUTS[b.statut]?.tone}>{STATUTS[b.statut]?.label}</Badge></td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    {estAdmin && b.validation === "en_attente" && (
                      <>
                        <button onClick={() => validerBesoin(b, user)} title="Valider" className="text-[#1a7d34] hover:opacity-70"><Check size={15} /></button>
                        <button onClick={() => refuser(b)} title="Refuser" className="text-[#FF453A] hover:opacity-70"><X size={15} /></button>
                      </>
                    )}
                    <button onClick={() => supprimer(b)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      {/* Création / édition */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Modifier le besoin" : "Nouveau besoin"}
        icon={PackagePlus} accent={config.color} moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        {modal && (
          <form onSubmit={submit}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Besoin" hint="Ce qui manque ou doit être fourni"><TextInput value={modal.data.titre} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, titre: e.target.value } }))} placeholder="ex : Ciment, ouvriers supplémentaires…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Catégorie">
                <Select value={modal.data.categorie} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, categorie: e.target.value } }))}>
                  {CATEGORIES_BESOIN.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Priorité">
                <Select value={modal.data.priorite} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, priorite: e.target.value } }))}>
                  {Object.entries(PRIORITES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Quantité"><TextInput type="number" min="0" value={modal.data.quantite} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, quantite: e.target.value } }))} /></Field>
              <Field label="Unité" hint="Optionnel"><TextInput value={modal.data.unite} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, unite: e.target.value } }))} placeholder="ex : sac, m³" /></Field>
              <Field label="Prix unitaire (FCFA)"><TextInput type="number" min="0" value={modal.data.prixUnitaire} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, prixUnitaire: e.target.value } }))} /></Field>
              <Field label="Souhaité pour le" hint="Optionnel"><TextInput type="date" value={modal.data.dateSouhaitee} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateSouhaitee: e.target.value } }))} /></Field>
            </div>
            <p className="text-[12.5px] font-semibold text-ink-soft mb-3.5">Montant estimé : <span className="text-ink">{fmt((Number(modal.data.quantite) || 0) * (Number(modal.data.prixUnitaire) || 0))} FCFA</span></p>
            <Field label="Note" hint="Optionnel"><TextInput value={modal.data.note} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, note: e.target.value } }))} /></Field>
          </form>
        )}
      </Modal>

      {/* Détail */}
      <Modal open={!!detail} onClose={() => { setDetailId(null); setObservationOuverte(false); }} title={detail ? detail.titre : ""}
        icon={PackagePlus} accent={config.color} moduleLabel={config.nom}
        footer={<Button variant="ghost" onClick={() => setDetailId(null)}>Fermer</Button>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={VALIDATIONS[detail.validation]?.tone}>{VALIDATIONS[detail.validation]?.label}</Badge>
              <Badge tone={STATUTS[detail.statut]?.tone}>{STATUTS[detail.statut]?.label}</Badge>
              <Badge tone={PRIORITES[detail.priorite]?.tone}>{PRIORITES[detail.priorite]?.label}</Badge>
              <button onClick={() => { setDetailId(null); openEdit(detail); }} className="ml-auto flex items-center gap-1 text-[12px] text-[#0A84FF] hover:underline"><Pencil size={12} /> Modifier</button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12.5px]">
              <div className="rounded-xl bg-black/[0.03] p-2.5"><p className="text-ink-soft/70 text-[10.5px] uppercase font-bold">Catégorie</p><p className="font-semibold text-ink mt-0.5">{catLabelBesoin(detail.categorie)}</p></div>
              <div className="rounded-xl bg-black/[0.03] p-2.5"><p className="text-ink-soft/70 text-[10.5px] uppercase font-bold">Quantité</p><p className="font-semibold text-ink mt-0.5">{detail.quantite}{detail.unite ? ` ${detail.unite}` : ""}</p></div>
              <div className="rounded-xl bg-black/[0.03] p-2.5"><p className="text-ink-soft/70 text-[10.5px] uppercase font-bold">Prix unitaire</p><p className="font-semibold text-ink mt-0.5">{fmt(detail.prixUnitaire)} FCFA</p></div>
              <div className="rounded-xl bg-black/[0.03] p-2.5"><p className="text-ink-soft/70 text-[10.5px] uppercase font-bold">Montant</p><p className="font-bold text-ink mt-0.5">{fmt(detail.montant)} FCFA</p></div>
            </div>

            {detail.note && <p className="text-[13px] text-ink-soft italic">« {detail.note} »</p>}
            <p className="text-[12px] text-ink-soft/70">Demandé par <span className="font-semibold text-ink-soft">{detail.demandeParNom || "—"}</span>{detail.createdAt && ` · ${new Date(detail.createdAt).toLocaleDateString("fr-FR")}`}</p>

            {detail.motifRefus && (
              <div className="rounded-2xl bg-[#FF453A]/8 p-3">
                <p className="text-[10.5px] font-bold uppercase text-[#b3241b]">Motif du refus</p>
                <p className="mt-1 text-[13px] text-[#b3241b]">{detail.motifRefus}</p>
              </div>
            )}

            {observationOuverte ? (
              <div className="rounded-2xl bg-[#BF5AF2]/8 p-3 space-y-2">
                <p className="text-[10.5px] font-bold uppercase text-[#7c2ea6]">Observation</p>
                <TextInput value={observationTexte} onChange={(e) => setObservationTexte(e.target.value)} placeholder="Réponse au demandeur…" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setObservationOuverte(false)} className="text-[12px] text-ink-soft">Annuler</button>
                  <Button size="sm" onClick={submitObservation}>Enregistrer</Button>
                </div>
              </div>
            ) : detail.observationAdmin ? (
              <div className="rounded-2xl bg-[#BF5AF2]/8 p-3">
                <p className="text-[10.5px] font-bold uppercase text-[#7c2ea6]">Observation</p>
                <p className="mt-1 text-[13px] text-[#7c2ea6]">{detail.observationAdmin}</p>
                {estAdmin && <button onClick={() => ouvrirObservation(detail)} className="mt-1 text-[11px] font-semibold text-[#7c2ea6] hover:underline">Modifier</button>}
              </div>
            ) : estAdmin && (
              <button onClick={() => ouvrirObservation(detail)} className="flex items-center gap-1 text-[12px] font-semibold text-[#7c2ea6] hover:underline"><MessageSquarePlus size={13} /> Ajouter une observation</button>
            )}

            {estAdmin && detail.validation === "en_attente" && (
              <div className="rounded-2xl bg-[#30D158]/8 p-3">
                <p className="text-[10.5px] font-bold uppercase text-[#1a7d34] mb-2">Validation</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => validerBesoin(detail, user)}><Check size={13} /> Valider</Button>
                  <Button size="sm" variant="ghost" onClick={() => refuser(detail)}><X size={13} /> Refuser</Button>
                </div>
                <p className="mt-1.5 text-[11px] text-[#1a7d34]">Valider crée une dépense de {fmt(detail.montant)} FCFA (circuit d'autorisation normal).</p>
              </div>
            )}

            {detail.validation !== "refuse" && (
              <div className="flex flex-wrap gap-2">
                {detail.statut === "a_traiter" && <Button size="sm" variant="ghost" onClick={() => changerStatutBesoin(detail.id, "en_cours")}><Play size={13} /> Prendre en charge</Button>}
                {["a_traiter", "en_cours"].includes(detail.statut) && <Button size="sm" variant="ghost" onClick={() => changerStatutBesoin(detail.id, "satisfait")}><CheckCircle2 size={13} /> Satisfait</Button>}
                {!["annule", "satisfait"].includes(detail.statut) && <Button size="sm" variant="ghost" onClick={() => changerStatutBesoin(detail.id, "annule")}><XCircle size={13} /> Annuler</Button>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
