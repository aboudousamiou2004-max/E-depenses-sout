import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Plus, Trash2, Users, AlertTriangle, Baby, CalendarClock } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import InscriptionEnfantModal from "../../components/InscriptionEnfantModal";
import { useGarderieStore } from "../../store/garderieStore";
import { GROUPES_AGE, PROGRAMMES_ENFANT, programmeDuGroupe } from "../../data/garderieData";
import { ageLabel, dateFinCourtSejour, joursRestants } from "../../lib/garderieLogic";

const TYPES_ABONNEMENT = [
  { id: "mensuel", label: "Mensuel" },
  { id: "annuel", label: "Annuel" },
  { id: "court_sejour", label: "Court séjour" },
];
const STATUTS_ENFANT = { actif: { label: "Actif", tone: "mint" }, suspendu: { label: "Suspendu", tone: "amber" }, sorti: { label: "Sorti", tone: "ink" } };
const moisCourant = () => new Date().toISOString().slice(0, 7);

// Enfants E-GARDERIE — registre des inscriptions (fiche complète : identité,
// groupe/programme, parent/tuteur, santé — voir InscriptionEnfantModal.jsx).
// Séparé du volet Paiements (voir Paiements.jsx), à la demande explicite de
// l'utilisateur (2026-08-18) — même séparation que
// termitiere-platform/src/modules/garderie/{Enfants.jsx,Paiements.jsx}.
export default function Enfants() {
  const config = useOutletContext();
  const navigate = useNavigate();
  const { enfants, paiements, chargerGarderie, supprimerEnfant } = useGarderieStore();

  useEffect(() => { chargerGarderie(); }, [chargerGarderie]);

  const [modal, setModal] = useState(null); // { enfant } | null
  const [detail, setDetail] = useState(null);

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
  const impayes = actifs.filter((e) => statutPaiement(e)?.label === "Impayé");
  const finsProchesCourtSejour = actifs.filter((e) => {
    if (e.typeAbonnement !== "court_sejour") return false;
    const jr = joursRestants(dateFinCourtSejour(e.dateInscription, e.dureeSemaines));
    return jr != null && jr <= 7;
  });

  async function supprimer(e) {
    if (!window.confirm(`Supprimer la fiche de « ${e.nom} ${e.prenom} » et tout son historique de paiement ?`)) return;
    await supprimerEnfant(e.id);
    if (detail?.id === e.id) setDetail(null);
  }

  return (
    <div>
      <TopBarSimple title="Enfants" subtitle={`${config.nom} — registre des inscriptions`} icon={Baby} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <StatTile icon={Users} label="Enfants actifs" value={String(actifs.length)} tone={config.color} />
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
                <tr key={e.id} onClick={() => setDetail(e)} className="text-[13px] hover:bg-white/50 transition-colors cursor-pointer">
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

      {/* Inscription / modification — fiche complète */}
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

      {/* Fiche détail — sans les paiements, désormais dans leur propre volet */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.nom} ${detail.prenom}` : ""}
        icon={Baby} accent={config.color} moduleLabel={config.nom}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDetail(null); navigate(`${config.path}/paiements?enfant=${detail?.id}`); }}>Voir les paiements</Button>
            <Button onClick={() => { setModal({ enfant: detail }); setDetail(null); }}>Modifier la fiche</Button>
          </>
        }>
        {detail && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={STATUTS_ENFANT[detail.statut]?.tone}>{STATUTS_ENFANT[detail.statut]?.label}</Badge>
              <span className="text-[12.5px] text-ink-soft">
                {GROUPES_AGE.find((g) => g.id === detail.groupe)?.label} · {PROGRAMMES_ENFANT.find((p) => p.id === (detail.programme || programmeDuGroupe(detail.groupe)))?.label} · {ageLabel(detail.dateNaissance)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12.5px]">
              <p className="text-ink-soft">Abonnement : <span className="text-ink font-semibold">{TYPES_ABONNEMENT.find((t) => t.id === detail.typeAbonnement)?.label}</span></p>
              <p className="text-ink-soft">Tarif : <span className="text-ink font-semibold">{Math.round(detail.tarif).toLocaleString("fr-FR")} FCFA</span></p>
              {detail.fraisCantine > 0 && <p className="text-ink-soft">Cantine : <span className="text-ink font-semibold">{Math.round(detail.fraisCantine).toLocaleString("fr-FR")} FCFA/mois</span></p>}
              <p className="text-ink-soft">Inscrit le : <span className="text-ink font-semibold">{detail.dateInscription ? new Date(detail.dateInscription).toLocaleDateString("fr-FR") : "—"}</span></p>
            </div>
            {detail.typeAbonnement === "court_sejour" && detail.dureeSemaines && (() => {
              const fin = dateFinCourtSejour(detail.dateInscription, detail.dureeSemaines);
              const jr = joursRestants(fin);
              return <p className={`text-[12.5px] ${jr <= 7 ? "text-[#b3241b] font-semibold" : "text-ink-soft"}`}>Fin prévue : {new Date(fin).toLocaleDateString("fr-FR")} ({jr >= 0 ? `${jr} j restants` : "terminé"})</p>;
            })()}
            <div className="text-[12.5px] text-ink-soft space-y-1">
              <p>Parent/tuteur : <span className="text-ink">{detail.parentNom || "—"}</span>{detail.parentContact ? ` · ${detail.parentContact}` : ""}{detail.parentContact2 ? ` / ${detail.parentContact2}` : ""}</p>
              {detail.parentProfession && <p>Profession : <span className="text-ink">{detail.parentProfession}</span></p>}
              {detail.adresse && <p>Adresse : <span className="text-ink">{detail.adresse}</span></p>}
            </div>
            {(detail.allergies || detail.infoMedicale) && (
              <p className="text-[12.5px] text-[#b3241b]">⚠ {[detail.allergies, detail.infoMedicale].filter(Boolean).join(" · ")}</p>
            )}
            {detail.notes && <p className="text-[12.5px] italic text-ink-soft">{detail.notes}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
