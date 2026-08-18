import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Coins, Utensils, AlertTriangle, Wallet } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useGarderieStore } from "../../store/garderieStore";

const MODES_PAIEMENT = [
  { id: "espece", label: "Espèces" },
  { id: "mobile", label: "Mobile money" },
  { id: "virement", label: "Virement" },
  { id: "cheque", label: "Chèque" },
];
const moisCourant = () => new Date().toISOString().slice(0, 7);

// Paiements E-GARDERIE — registre des encaissements, séparé du volet
// Enfants (voir Enfants.jsx), à la demande explicite de l'utilisateur
// (2026-08-18) — même séparation que termitiere-platform/src/modules/
// garderie/{Enfants.jsx,Paiements.jsx}. Un lien « Voir les paiements »
// depuis la fiche d'un enfant arrive ici pré-filtré (`?enfant=<id>`).
export default function Paiements() {
  const config = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enfants, paiements, chargerGarderie, ajouterPaiement, supprimerPaiement } = useGarderieStore();

  useEffect(() => { chargerGarderie(); }, [chargerGarderie]);

  const filtreEnfant = searchParams.get("enfant") || "";
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ enfantId: filtreEnfant, mois: moisCourant(), montant: "", montantCantine: "", date: new Date().toISOString().slice(0, 10), modePaiement: "espece" });

  const soldeEnfantMois = (enfantId, mois) => paiements.filter((p) => p.enfantId === enfantId && p.mois === mois).reduce((s, p) => s + p.montant, 0);
  const montantDuTotal = (e) => e.tarif + (e.fraisCantine || 0);
  const impaye = (e) => {
    if (e.statut !== "actif" || e.typeAbonnement !== "mensuel") return false;
    const du = montantDuTotal(e);
    return du > 0 && soldeEnfantMois(e.id, moisCourant()) < du;
  };

  const paiementsMois = paiements.filter((p) => p.mois === moisCourant());
  const revenuMois = paiementsMois.reduce((s, p) => s + p.montant, 0);
  const revenuCantineMois = paiementsMois.reduce((s, p) => s + p.montantCantine, 0);
  const impayes = enfants.filter(impaye);

  const liste = useMemo(
    () => paiements.filter((p) => !filtreEnfant || p.enfantId === filtreEnfant),
    [paiements, filtreEnfant]
  );

  function nomEnfant(id) {
    const e = enfants.find((x) => x.id === id);
    return e ? `${e.nom} ${e.prenom}` : "—";
  }

  function ouvrirForm() {
    const e = enfants.find((x) => x.id === filtreEnfant);
    const du = e ? montantDuTotal(e) : 0;
    setForm({
      enfantId: filtreEnfant || enfants[0]?.id || "", mois: moisCourant(),
      montant: du > 0 ? String(du) : "", montantCantine: e?.fraisCantine > 0 ? String(e.fraisCantine) : "",
      date: new Date().toISOString().slice(0, 10), modePaiement: "espece",
    });
    setError("");
    setOpen(true);
  }

  function choisirEnfantForm(id) {
    const e = enfants.find((x) => x.id === id);
    const du = e ? montantDuTotal(e) : 0;
    setForm((f) => ({ ...f, enfantId: id, montant: du > 0 ? String(du) : "", montantCantine: e?.fraisCantine > 0 ? String(e.fraisCantine) : "" }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.enfantId) return setError("Choisissez un enfant");
    if (!form.montant || Number(form.montant) <= 0) return setError("Montant requis");
    setSaving(true);
    setError("");
    const res = await ajouterPaiement(form);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
  }

  const enfantFiltre = enfants.find((e) => e.id === filtreEnfant);

  return (
    <div>
      <TopBarSimple title="Paiements" subtitle={`${config.nom} — encaissements, cantine, impayés`} icon={Wallet} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <StatTile icon={Coins} label="Revenu du mois" value={Math.round(revenuMois).toLocaleString("fr-FR") + " FCFA"} tone="#30D158" />
        <StatTile icon={Utensils} label="Dont cantine" value={Math.round(revenuCantineMois).toLocaleString("fr-FR") + " FCFA"} tone="#0d9488" />
        <StatTile icon={AlertTriangle} label="Impayés ce mois" value={String(impayes.length)} tone={impayes.length ? "#FF453A" : "#8E8E93"} />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="mb-1 block text-[11.5px] font-semibold text-ink-soft ml-1">Enfant</label>
          <Select value={filtreEnfant} onChange={(e) => setSearchParams(e.target.value ? { enfant: e.target.value } : {})}>
            <option value="">Tous les enfants</option>
            {enfants.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
          </Select>
        </div>
        <Button icon={Plus} onClick={ouvrirForm} style={{ background: config.color }} className="ml-auto" disabled={!enfants.length}>Enregistrer un paiement</Button>
      </div>

      {enfantFiltre && (
        <p className="mb-3 text-[12.5px] text-ink-soft">
          Dû du mois : <strong className="text-ink">{Math.round(montantDuTotal(enfantFiltre)).toLocaleString("fr-FR")} FCFA</strong>
          {enfantFiltre.fraisCantine > 0 && ` (dont ${Math.round(enfantFiltre.fraisCantine).toLocaleString("fr-FR")} cantine)`}
        </p>
      )}

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Enfant</th>
              <th className="px-3 py-3">Mois</th>
              <th className="px-3 py-3">Mode</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3 text-right">Montant</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun paiement enregistré.</td></tr>}
            {liste.map((p) => (
              <tr key={p.id} className="text-[13px] hover:bg-white/50 transition-colors">
                <td className="px-3 py-2.5 font-semibold text-ink">{nomEnfant(p.enfantId)}</td>
                <td className="px-3 py-2.5 text-ink-soft tabular">{p.mois}</td>
                <td className="px-3 py-2.5 text-ink-soft">{MODES_PAIEMENT.find((m) => m.id === p.modePaiement)?.label}</td>
                <td className="px-3 py-2.5 text-ink-soft tabular">{new Date(p.date).toLocaleDateString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-right tabular font-bold text-[#1a7d34]">
                  +{Math.round(p.montant).toLocaleString("fr-FR")}
                  {p.montantCantine > 0 && <span className="block text-[11px] font-normal text-ink-soft/60">dont {Math.round(p.montantCantine).toLocaleString("fr-FR")} cantine</span>}
                </td>
                <td className="px-3 py-2.5 text-right"><button onClick={() => supprimerPaiement(p.id)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Enregistrer un paiement"
        icon={Wallet}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        <form onSubmit={submit}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Enfant">
            <Select value={form.enfantId} onChange={(e) => choisirEnfantForm(e.target.value)}>
              {enfants.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mois"><TextInput type="month" value={form.mois} onChange={(e) => setForm((f) => ({ ...f, mois: e.target.value }))} /></Field>
            <Field label="Mode de paiement">
              <Select value={form.modePaiement} onChange={(e) => setForm((f) => ({ ...f, modePaiement: e.target.value }))}>
                {MODES_PAIEMENT.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><TextInput type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="Montant total (FCFA)"><TextInput type="number" min="0" value={form.montant} onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} /></Field>
          </div>
          <Field label="Dont cantine (FCFA)" hint="Optionnel — pour information">
            <TextInput type="number" min="0" value={form.montantCantine} onChange={(e) => setForm((f) => ({ ...f, montantCantine: e.target.value }))} placeholder="0" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
