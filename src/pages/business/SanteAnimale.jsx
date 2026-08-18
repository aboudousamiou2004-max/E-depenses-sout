import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, Syringe, Boxes, CalendarClock, BarChart3, AlertTriangle, CheckCircle2, Bell, FileDown, HeartPulse } from "lucide-react";
import * as XLSX from "xlsx";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useSanteStore } from "../../store/santeStore";
import { useStockStore, CAT_ANIMAUX_IDENTIFIES } from "../../store/stockStore";
import { useAuthStore } from "../../store/authStore";

const TYPES = [
  { value: "vaccination", label: "💉 Vaccination", tone: "accent" },
  { value: "traitement", label: "💊 Traitement", tone: "amber" },
  { value: "deparasitage", label: "🪱 Déparasitage", tone: "mint" },
  { value: "autre", label: "🔧 Autre", tone: "ink" },
];
const toneOf = (t) => TYPES.find((x) => x.value === t)?.tone || "ink";
const labelOf = (t) => TYPES.find((x) => x.value === t)?.label || t;
const PRODUIT_TYPES = ["Vaccin", "Médicament", "Antiparasitaire", "Vitamine", "Autre"];
const today = () => new Date().toISOString().slice(0, 10);

// Santé animale MAXI AGRO — porté depuis termitiere-platform/src/modules/agro/Sante.jsx
// (interventions, stock de vaccins/produits, rendez-vous, bilan).
//
// Simplification assumée : pas de rappel automatique poussé (notify()) quand
// un rendez-vous arrive à échéance — ce projet n'autorise pas l'écriture
// client directe dans `notifications` (RLS, triggers seuls) et n'a pas
// d'infrastructure de tâche planifiée (pg_cron) pour vérifier les échéances
// en tâche de fond. Les rendez-vous « en retard »/« à venir » restent donc
// visibles uniquement dans l'onglet Rendez-vous (badges), pas poussés en notification.
export default function SanteAnimale() {
  const config = useOutletContext();
  const { fiches, vaccins, chargerSante } = useSanteStore();
  const { referentielAnimaux, animauxIndividuels } = useStockStore();
  const { user } = useAuthStore();
  const [tab, setTab] = useState("interventions");

  useEffect(() => { chargerSante(); }, [chargerSante]);

  return (
    <div>
      <TopBarSimple title="Santé animale" subtitle={`${config.nom} — vaccinations, traitements, suivi sanitaire`} icon={HeartPulse} accent={config.color} />

      <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-black/[0.03] p-1 mb-4">
        {[
          { v: "interventions", l: "Interventions", Icon: Syringe },
          { v: "stock", l: "Stock vaccins", Icon: Boxes },
          { v: "rdv", l: "Rendez-vous", Icon: CalendarClock },
          { v: "bilan", l: "Bilan", Icon: BarChart3 },
        ].map((onglet) => (
          <button key={onglet.v} onClick={() => setTab(onglet.v)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${tab === onglet.v ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}>
            <onglet.Icon size={14} /> {onglet.l}
          </button>
        ))}
      </div>

      {tab === "interventions" && <Interventions fiches={fiches} vaccins={vaccins} especes={referentielAnimaux} animauxIndividuels={animauxIndividuels} user={user} config={config} />}
      {tab === "stock" && <StockVaccins vaccins={vaccins} config={config} />}
      {tab === "rdv" && <RendezVous fiches={fiches} />}
      {tab === "bilan" && <Bilan fiches={fiches} vaccins={vaccins} />}
    </div>
  );
}

// ─────────── Interventions ───────────
function Interventions({ fiches, vaccins, especes, animauxIndividuels, user, config }) {
  const { ajouterIntervention, supprimerIntervention } = useSanteStore();
  const [filtreType, setFiltreType] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const liste = useMemo(
    () => [...fiches].filter((f) => !filtreType || f.type === filtreType).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [fiches, filtreType]
  );

  function openCreate() {
    setForm({
      date: today(), especeId: especes[0]?.id || "", type: "vaccination",
      produit: "", produitStockId: "", quantiteUtilisee: 0,
      dosage: "", veterinaire: "", nombreAnimaux: 1, animauxIds: "",
      prochainRdv: "", rdvNote: "", description: "",
    });
    setError("");
    setOpen(true);
  }

  async function save() {
    if (!form.produit.trim() && !form.produitStockId) return setError("Indiquez le produit (saisi ou issu du stock)");
    const esp = especes.find((e) => e.id === form.especeId);
    setSaving(true);
    setError("");
    const res = await ajouterIntervention({ ...form, especeNom: esp?.nom || "" }, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
  }

  async function supprimer(f) {
    if (!window.confirm("Supprimer cette intervention ?")) return;
    await supprimerIntervention(f.id);
  }

  function exportXLSX() {
    const rows = liste.map((f) => ({
      Date: new Date(f.date).toLocaleDateString("fr-FR"), Espèce: f.especeNom, Type: labelOf(f.type),
      Produit: f.produit, Dosage: f.dosage || "", "Nb animaux": f.nombreAnimaux || 0,
      "N° animaux": f.animauxIds || "", Vétérinaire: f.veterinaire || "",
      "Prochain RDV": f.prochainRdv ? new Date(f.prochainRdv).toLocaleDateString("fr-FR") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Santé animale");
    XLSX.writeFile(wb, "rapport-sanitaire.xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select className="max-w-xs" value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" icon={FileDown} onClick={exportXLSX}>Rapport Excel</Button>
          <Button icon={Plus} onClick={openCreate}>Nouvelle intervention</Button>
        </div>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Espèce</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Produit</th>
              <th className="px-3 py-3 text-center">Nb</th>
              <th className="px-3 py-3">Vétérinaire</th>
              <th className="px-3 py-3">Prochain RDV</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-[13px] text-ink-soft italic">Aucune intervention enregistrée.</td></tr>}
            {liste.map((f) => (
              <tr key={f.id} className="text-[13px] hover:bg-white/50 transition-colors">
                <td className="px-3 py-2.5 text-ink-soft tabular whitespace-nowrap">{new Date(f.date).toLocaleDateString("fr-FR")}</td>
                <td className="px-3 py-2.5 font-semibold text-ink">{f.especeNom}</td>
                <td className="px-3 py-2.5"><Badge tone={toneOf(f.type)}>{labelOf(f.type)}</Badge></td>
                <td className="px-3 py-2.5 text-ink-soft">{f.produit}</td>
                <td className="px-3 py-2.5 text-center tabular">{f.nombreAnimaux}</td>
                <td className="px-3 py-2.5 text-ink-soft">{f.veterinaire || "—"}</td>
                <td className="px-3 py-2.5">{f.prochainRdv ? <span className="text-[#0A84FF]">📅 {new Date(f.prochainRdv).toLocaleDateString("fr-FR")}</span> : <span className="text-ink-soft/50">—</span>}</td>
                <td className="px-3 py-2.5"><button onClick={() => supprimer(f)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle intervention sanitaire"
        icon={HeartPulse} accent={config.color} moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        {form && (
          <>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><TextInput type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
              <Field label="Espèce">
                <Select value={form.especeId} onChange={(e) => setForm((f) => ({ ...f, especeId: e.target.value }))}>
                  {especes.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </Select>
              </Field>
              <Field label="Type">
                <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label="Nombre d'animaux"><TextInput type="number" min="1" value={form.nombreAnimaux} onChange={(e) => setForm((f) => ({ ...f, nombreAnimaux: e.target.value }))} /></Field>
            </div>
            <Field label="Numéros des animaux traités" hint="ex : B-001, B-014, B-027">
              <TextInput value={form.animauxIds} onChange={(e) => setForm((f) => ({ ...f, animauxIds: e.target.value }))} placeholder="B-001, B-014…" />
            </Field>
            {CAT_ANIMAUX_IDENTIFIES.includes(especes.find((e) => e.id === form.especeId)?.cat) && (
              <Field label="Piocher dans le registre individuel" hint="Ajoute l'identifiant choisi ci-dessus">
                <Select value="" onChange={(e) => {
                  if (!e.target.value) return;
                  setForm((f) => ({ ...f, animauxIds: [f.animauxIds, e.target.value].filter(Boolean).map((s) => s.trim()).join(", ") }));
                }}>
                  <option value="">— Sélectionner un identifiant —</option>
                  {animauxIndividuels.filter((a) => a.especeId === form.especeId && a.statut === "actif").map((a) => (
                    <option key={a.id} value={a.identifiant}>{a.identifiant}</option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Produit du stock" hint="Décrémente le stock automatiquement">
                <Select value={form.produitStockId} onChange={(e) => setForm((f) => ({ ...f, produitStockId: e.target.value }))}>
                  <option value="">— Saisie libre ci-contre —</option>
                  {vaccins.map((v) => <option key={v.id} value={v.id}>{v.nom} ({v.quantite} {v.unite})</option>)}
                </Select>
              </Field>
              {form.produitStockId
                ? <Field label="Quantité utilisée"><TextInput type="number" min="0" value={form.quantiteUtilisee} onChange={(e) => setForm((f) => ({ ...f, quantiteUtilisee: e.target.value }))} /></Field>
                : <Field label="Produit (saisie libre)"><TextInput value={form.produit} onChange={(e) => setForm((f) => ({ ...f, produit: e.target.value }))} placeholder="ex : Vaccin PPR" /></Field>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dosage"><TextInput value={form.dosage} onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))} placeholder="ex : 1 ml / tête" /></Field>
              <Field label="Vétérinaire"><TextInput value={form.veterinaire} onChange={(e) => setForm((f) => ({ ...f, veterinaire: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#0A84FF1a] p-3">
              <Field label="📅 Prochain rendez-vous" hint="Visible dans l'onglet Rendez-vous">
                <TextInput type="date" value={form.prochainRdv} min={form.date} onChange={(e) => setForm((f) => ({ ...f, prochainRdv: e.target.value }))} />
              </Field>
              <Field label="Note du rendez-vous"><TextInput value={form.rdvNote} onChange={(e) => setForm((f) => ({ ...f, rdvNote: e.target.value }))} placeholder="ex : rappel vaccin, 2e dose" /></Field>
            </div>
            <Field label="Description / notes">
              <textarea className="glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] text-ink outline-none" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
          </>
        )}
      </Modal>
    </div>
  );
}

// ─────────── Stock vaccins ───────────
function StockVaccins({ vaccins, config }) {
  const { enregistrerVaccin, supprimerVaccin } = useSanteStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const liste = useMemo(() => [...vaccins].sort((a, b) => (a.nom || "").localeCompare(b.nom || "")), [vaccins]);

  const etatStock = (v) => {
    const perime = v.peremption && v.peremption < today();
    if (perime) return { label: "Périmé", tone: "coral" };
    if (v.quantite <= 0) return { label: "Rupture", tone: "coral" };
    if (v.seuilAlerte && v.quantite <= v.seuilAlerte) return { label: "Stock bas", tone: "amber" };
    return { label: "OK", tone: "mint" };
  };

  function openCreate(item = null) {
    setForm(item ? { ...item } : { nom: "", type: "Vaccin", quantite: 0, unite: "doses", seuilAlerte: 5, peremption: "", note: "" });
    setError("");
    setOpen(true);
  }

  async function save() {
    if (!form.nom.trim()) return setError("Nom du produit requis");
    setSaving(true);
    setError("");
    const res = await enregistrerVaccin(form);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
  }

  async function supprimer(v) {
    if (!window.confirm(`Supprimer « ${v.nom} » du stock ?`)) return;
    await supprimerVaccin(v.id);
  }

  const alertes = liste.filter((v) => ["coral", "amber"].includes(etatStock(v).tone));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {alertes.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-xl bg-[#FF9F0A1a] px-3 py-1.5 text-[12.5px] font-semibold text-[#93400a]">
            <AlertTriangle size={14} /> {alertes.length} produit(s) à réapprovisionner ou périmé(s)
          </span>
        )}
        <Button className="ml-auto" icon={Plus} onClick={() => openCreate()}>Ajouter un produit</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Produit</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3 text-center">Quantité</th>
              <th className="px-3 py-3">Péremption</th>
              <th className="px-3 py-3 text-center">État</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun produit en stock.</td></tr>}
            {liste.map((v) => {
              const e = etatStock(v);
              return (
                <tr key={v.id} className="text-[13px] hover:bg-white/50 transition-colors">
                  <td className="px-3 py-2.5"><button onClick={() => openCreate(v)} className="font-semibold text-[#0A84FF] hover:underline">{v.nom}</button></td>
                  <td className="px-3 py-2.5 text-ink-soft">{v.type}</td>
                  <td className="px-3 py-2.5 text-center tabular font-bold">{v.quantite} <span className="text-[11px] font-normal text-ink-soft">{v.unite}</span></td>
                  <td className="px-3 py-2.5 text-ink-soft">{v.peremption ? new Date(v.peremption).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2.5 text-center"><Badge tone={e.tone}>{e.label}</Badge></td>
                  <td className="px-3 py-2.5"><button onClick={() => supprimer(v)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={open} onClose={() => setOpen(false)} title={form?.id ? "Modifier le produit" : "Nouveau produit"}
        icon={HeartPulse} accent={config.color} moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        {form && (
          <>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Nom du produit"><TextInput value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} placeholder="ex : Vaccin PPR" autoFocus /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {PRODUIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Unité"><TextInput value={form.unite} onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))} placeholder="doses, ml, flacons…" /></Field>
              <Field label="Quantité en stock"><TextInput type="number" min="0" value={form.quantite} onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))} /></Field>
              <Field label="Seuil d'alerte" hint="Alerte si stock ≤ seuil"><TextInput type="number" min="0" value={form.seuilAlerte} onChange={(e) => setForm((f) => ({ ...f, seuilAlerte: e.target.value }))} /></Field>
            </div>
            <Field label="Date de péremption"><TextInput type="date" value={form.peremption} onChange={(e) => setForm((f) => ({ ...f, peremption: e.target.value }))} /></Field>
            <Field label="Note"><TextInput value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
          </>
        )}
      </Modal>
    </div>
  );
}

// ─────────── Rendez-vous ───────────
function RendezVous({ fiches }) {
  const { clorreRdv } = useSanteStore();
  const rdvs = useMemo(() => fiches.filter((f) => f.prochainRdv).sort((a, b) => (a.prochainRdv < b.prochainRdv ? -1 : 1)), [fiches]);
  const aVenir = rdvs.filter((r) => !r.rdvFait && r.prochainRdv >= today());
  const enRetard = rdvs.filter((r) => !r.rdvFait && r.prochainRdv < today());
  const faits = rdvs.filter((r) => r.rdvFait);

  const Item = ({ r, retard }) => (
    <GlassCard hover={false} className="p-4 flex items-start justify-between gap-3">
      <div>
        <p className="font-bold text-ink">📅 {new Date(r.prochainRdv).toLocaleDateString("fr-FR")} — {r.especeNom}</p>
        <p className="text-[12px] text-ink-soft">{labelOf(r.type)} · {r.produit}{r.animauxIds ? ` · N° ${r.animauxIds}` : ""}</p>
        {r.rdvNote && <p className="mt-1 text-[12px] italic text-ink-soft">« {r.rdvNote} »</p>}
        <p className="mt-1 text-[11px] text-ink-soft/70">Programmé par {r.creeParNom || "—"}</p>
        {retard && <Badge tone="coral" className="mt-1.5">En retard</Badge>}
      </div>
      <Button size="sm" variant="ghost" onClick={() => clorreRdv(r.id)}><CheckCircle2 size={14} className="mr-1" />Fait</Button>
    </GlassCard>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl bg-[#0A84FF1a] px-3.5 py-2.5 text-[12.5px] text-[#0a5cb3]">
        <Bell size={15} /> Les rendez-vous en retard ou proches sont signalés ici — pas de notification poussée automatique dans cette version.
      </div>

      {enRetard.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#FF453A]">⏰ En retard ({enRetard.length})</p>
          {enRetard.map((r) => <Item key={r.id} r={r} retard />)}
        </div>
      )}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">À venir ({aVenir.length})</p>
        {aVenir.length === 0 ? <GlassCard hover={false} className="p-6 text-center text-[13px] text-ink-soft italic">Aucun rendez-vous à venir.</GlassCard>
          : aVenir.map((r) => <Item key={r.id} r={r} />)}
      </div>
      {faits.length > 0 && (
        <details className="rounded-2xl bg-black/[0.03] p-3">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-ink-soft/70">Clôturés ({faits.length})</summary>
          <div className="mt-2 space-y-1">
            {faits.map((r) => <p key={r.id} className="text-[13px] text-ink-soft">✔️ {new Date(r.prochainRdv).toLocaleDateString("fr-FR")} — {r.especeNom} ({r.produit})</p>)}
          </div>
        </details>
      )}
    </div>
  );
}

// ─────────── Bilan ───────────
function Bilan({ fiches, vaccins }) {
  const stats = useMemo(() => {
    const parType = {};
    let totalAnimaux = 0;
    fiches.forEach((f) => { parType[f.type] = (parType[f.type] || 0) + 1; totalAnimaux += f.nombreAnimaux || 0; });
    const rdvAVenir = fiches.filter((f) => f.prochainRdv && !f.rdvFait && f.prochainRdv >= today()).length;
    const rdvRetard = fiches.filter((f) => f.prochainRdv && !f.rdvFait && f.prochainRdv < today()).length;
    const stockBas = vaccins.filter((v) => (v.peremption && v.peremption < today()) || v.quantite <= 0 || (v.seuilAlerte && v.quantite <= v.seuilAlerte)).length;
    return { parType, totalAnimaux, rdvAVenir, rdvRetard, stockBas, totalFiches: fiches.length };
  }, [fiches, vaccins]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Syringe} label="Interventions" value={String(stats.totalFiches)} tone="#0A84FF" />
        <StatTile icon={CheckCircle2} label="Animaux traités (cumul)" value={String(stats.totalAnimaux)} tone="#30D158" />
        <StatTile icon={CalendarClock} label="RDV à venir" value={String(stats.rdvAVenir)} tone="#5E5CE6" />
        <StatTile icon={AlertTriangle} label="RDV en retard" value={String(stats.rdvRetard)} tone="#FF453A" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard hover={false} className="p-5">
          <h3 className="font-bold tracking-tight text-ink mb-3">Interventions par type</h3>
          {stats.totalFiches === 0 ? <p className="py-4 text-center text-[13px] text-ink-soft italic">Aucune intervention.</p> : (
            <div className="space-y-2.5">
              {TYPES.map((t) => {
                const n = stats.parType[t.value] || 0;
                const pct = stats.totalFiches ? Math.round((n / stats.totalFiches) * 100) : 0;
                return (
                  <div key={t.value}>
                    <div className="flex justify-between text-[13px] mb-1"><span>{t.label}</span><span className="font-semibold">{n}</span></div>
                    <div className="h-2 rounded-full bg-black/5"><div className="h-2 rounded-full bg-[#0A84FF]" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard hover={false} className="p-5">
          <h3 className="font-bold tracking-tight text-ink mb-3">État du stock de produits</h3>
          <div className="space-y-2 text-[13px]">
            <p className="flex justify-between"><span className="text-ink-soft">Produits référencés</span><strong>{vaccins.length}</strong></p>
            <p className="flex justify-between"><span className="text-[#93400a]">À réapprovisionner / périmés</span><strong className="text-[#93400a]">{stats.stockBas}</strong></p>
            {stats.stockBas > 0 && <p className="rounded-xl bg-[#FF9F0A1a] px-3 py-2 text-[12px] text-[#93400a]">Consultez l'onglet « Stock vaccins » pour le détail.</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
