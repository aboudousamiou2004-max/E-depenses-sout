import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, Users, Coins, AlertTriangle, Baby, Utensils, CalendarClock } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useGarderieStore } from "../../store/garderieStore";
import { useAuthStore } from "../../store/authStore";

const TYPES_ABONNEMENT = [
  { id: "mensuel", label: "Mensuel" },
  { id: "annuel", label: "Annuel" },
  { id: "court_sejour", label: "Court séjour" },
];
const MODES_PAIEMENT = [
  { id: "espece", label: "Espèces" },
  { id: "mobile", label: "Mobile money" },
  { id: "virement", label: "Virement" },
  { id: "cheque", label: "Chèque" },
];
const STATUTS_ENFANT = { actif: { label: "Actif", tone: "mint" }, suspendu: { label: "Suspendu", tone: "amber" }, sorti: { label: "Sorti", tone: "ink" } };
const GRILLE_TARIFAIRE = [
  { label: "6 mois – 1 an", minMois: 6, maxMois: 12, tarif: 35000 },
  { label: "1 an – 3 ans", minMois: 12, maxMois: 36, tarif: 45000 },
  { label: "3 ans – 5 ans", minMois: 36, maxMois: 60, tarif: 65000 },
];
const moisCourant = () => new Date().toISOString().slice(0, 7);

function ageEnMois(dateNaissance) {
  if (!dateNaissance) return null;
  const n = new Date(dateNaissance), now = new Date();
  return (now.getFullYear() - n.getFullYear()) * 12 + (now.getMonth() - n.getMonth());
}
function tarifSuggere(dateNaissance) {
  const m = ageEnMois(dateNaissance);
  if (m == null) return null;
  return GRILLE_TARIFAIRE.find((t) => m >= t.minMois && m < t.maxMois)?.tarif ?? null;
}
function ageLabel(dateNaissance) {
  const m = ageEnMois(dateNaissance);
  if (m == null) return "—";
  if (m < 12) return `${m} mois`;
  return `${Math.floor(m / 12)} an${Math.floor(m / 12) > 1 ? "s" : ""}`;
}

// Court séjour : date de fin dérivée (inscription + N semaines) — pas
// stockée, recalculée à l'affichage, comme termitiere-platform/src/modules/
// garderie/logic.js (dateFinCourtSejour).
function dateFinCourtSejour(dateInscription, dureeSemaines) {
  if (!dateInscription || !dureeSemaines) return null;
  const d = new Date(dateInscription);
  d.setDate(d.getDate() + dureeSemaines * 7);
  return d.toISOString().slice(0, 10);
}
function joursRestants(dateFin) {
  if (!dateFin) return null;
  return Math.ceil((new Date(dateFin) - new Date(new Date().toISOString().slice(0, 10))) / 86400000);
}

// Enfants + Paiements E-GARDERIE — porté (simplifié) depuis
// termitiere-platform/src/modules/garderie/{Enfants.jsx,Paiements.jsx} : le
// moteur de revenu récurrent de ce secteur — tarif par enfant, type
// d'inscription (mensuel/annuel/court séjour, avec date de fin dérivée pour
// le court séjour), frais de cantine, historique de paiements, détection
// des impayés. Programmation des repas / présence par repas volontairement
// écartées (aucune dimension monétaire sur la plateforme non plus — seule
// la cantine a un coût, via un frais fixe par enfant).
export default function EnfantsPaiements() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { enfants, paiements, chargerGarderie, ajouterEnfant, modifierEnfant, supprimerEnfant, ajouterPaiement, supprimerPaiement } = useGarderieStore();

  useEffect(() => { chargerGarderie(); }, [chargerGarderie]);

  const [modal, setModal] = useState(null); // { data, id }
  const [detailId, setDetailId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [paieForm, setPaieForm] = useState({ mois: moisCourant(), montant: "", montantCantine: "", date: new Date().toISOString().slice(0, 10), modePaiement: "espece" });

  const soldeEnfantMois = (enfantId, mois) => paiements.filter((p) => p.enfantId === enfantId && p.mois === mois).reduce((s, p) => s + p.montant, 0);
  const montantDuTotal = (e) => e.tarif + (e.fraisCantine || 0);

  const statutPaiement = (e) => {
    if (e.statut !== "actif" || e.typeAbonnement !== "mensuel") return null;
    const solde = soldeEnfantMois(e.id, moisCourant());
    const du = montantDuTotal(e);
    if (solde >= du && du > 0) return { label: "Payé", tone: "mint" };
    if (solde > 0) return { label: "Partiel", tone: "amber" };
    return { label: "Impayé", tone: "coral" };
  };

  const actifs = enfants.filter((e) => e.statut === "actif");
  const paiementsMois = paiements.filter((p) => p.mois === moisCourant());
  const revenuMois = paiementsMois.reduce((s, p) => s + p.montant, 0);
  const revenuCantineMois = paiementsMois.reduce((s, p) => s + p.montantCantine, 0);
  const impayes = actifs.filter((e) => statutPaiement(e)?.label === "Impayé");
  const finsProchesCourtSejour = actifs.filter((e) => {
    if (e.typeAbonnement !== "court_sejour") return false;
    const jr = joursRestants(dateFinCourtSejour(e.dateInscription, e.dureeSemaines));
    return jr != null && jr <= 7;
  });

  const detail = enfants.find((e) => e.id === detailId) || null;
  const paiementsDetail = useMemo(() => paiements.filter((p) => p.enfantId === detailId).sort((a, b) => (a.date < b.date ? 1 : -1)), [paiements, detailId]);

  function openCreate() {
    setModal({ data: { nom: "", prenom: "", dateNaissance: "", typeAbonnement: "mensuel", tarif: "", dateInscription: new Date().toISOString().slice(0, 10), dureeSemaines: "2", fraisCantine: "" }, id: null });
    setError("");
  }
  function openEdit(e) {
    setModal({
      data: {
        nom: e.nom, prenom: e.prenom, dateNaissance: e.dateNaissance || "", typeAbonnement: e.typeAbonnement, tarif: e.tarif, statut: e.statut,
        dateInscription: e.dateInscription || new Date().toISOString().slice(0, 10), dureeSemaines: e.dureeSemaines || "2", fraisCantine: e.fraisCantine || "",
      },
      id: e.id,
    });
    setError("");
  }

  function appliquerSuggestion() {
    const t = tarifSuggere(modal.data.dateNaissance);
    if (t != null) setModal((m) => ({ ...m, data: { ...m.data, tarif: t } }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!modal.data.nom.trim()) return setError("Nom requis");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierEnfant(modal.id, modal.data) : await ajouterEnfant(modal.data, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function supprimer(e) {
    if (!window.confirm(`Supprimer la fiche de « ${e.nom} ${e.prenom} » et tout son historique de paiement ?`)) return;
    await supprimerEnfant(e.id);
    if (detailId === e.id) setDetailId(null);
  }

  function ouvrirDetail(e) {
    setDetailId(e.id);
    const du = montantDuTotal(e);
    setPaieForm((f) => ({ ...f, montant: du > 0 ? String(du) : "", montantCantine: e.fraisCantine > 0 ? String(e.fraisCantine) : "" }));
  }

  async function submitPaiement(e) {
    e.preventDefault();
    if (!paieForm.montant || Number(paieForm.montant) <= 0) return;
    await ajouterPaiement({ ...paieForm, enfantId: detailId });
    setPaieForm((f) => ({ ...f, montant: "", montantCantine: "" }));
  }

  return (
    <div>
      <TopBarSimple title="Enfants & Paiements" subtitle={`${config.nom} — tarifs, encaissements, impayés`} icon={Baby} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <StatTile icon={Users} label="Enfants actifs" value={String(actifs.length)} tone={config.color} />
        <StatTile icon={Coins} label="Revenu du mois" value={Math.round(revenuMois).toLocaleString("fr-FR") + " FCFA"} tone="#30D158" />
        <StatTile icon={Utensils} label="Dont cantine" value={Math.round(revenuCantineMois).toLocaleString("fr-FR") + " FCFA"} tone="#0d9488" />
        <StatTile icon={AlertTriangle} label="Impayés ce mois" value={String(impayes.length)} tone={impayes.length ? "#FF453A" : "#8E8E93"} />
        <StatTile icon={CalendarClock} label="Courts séjours à échéance" value={String(finsProchesCourtSejour.length)} tone={finsProchesCourtSejour.length ? "#FF9F0A" : "#8E8E93"} />
      </div>

      <div className="flex justify-end mb-4">
        <Button icon={Plus} onClick={openCreate} style={{ background: config.color }}>Nouvel enfant</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Enfant</th>
              <th className="px-3 py-3">Âge</th>
              <th className="px-3 py-3">Abonnement</th>
              <th className="px-3 py-3 text-right">Tarif</th>
              <th className="px-3 py-3 text-center">Statut mois en cours</th>
              <th className="px-3 py-3 text-center">Fiche</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {enfants.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun enfant enregistré.</td></tr>}
            {enfants.map((e) => {
              const sp = statutPaiement(e);
              const finCS = e.typeAbonnement === "court_sejour" ? dateFinCourtSejour(e.dateInscription, e.dureeSemaines) : null;
              const jrCS = finCS ? joursRestants(finCS) : null;
              return (
                <tr key={e.id} onClick={() => ouvrirDetail(e)} className="text-[13px] hover:bg-white/50 transition-colors cursor-pointer">
                  <td className="px-3 py-2.5 font-semibold text-ink">{e.nom} {e.prenom}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{ageLabel(e.dateNaissance)}</td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {TYPES_ABONNEMENT.find((t) => t.id === e.typeAbonnement)?.label}
                    {finCS && <span className={`block text-[11px] ${jrCS <= 7 ? "text-[#b3241b] font-semibold" : "text-ink-soft/60"}`}>fin {new Date(finCS).toLocaleDateString("fr-FR")} · {jrCS >= 0 ? `${jrCS} j` : "terminé"}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular font-semibold">{Math.round(e.tarif).toLocaleString("fr-FR")}{e.fraisCantine > 0 && <span className="block text-[11px] font-normal text-ink-soft/60">+{Math.round(e.fraisCantine).toLocaleString("fr-FR")} cantine</span>}</td>
                  <td className="px-3 py-2.5 text-center">{sp ? <Badge tone={sp.tone}>{sp.label}</Badge> : <Badge tone={STATUTS_ENFANT[e.statut]?.tone}>{STATUTS_ENFANT[e.statut]?.label}</Badge>}</td>
                  <td className="px-3 py-2.5 text-center text-ink-soft">{paiements.filter((p) => p.enfantId === e.id).length}</td>
                  <td className="px-3 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                    <button onClick={() => supprimer(e)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>

      {/* Création / édition enfant */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Modifier la fiche" : "Nouvel enfant"}
        icon={Baby} accent={config.color} moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        {modal && (
          <form onSubmit={submit}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom"><TextInput value={modal.data.nom} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, nom: e.target.value } }))} autoFocus /></Field>
              <Field label="Prénom"><TextInput value={modal.data.prenom} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, prenom: e.target.value } }))} /></Field>
            </div>
            <Field label="Date de naissance" hint="Sert à suggérer un tarif selon la grille d'âge">
              <TextInput type="date" value={modal.data.dateNaissance} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateNaissance: e.target.value } }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type d'abonnement">
                <Select value={modal.data.typeAbonnement} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, typeAbonnement: e.target.value } }))}>
                  {TYPES_ABONNEMENT.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label="Tarif (FCFA)">
                <div className="flex gap-1.5">
                  <TextInput type="number" min="0" value={modal.data.tarif} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, tarif: e.target.value } }))} />
                  {modal.data.dateNaissance && <Button type="button" variant="ghost" onClick={appliquerSuggestion}>Suggérer</Button>}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date d'inscription">
                <TextInput type="date" value={modal.data.dateInscription} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateInscription: e.target.value } }))} />
              </Field>
              {modal.data.typeAbonnement === "court_sejour" ? (
                <Field label="Durée (semaines)" hint="Minimum 2 semaines">
                  <TextInput type="number" min="2" value={modal.data.dureeSemaines} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dureeSemaines: e.target.value } }))} />
                </Field>
              ) : (
                <Field label="Frais de cantine (FCFA/mois)" hint="0 si pas de cantine">
                  <TextInput type="number" min="0" value={modal.data.fraisCantine} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, fraisCantine: e.target.value } }))} placeholder="0" />
                </Field>
              )}
            </div>
            {modal.data.typeAbonnement === "court_sejour" && (
              <Field label="Frais de cantine (FCFA/mois)" hint="0 si pas de cantine">
                <TextInput type="number" min="0" value={modal.data.fraisCantine} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, fraisCantine: e.target.value } }))} placeholder="0" />
              </Field>
            )}
            {modal.id && (
              <Field label="Statut">
                <Select value={modal.data.statut} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, statut: e.target.value } }))}>
                  {Object.entries(STATUTS_ENFANT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
            )}
          </form>
        )}
      </Modal>

      {/* Détail — historique des paiements */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${detail.nom} ${detail.prenom} — Paiements` : ""}
        icon={Baby} accent={config.color} moduleLabel={config.nom}
        footer={<Button variant="ghost" onClick={() => setDetailId(null)}>Fermer</Button>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={STATUTS_ENFANT[detail.statut]?.tone}>{STATUTS_ENFANT[detail.statut]?.label}</Badge>
              <span className="text-[12.5px] text-ink-soft">{TYPES_ABONNEMENT.find((t) => t.id === detail.typeAbonnement)?.label} · tarif {Math.round(detail.tarif).toLocaleString("fr-FR")} FCFA</span>
              <button onClick={() => { setDetailId(null); openEdit(detail); }} className="ml-auto text-[12px] text-[#0A84FF] hover:underline">Modifier fiche</button>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-[12px] text-ink-soft">
              <span>Inscrit le {detail.dateInscription ? new Date(detail.dateInscription).toLocaleDateString("fr-FR") : "—"}</span>
              {detail.fraisCantine > 0 && <span className="flex items-center gap-1"><Utensils size={12} /> Cantine : {Math.round(detail.fraisCantine).toLocaleString("fr-FR")} FCFA/mois</span>}
              {detail.typeAbonnement === "court_sejour" && detail.dureeSemaines && (() => {
                const fin = dateFinCourtSejour(detail.dateInscription, detail.dureeSemaines);
                const jr = joursRestants(fin);
                return <span className={jr <= 7 ? "text-[#b3241b] font-semibold" : ""}>Fin prévue : {new Date(fin).toLocaleDateString("fr-FR")} ({jr >= 0 ? `${jr} j restants` : "terminé"})</span>;
              })()}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase text-ink-soft/70 mb-2">Historique ({paiementsDetail.length})</p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {paiementsDetail.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucun paiement enregistré.</p>}
                {paiementsDetail.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-[12.5px]">
                    <span className="font-semibold text-ink w-16">{p.mois}</span>
                    <span className="flex-1 text-ink-soft">
                      {MODES_PAIEMENT.find((m) => m.id === p.modePaiement)?.label}
                      {p.montantCantine > 0 && <span className="text-[11px] text-ink-soft/60"> (dont {Math.round(p.montantCantine).toLocaleString("fr-FR")} cantine)</span>}
                    </span>
                    <span className="whitespace-nowrap text-ink-soft/70">{new Date(p.date).toLocaleDateString("fr-FR")}</span>
                    <span className="font-bold tabular text-[#1a7d34]">+{Math.round(p.montant).toLocaleString("fr-FR")}</span>
                    <button onClick={() => supprimerPaiement(p.id)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={submitPaiement} className="rounded-2xl border border-black/10 p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase text-ink-soft/70">Enregistrer un paiement</p>
              <div className="grid grid-cols-2 gap-2">
                <TextInput type="month" value={paieForm.mois} onChange={(e) => setPaieForm((f) => ({ ...f, mois: e.target.value }))} />
                <Select value={paieForm.modePaiement} onChange={(e) => setPaieForm((f) => ({ ...f, modePaiement: e.target.value }))}>
                  {MODES_PAIEMENT.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextInput type="date" value={paieForm.date} onChange={(e) => setPaieForm((f) => ({ ...f, date: e.target.value }))} />
                <TextInput type="number" min="0" value={paieForm.montant} onChange={(e) => setPaieForm((f) => ({ ...f, montant: e.target.value }))} placeholder="Montant total" />
              </div>
              {detail.fraisCantine > 0 && (
                <TextInput type="number" min="0" value={paieForm.montantCantine} onChange={(e) => setPaieForm((f) => ({ ...f, montantCantine: e.target.value }))} placeholder="Dont cantine (FCFA)" />
              )}
              <Button type="submit" className="w-full"><Plus size={14} /> Enregistrer</Button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
