import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, AlertTriangle, Stethoscope, CheckCircle2, Thermometer, Pill } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useSanteGarderieStore } from "../../store/santeGarderieStore";
import { useGarderieStore } from "../../store/garderieStore";
import { useAuthStore } from "../../store/authStore";

const TYPES_INCIDENT = [
  { id: "accident", label: "Accident / blessure" },
  { id: "maladie", label: "Maladie / fièvre" },
  { id: "allergie", label: "Réaction allergique" },
  { id: "fugue", label: "Fugue / disparition" },
  { id: "conflit", label: "Conflit entre enfants" },
  { id: "autre", label: "Autre" },
];
const GRAVITES = { faible: { label: "Faible", tone: "mint" }, moyen: { label: "Moyen", tone: "amber" }, grave: { label: "Grave", tone: "coral" } };
const TYPES_SOIN = [
  { id: "medicament", label: "💊 Médicament administré" },
  { id: "temperature", label: "🌡️ Prise de température" },
  { id: "bobo", label: "🩹 Petit soin (bobo, désinfection)" },
  { id: "vaccination", label: "💉 Vaccination" },
  { id: "visite", label: "🩺 Visite médicale" },
  { id: "autre", label: "Autre soin" },
];
const today = () => new Date().toISOString().slice(0, 10);

// Santé & Infirmerie E-GARDERIE — incidents et soins courants, simplifiés
// depuis termitiere-platform/src/modules/garderie/Incidents.jsx (pas de
// niveaux d'alarme, pas de carnet de vaccination complet), à la demande
// explicite de l'utilisateur (2026-08-18).
export default function SanteInfirmerie() {
  const config = useOutletContext();
  const { incidents, soins, chargerSante } = useSanteGarderieStore();
  const { enfants, chargerGarderie } = useGarderieStore();
  const { user } = useAuthStore();
  const [tab, setTab] = useState("incidents");

  useEffect(() => { chargerSante(); chargerGarderie(); }, [chargerSante, chargerGarderie]);

  const enfantsActifs = useMemo(() => enfants.filter((e) => e.statut === "actif"), [enfants]);

  return (
    <div>
      <TopBarSimple title="Santé & Infirmerie" subtitle={`${config.nom} — incidents et soins courants`} icon={Stethoscope} accent={config.color} />

      <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-black/[0.03] p-1 mb-4">
        {[{ v: "incidents", l: "Incidents", Icon: AlertTriangle }, { v: "soins", l: "Soins courants", Icon: Thermometer }].map((o) => (
          <button key={o.v} onClick={() => setTab(o.v)} className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${tab === o.v ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}>
            <o.Icon size={14} /> {o.l}
          </button>
        ))}
      </div>

      {tab === "incidents" && <Incidents incidents={incidents} enfants={enfantsActifs} user={user} config={config} />}
      {tab === "soins" && <Soins soins={soins} enfants={enfantsActifs} user={user} config={config} />}
    </div>
  );
}

function nomEnfant(enfants, id) {
  const e = enfants.find((x) => x.id === id);
  return e ? `${e.nom} ${e.prenom}` : "—";
}

function Incidents({ incidents, enfants, user, config }) {
  const { ajouterIncident, modifierIncident, marquerIncidentResolu } = useSanteGarderieStore();
  const [filtreResolu, setFiltreResolu] = useState("false");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const liste = useMemo(() => incidents.filter((i) => !filtreResolu || String(i.resolu) === filtreResolu), [incidents, filtreResolu]);
  const nonResolus = incidents.filter((i) => !i.resolu);
  const graves = nonResolus.filter((i) => i.gravite === "grave");

  function ouvrir(incident = null) {
    setModal({ data: incident ? { ...incident } : { enfantId: enfants[0]?.id || "", type: "accident", gravite: "faible", date: today(), description: "", mesuresPrises: "", parentPrevenu: false, resolu: false }, id: incident?.id || null });
    setError("");
  }

  async function submit() {
    if (!modal.data.enfantId) return setError("Sélectionnez un enfant");
    if (!modal.data.description.trim()) return setError("Description requise");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierIncident(modal.id, modal.data) : await ajouterIncident(modal.data, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile icon={AlertTriangle} label="Non résolus" value={String(nonResolus.length)} tone={nonResolus.length ? "#FF9F0A" : "#8E8E93"} />
        <StatTile icon={AlertTriangle} label="Graves non résolus" value={String(graves.length)} tone={graves.length ? "#FF453A" : "#8E8E93"} />
        <StatTile icon={CheckCircle2} label="Total enregistrés" value={String(incidents.length)} tone={config.color} />
      </div>

      <div className="flex items-center gap-2">
        <Select className="max-w-[220px]" value={filtreResolu} onChange={(e) => setFiltreResolu(e.target.value)}>
          <option value="">Tous</option>
          <option value="false">Non résolus</option>
          <option value="true">Résolus</option>
        </Select>
        <Button className="ml-auto" icon={Plus} onClick={() => ouvrir()} disabled={!enfants.length}>Signaler un incident</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Enfant</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3 text-center">Gravité</th>
              <th className="px-3 py-3">Description</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-[13px] text-ink-soft italic">Aucun incident.</td></tr>}
            {liste.map((i) => (
              <tr key={i.id} className="text-[13px] hover:bg-white/50 transition-colors">
                <td className="px-3 py-2.5 font-semibold text-ink">{nomEnfant(enfants, i.enfantId)}</td>
                <td className="px-3 py-2.5 text-ink-soft">{TYPES_INCIDENT.find((t) => t.id === i.type)?.label}</td>
                <td className="px-3 py-2.5 text-ink-soft tabular whitespace-nowrap">{new Date(i.date).toLocaleDateString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-center"><Badge tone={GRAVITES[i.gravite]?.tone}>{GRAVITES[i.gravite]?.label}</Badge></td>
                <td className="px-3 py-2.5 text-ink-soft max-w-xs truncate">{i.description}</td>
                <td className="px-3 py-2.5 text-center">
                  {i.resolu ? <Badge tone="mint">Résolu</Badge> : <button onClick={() => marquerIncidentResolu(i.id)} className="text-[11px] font-semibold text-[#0A84FF] hover:underline">Marquer résolu</button>}
                </td>
                <td className="px-3 py-2.5 text-right"><button onClick={() => ouvrir(i)} className="text-[11px] font-semibold text-ink-soft hover:text-ink">Éditer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Modifier l'incident" : "Signaler un incident"} icon={AlertTriangle} accent={config.color} moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        {modal && (
          <>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Enfant concerné">
              <Select value={modal.data.enfantId} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, enfantId: e.target.value } }))}>
                {enfants.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><Select value={modal.data.type} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, type: e.target.value } }))}>{TYPES_INCIDENT.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></Field>
              <Field label="Gravité"><Select value={modal.data.gravite} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, gravite: e.target.value } }))}>{Object.entries(GRAVITES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
            </div>
            <Field label="Date"><TextInput type="date" value={modal.data.date} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, date: e.target.value } }))} /></Field>
            <Field label="Description"><textarea className="glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] text-ink outline-none" rows={2} value={modal.data.description} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
            <Field label="Mesures prises"><textarea className="glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] text-ink outline-none" rows={2} value={modal.data.mesuresPrises} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, mesuresPrises: e.target.value } }))} /></Field>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" checked={!!modal.data.parentPrevenu} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, parentPrevenu: e.target.checked } }))} className="w-4 h-4 rounded accent-[#0A84FF]" />
              Parent / tuteur prévenu
            </label>
          </>
        )}
      </Modal>
    </div>
  );
}

function Soins({ soins, enfants, user, config }) {
  const { ajouterSoin, modifierSoin } = useSanteGarderieStore();
  const [filtreSuivi, setFiltreSuivi] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const liste = useMemo(() => soins.filter((s) => !filtreSuivi || String(!!s.aSuivre) === filtreSuivi), [soins, filtreSuivi]);
  const aSuivre = soins.filter((s) => s.aSuivre).length;

  function ouvrir(soin = null) {
    setModal({ data: soin ? { ...soin } : { enfantId: enfants[0]?.id || "", type: "bobo", date: today(), description: "", temperature: "", medicament: "", dosage: "", autorisationParent: false, parentPrevenu: false, aSuivre: false, notes: "" }, id: soin?.id || null });
    setError("");
  }

  async function submit() {
    if (!modal.data.enfantId) return setError("Sélectionnez un enfant");
    if (!modal.data.description.trim()) return setError("Description requise");
    if (modal.data.type === "medicament" && !modal.data.autorisationParent) return setError("Autorisation du parent requise pour administrer un médicament");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierSoin(modal.id, modal.data) : await ajouterSoin(modal.data, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {aSuivre > 0 && <Badge tone="amber">{aSuivre} à suivre</Badge>}
        <Select className="max-w-[220px] ml-auto" value={filtreSuivi} onChange={(e) => setFiltreSuivi(e.target.value)}>
          <option value="">Tous</option>
          <option value="true">À suivre</option>
          <option value="false">Clôturés</option>
        </Select>
        <Button icon={Plus} onClick={() => ouvrir()} disabled={!enfants.length}>Enregistrer un soin</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Enfant</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Détails</th>
              <th className="px-3 py-3 text-center">Suivi</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-[13px] text-ink-soft italic">Aucun soin enregistré.</td></tr>}
            {liste.map((s) => (
              <tr key={s.id} className="text-[13px] hover:bg-white/50 transition-colors">
                <td className="px-3 py-2.5 font-semibold text-ink">{nomEnfant(enfants, s.enfantId)}</td>
                <td className="px-3 py-2.5 text-ink-soft">{TYPES_SOIN.find((t) => t.id === s.type)?.label}</td>
                <td className="px-3 py-2.5 text-ink-soft tabular whitespace-nowrap">{new Date(s.date).toLocaleDateString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-ink-soft max-w-xs">
                  <p className="truncate">{s.description}</p>
                  <div className="flex gap-2 mt-0.5">
                    {s.temperature && <span className="flex items-center gap-0.5 text-[10.5px] font-semibold text-[#dc2626]"><Thermometer size={10} /> {s.temperature}°C</span>}
                    {s.medicament && <span className="flex items-center gap-0.5 text-[10.5px] font-semibold text-[#7c3aed]"><Pill size={10} /> {s.medicament}{s.dosage ? ` (${s.dosage})` : ""}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">{s.aSuivre ? <Badge tone="amber">À suivre</Badge> : <Badge tone="mint">Clôturé</Badge>}</td>
                <td className="px-3 py-2.5 text-right"><button onClick={() => ouvrir(s)} className="text-[11px] font-semibold text-ink-soft hover:text-ink">Éditer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Modifier le soin" : "Enregistrer un soin"} icon={Stethoscope} accent={config.color} moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        {modal && (
          <>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Enfant concerné">
              <Select value={modal.data.enfantId} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, enfantId: e.target.value } }))}>
                {enfants.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><Select value={modal.data.type} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, type: e.target.value } }))}>{TYPES_SOIN.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></Field>
              <Field label="Date"><TextInput type="date" value={modal.data.date} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, date: e.target.value } }))} /></Field>
            </div>
            {(modal.data.type === "temperature" || modal.data.type === "medicament") && (
              <Field label="Température (°C)"><TextInput type="number" step="0.1" value={modal.data.temperature} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, temperature: e.target.value } }))} placeholder="ex : 38.5" /></Field>
            )}
            {modal.data.type === "medicament" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Médicament"><TextInput value={modal.data.medicament} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, medicament: e.target.value } }))} placeholder="ex : Paracétamol" /></Field>
                <Field label="Dosage"><TextInput value={modal.data.dosage} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dosage: e.target.value } }))} placeholder="ex : 5 ml" /></Field>
              </div>
            )}
            <Field label="Description"><textarea className="glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] text-ink outline-none" rows={2} value={modal.data.description} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
            <Field label="Notes de suivi"><textarea className="glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] text-ink outline-none" rows={2} value={modal.data.notes} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, notes: e.target.value } }))} /></Field>
            <div className="flex flex-wrap items-center gap-4">
              {modal.data.type === "medicament" && (
                <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                  <input type="checkbox" checked={!!modal.data.autorisationParent} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, autorisationParent: e.target.checked } }))} className="w-4 h-4 rounded accent-[#0A84FF]" />
                  Autorisation du parent obtenue
                </label>
              )}
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="checkbox" checked={!!modal.data.parentPrevenu} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, parentPrevenu: e.target.checked } }))} className="w-4 h-4 rounded accent-[#0A84FF]" />
                Parent / tuteur prévenu
              </label>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="checkbox" checked={!!modal.data.aSuivre} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, aSuivre: e.target.checked } }))} className="w-4 h-4 rounded accent-[#0A84FF]" />
                Nécessite un suivi
              </label>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
