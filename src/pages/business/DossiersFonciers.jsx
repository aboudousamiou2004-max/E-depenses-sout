import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, FolderOpen, Coins } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useFoncierStore } from "../../store/foncierStore";
import { useAuthStore } from "../../store/authStore";

const TYPES_DOSSIER = ["Vente / Cession", "Immatriculation", "Mutation de nom", "Morcellement", "Donation", "Héritage", "Lotissement", "Autre"];
const CATEGORIES_FRAIS = [
  { id: "honoraires", label: "Honoraires" },
  { id: "administratif", label: "Frais administratifs" },
  { id: "transport", label: "Transport" },
  { id: "notaire", label: "Notaire" },
  { id: "geometre", label: "Géomètre / bornage" },
  { id: "taxes", label: "Taxes & impôts (OTR)" },
  { id: "autre", label: "Autre" },
];
const labelCat = (id) => CATEGORIES_FRAIS.find((c) => c.id === id)?.label || id;
const STATUTS = { ouvert: { label: "Ouvert", tone: "accent" }, en_cours: { label: "En cours", tone: "amber" }, cloture: { label: "Clôturé", tone: "mint" } };

// Dossiers fonciers E-FONCIER — porté (simplifié) depuis
// termitiere-platform/src/modules/foncier/Dossiers.jsx : le mécanisme central
// de traçabilité des coûts pour ce secteur — un dossier, des frais
// catégorisés, un total. Simplifié : pas de types de dossier avec modèles
// d'étapes, pas d'acteurs/pièces jointes, pas de grille d'appréciation de
// cession (workflow/conformité, pas financier).
export default function DossiersFonciers() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { dossiers, frais, chargerFoncier, ajouterDossier, modifierDossier, supprimerDossier, ajouterFrais, supprimerFrais } = useFoncierStore();

  useEffect(() => { chargerFoncier(); }, [chargerFoncier]);

  const [modal, setModal] = useState(null); // { data, id }
  const [detailId, setDetailId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fraisForm, setFraisForm] = useState({ categorie: "administratif", libelle: "", montant: "", date: new Date().toISOString().slice(0, 10) });

  const totalDossier = (dossierId) => frais.filter((f) => f.dossierId === dossierId).reduce((s, f) => s + f.montant, 0);
  const totalGeneral = dossiers.reduce((s, d) => s + totalDossier(d.id), 0);

  const detail = dossiers.find((d) => d.id === detailId) || null;
  const fraisDetail = useMemo(() => frais.filter((f) => f.dossierId === detailId).sort((a, b) => (a.date < b.date ? 1 : -1)), [frais, detailId]);
  const parCategorie = useMemo(() => {
    const map = {};
    fraisDetail.forEach((f) => { map[f.categorie] = (map[f.categorie] || 0) + f.montant; });
    return Object.entries(map).map(([id, montant]) => ({ id, label: labelCat(id), montant })).sort((a, b) => b.montant - a.montant);
  }, [fraisDetail]);

  function openCreate() {
    setModal({ data: { type: TYPES_DOSSIER[0], commune: "", proprietaire: "", dateOuverture: new Date().toISOString().slice(0, 10), statut: "ouvert", notes: "" }, id: null });
    setError("");
  }
  function openEdit(d) {
    setModal({ data: { type: d.type, commune: d.commune, proprietaire: d.proprietaire, dateOuverture: d.dateOuverture, statut: d.statut, notes: d.notes }, id: d.id });
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    if (!modal.data.commune.trim()) return setError("Commune requise");
    if (!modal.data.proprietaire.trim()) return setError("Propriétaire requis");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierDossier(modal.id, modal.data) : await ajouterDossier(modal.data, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function supprimer(d) {
    if (!window.confirm(`Supprimer le dossier « ${d.numero} » et tous ses frais ?`)) return;
    await supprimerDossier(d.id);
    if (detailId === d.id) setDetailId(null);
  }

  async function submitFrais(e) {
    e.preventDefault();
    if (!fraisForm.montant || Number(fraisForm.montant) <= 0) return;
    await ajouterFrais(detailId, fraisForm);
    setFraisForm((f) => ({ ...f, libelle: "", montant: "" }));
  }

  return (
    <div>
      <TopBarSimple title="Dossiers fonciers" subtitle={`${config.nom} — dossiers, frais engagés, total par dossier`} icon={FolderOpen} accent={config.color} />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatTile icon={FolderOpen} label="Dossiers" value={String(dossiers.length)} tone={config.color} />
        <StatTile icon={Coins} label="Total frais engagés" value={Math.round(totalGeneral).toLocaleString("fr-FR") + " FCFA"} tone="#B45309" />
      </div>

      <div className="flex justify-end mb-4">
        <Button icon={Plus} onClick={openCreate} style={{ background: config.color }}>Nouveau dossier</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">N°</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Commune</th>
              <th className="px-3 py-3">Propriétaire</th>
              <th className="px-3 py-3 text-right">Frais engagés</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {dossiers.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun dossier.</td></tr>}
            {dossiers.map((d) => (
              <tr key={d.id} onClick={() => setDetailId(d.id)} className="text-[13px] hover:bg-white/50 transition-colors cursor-pointer">
                <td className="px-3 py-2.5 font-mono text-[12px] text-ink-soft">{d.numero}</td>
                <td className="px-3 py-2.5 text-ink-soft">{d.type}</td>
                <td className="px-3 py-2.5 font-semibold text-ink">{d.commune}</td>
                <td className="px-3 py-2.5 text-ink-soft">{d.proprietaire}</td>
                <td className="px-3 py-2.5 text-right tabular font-bold text-[#B45309]">{Math.round(totalDossier(d.id)).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-center"><Badge tone={STATUTS[d.statut]?.tone}>{STATUTS[d.statut]?.label}</Badge></td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => supprimer(d)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      {/* Création / édition du dossier */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Modifier le dossier" : "Nouveau dossier foncier"}
        icon={FolderOpen} accent={config.color} moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        {modal && (
          <form onSubmit={submit}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Type de dossier">
              <Select value={modal.data.type} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, type: e.target.value } }))}>
                {TYPES_DOSSIER.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Commune"><TextInput value={modal.data.commune} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, commune: e.target.value } }))} placeholder="ex : Golfe 4" /></Field>
              <Field label="Propriétaire"><TextInput value={modal.data.proprietaire} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, proprietaire: e.target.value } }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date d'ouverture"><TextInput type="date" value={modal.data.dateOuverture} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateOuverture: e.target.value } }))} /></Field>
              {modal.id && (
                <Field label="Statut">
                  <Select value={modal.data.statut} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, statut: e.target.value } }))}>
                    {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                </Field>
              )}
            </div>
            <Field label="Notes"><TextInput value={modal.data.notes} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, notes: e.target.value } }))} /></Field>
          </form>
        )}
      </Modal>

      {/* Détail — frais du dossier */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `Dossier ${detail.numero} — ${detail.commune}` : ""}
        icon={FolderOpen} accent={config.color} moduleLabel={config.nom}
        footer={<Button variant="ghost" onClick={() => setDetailId(null)}>Fermer</Button>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={STATUTS[detail.statut]?.tone}>{STATUTS[detail.statut]?.label}</Badge>
              <span className="text-[12.5px] text-ink-soft">{detail.type} · {detail.proprietaire}</span>
              <button onClick={() => { setDetailId(null); openEdit(detail); }} className="ml-auto text-[12px] text-[#0A84FF] hover:underline">Modifier infos</button>
            </div>

            {parCategorie.length > 0 && (
              <div className="rounded-2xl bg-black/[0.03] p-3">
                <p className="text-[11px] font-bold uppercase text-ink-soft/70 mb-2">Répartition par catégorie</p>
                <div className="space-y-1.5">
                  {parCategorie.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-32 shrink-0 truncate text-ink-soft">{c.label}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-white"><div className="h-1.5 rounded-full bg-[#B45309]" style={{ width: `${totalDossier(detail.id) ? (c.montant / totalDossier(detail.id)) * 100 : 0}%` }} /></div>
                      <span className="w-24 shrink-0 text-right font-semibold text-ink">{Math.round(c.montant).toLocaleString("fr-FR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase text-ink-soft/70 mb-2">Frais engagés ({fraisDetail.length})</p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {fraisDetail.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucun frais saisi.</p>}
                {fraisDetail.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-[12.5px]">
                    <Badge tone="ink">{labelCat(f.categorie)}</Badge>
                    <span className="flex-1 truncate text-ink-soft">{f.libelle || "—"}</span>
                    <span className="whitespace-nowrap text-ink-soft/70">{new Date(f.date).toLocaleDateString("fr-FR")}</span>
                    <span className="font-bold tabular text-ink">{Math.round(f.montant).toLocaleString("fr-FR")}</span>
                    <button onClick={() => supprimerFrais(f.id)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-[#B45309]/10 px-3 py-2 text-[13px] font-bold">
                <span className="text-[#93400a]">TOTAL</span>
                <span className="text-[#93400a] tabular">{Math.round(totalDossier(detail.id)).toLocaleString("fr-FR")} FCFA</span>
              </div>
            </div>

            <form onSubmit={submitFrais} className="rounded-2xl border border-black/10 p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase text-ink-soft/70">Ajouter un frais</p>
              <div className="grid grid-cols-2 gap-2">
                <Select value={fraisForm.categorie} onChange={(e) => setFraisForm((f) => ({ ...f, categorie: e.target.value }))}>
                  {CATEGORIES_FRAIS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
                <TextInput type="date" value={fraisForm.date} onChange={(e) => setFraisForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <TextInput value={fraisForm.libelle} onChange={(e) => setFraisForm((f) => ({ ...f, libelle: e.target.value }))} placeholder="Libellé (ex : timbres fiscaux)" />
              <div className="flex items-center gap-2">
                <TextInput type="number" min="0" className="flex-1" value={fraisForm.montant} onChange={(e) => setFraisForm((f) => ({ ...f, montant: e.target.value }))} placeholder="Montant" />
                <Button type="submit" size="sm"><Plus size={14} /> Ajouter</Button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
