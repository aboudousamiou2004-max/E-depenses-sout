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
import InscriptionEnfantModal from "../../components/InscriptionEnfantModal";
import { useGarderieStore } from "../../store/garderieStore";
import { GROUPES_AGE, PROGRAMMES_ENFANT, programmeDuGroupe } from "../../data/garderieData";
import { ageLabel, dateFinCourtSejour, joursRestants } from "../../lib/garderieLogic";

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
const moisCourant = () => new Date().toISOString().slice(0, 7);

// Enfants + Paiements E-GARDERIE — porté (simplifié, sans photo) depuis
// termitiere-platform/src/modules/garderie/{Enfants.jsx,Paiements.jsx} : le
// moteur de revenu récurrent de ce secteur — fiche d'inscription complète
// (identité, groupe/programme, parent/tuteur, santé — voir
// InscriptionEnfantModal.jsx), tarif, type d'abonnement (mensuel/annuel/
// court séjour, avec date de fin dérivée), frais de cantine, historique de
// paiements, détection des impayés. Programmation des repas / présence par
// repas volontairement écartées (aucune dimension monétaire sur la
// plateforme non plus — seule la cantine a un coût, via un frais fixe par
// enfant).
export default function EnfantsPaiements() {
  const config = useOutletContext();
  const { enfants, paiements, chargerGarderie, supprimerEnfant, ajouterPaiement, supprimerPaiement } = useGarderieStore();

  useEffect(() => { chargerGarderie(); }, [chargerGarderie]);

  const [modal, setModal] = useState(null); // { enfant } | null — enfant absent = création
  const [detailId, setDetailId] = useState(null);
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
      <TopBarSimple title="Enfants & Paiements" subtitle={`${config.nom} — inscriptions, tarifs, encaissements, impayés`} icon={Baby} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <StatTile icon={Users} label="Enfants actifs" value={String(actifs.length)} tone={config.color} />
        <StatTile icon={Coins} label="Revenu du mois" value={Math.round(revenuMois).toLocaleString("fr-FR") + " FCFA"} tone="#30D158" />
        <StatTile icon={Utensils} label="Dont cantine" value={Math.round(revenuCantineMois).toLocaleString("fr-FR") + " FCFA"} tone="#0d9488" />
        <StatTile icon={AlertTriangle} label="Impayés ce mois" value={String(impayes.length)} tone={impayes.length ? "#FF453A" : "#8E8E93"} />
        <StatTile icon={CalendarClock} label="Courts séjours à échéance" value={String(finsProchesCourtSejour.length)} tone={finsProchesCourtSejour.length ? "#FF9F0A" : "#8E8E93"} />
      </div>

      <div className="flex justify-end mb-4">
        <Button icon={Plus} onClick={() => setModal({ enfant: null })} style={{ background: config.color }}>Inscrire un enfant</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Enfant</th>
              <th className="px-3 py-3">Âge</th>
              <th className="px-3 py-3">Groupe</th>
              <th className="px-3 py-3">Parent / Contact</th>
              <th className="px-3 py-3">Abonnement</th>
              <th className="px-3 py-3 text-right">Tarif</th>
              <th className="px-3 py-3 text-center">Statut mois en cours</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {enfants.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun enfant inscrit.</td></tr>}
            {enfants.map((e) => {
              const sp = statutPaiement(e);
              const finCS = e.typeAbonnement === "court_sejour" ? dateFinCourtSejour(e.dateInscription, e.dureeSemaines) : null;
              const jrCS = finCS ? joursRestants(finCS) : null;
              return (
                <tr key={e.id} onClick={() => ouvrirDetail(e)} className="text-[13px] hover:bg-white/50 transition-colors cursor-pointer">
                  <td className="px-3 py-2.5 font-semibold text-ink">{e.nom} {e.prenom}{e.allergies && <span className="ml-1 text-[11px] text-[#b3241b]" title={e.allergies}>⚠</span>}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{ageLabel(e.dateNaissance)}</td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {GROUPES_AGE.find((g) => g.id === e.groupe)?.label || "—"}
                    <span className="block text-[11px] text-ink-soft/60">{PROGRAMMES_ENFANT.find((p) => p.id === (e.programme || programmeDuGroupe(e.groupe)))?.label}</span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {e.parentNom || "—"}
                    {e.parentContact && <span className="block text-[11px] text-ink-soft/60">{e.parentContact}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {TYPES_ABONNEMENT.find((t) => t.id === e.typeAbonnement)?.label}
                    {finCS && <span className={`block text-[11px] ${jrCS <= 7 ? "text-[#b3241b] font-semibold" : "text-ink-soft/60"}`}>fin {new Date(finCS).toLocaleDateString("fr-FR")} · {jrCS >= 0 ? `${jrCS} j` : "terminé"}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular font-semibold">{Math.round(e.tarif).toLocaleString("fr-FR")}{e.fraisCantine > 0 && <span className="block text-[11px] font-normal text-ink-soft/60">+{Math.round(e.fraisCantine).toLocaleString("fr-FR")} cantine</span>}</td>
                  <td className="px-3 py-2.5 text-center">{sp ? <Badge tone={sp.tone}>{sp.label}</Badge> : <Badge tone={STATUTS_ENFANT[e.statut]?.tone}>{STATUTS_ENFANT[e.statut]?.label}</Badge>}</td>
                  <td className="px-3 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                    <button onClick={() => supprimer(e)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>

      {/* Inscription / modification enfant — fiche complète */}
      {modal && (
        <InscriptionEnfantModal
          key={modal.enfant?.id || "new"}
          open
          enfant={modal.enfant}
          accent={config.color}
          moduleLabel={config.nom}
          onClose={() => setModal(null)}
        />
      )}

      {/* Détail — historique des paiements */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${detail.nom} ${detail.prenom} — Paiements` : ""}
        icon={Baby} accent={config.color} moduleLabel={config.nom}
        footer={<Button variant="ghost" onClick={() => setDetailId(null)}>Fermer</Button>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={STATUTS_ENFANT[detail.statut]?.tone}>{STATUTS_ENFANT[detail.statut]?.label}</Badge>
              <span className="text-[12.5px] text-ink-soft">{TYPES_ABONNEMENT.find((t) => t.id === detail.typeAbonnement)?.label} · tarif {Math.round(detail.tarif).toLocaleString("fr-FR")} FCFA</span>
              <button onClick={() => { setDetailId(null); setModal({ enfant: detail }); }} className="ml-auto text-[12px] text-[#0A84FF] hover:underline">Modifier fiche</button>
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
            <div className="flex flex-col gap-1 text-[12px] text-ink-soft">
              <span>Parent/tuteur : {detail.parentNom || "—"}{detail.parentContact ? ` · ${detail.parentContact}` : ""}{detail.parentContact2 ? ` / ${detail.parentContact2}` : ""}</span>
              {detail.adresse && <span>Adresse : {detail.adresse}</span>}
              {(detail.allergies || detail.infoMedicale) && (
                <span className="text-[#b3241b]">⚠ {[detail.allergies, detail.infoMedicale].filter(Boolean).join(" · ")}</span>
              )}
              {detail.notes && <span className="italic">{detail.notes}</span>}
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
