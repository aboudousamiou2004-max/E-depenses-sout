import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CalendarCheck, Plus, Pencil, Trash2, CheckCircle2, CalendarDays, X } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput } from "../../components/ui/Field";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { useGymStore, NIVEAUX_FORFAIT, niveauLabel } from "../../store/gymStore";
import { peutModifier, peutSupprimer } from "../../lib/modules";
import { fmtFCFA, fmtCompact, totalMontant } from "../../lib/logic";
import ConfirmSuppressionModal from "../../components/ui/ConfirmSuppressionModal";
import { enregistrerMotifSuppression } from "../../lib/motifSuppression";

function ajouterJours(dateStr, jours) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + (Number(jours) || 0));
  return d.toISOString().slice(0, 10);
}
function joursRelatifs(dateStr) {
  if (!dateStr) return "—";
  const jours = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(dateStr).setHours(0, 0, 0, 0)) / 86400000);
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return "Hier";
  if (jours > 1) return `Il y a ${jours} j`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
}
const VIDE = () => ({
  client: "", telephone: "", niveau: "simple",
  dateSouscription: new Date().toISOString().slice(0, 10),
  dateDebut: new Date().toISOString().slice(0, 10),
  dureeJours: "30", dateFin: ajouterJours(new Date().toISOString().slice(0, 10), 30),
  montant: "", note: "",
});

// Abonnements — volet spécifique à MAXI GYM : cycle de vie complet de
// l'abonnement (souscription, début, durée, fin), pointage des arrivées
// (bouton « Pointer » + historique consultable) et traçabilité de qui l'a
// enregistré — reproduit la plateforme réelle (capture fournie par
// l'utilisateur, 2026-09-14). Chaque abonnement crée une recette liée
// (secteur, comptabilité) via `abonnement_id` sur `recettes`.
export default function Abonnements() {
  const config = useOutletContext();
  const { addRecette } = useDataStore();
  const { user } = useAuthStore();
  const {
    forfaits, chargerForfaits, abonnements, chargerAbonnements, ajouterAbonnement, modifierAbonnement, supprimerAbonnement,
    pointerAbonnement, pointages, chargerPointages, supprimerPointage,
  } = useGymStore();
  const modifierOk = peutModifier(user?.role);
  const supprimerOk = peutSupprimer(user?.role);
  const [modal, setModal] = useState(null); // { id, data } | null
  const [calendrier, setCalendrier] = useState(null); // abonnement | null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmCible, setConfirmCible] = useState(null); // { type: "abonnement" | "pointage", data }

  useEffect(() => { chargerForfaits(config.secteurId); chargerAbonnements(config.secteurId); }, [config.secteurId]);

  const liste = useMemo(() => [...abonnements].sort((a, b) => (a.dateSouscription < b.dateSouscription ? 1 : -1)), [abonnements]);
  const total = totalMontant(abonnements);

  const forfaitChoisi = forfaits.find((f) => f.niveau === modal?.data.niveau);

  function ouvrirCreation() { setModal({ id: null, data: VIDE() }); setError(""); }
  function ouvrirEdition(a) {
    setModal({
      id: a.id,
      data: {
        client: a.client, telephone: a.telephone, niveau: a.niveau,
        dateSouscription: a.dateSouscription, dateDebut: a.dateDebut, dureeJours: String(a.dureeJours),
        dateFin: a.dateFin, montant: String(a.montant), note: a.note,
      },
    });
    setError("");
  }

  function majDebutOuDuree(patch) {
    setModal((m) => {
      const data = { ...m.data, ...patch };
      data.dateFin = ajouterJours(data.dateDebut, data.dureeJours);
      return { ...m, data };
    });
  }

  async function enregistrer() {
    if (!modal.data.client.trim()) return setError("Client requis");
    const montant = Number(modal.data.montant) || 0;
    if (montant <= 0) return setError("Montant requis");
    if (!modal.data.dateFin) return setError("Date de fin requise");
    setSaving(true);
    setError("");
    if (modal.id) {
      const res = await modifierAbonnement(modal.id, modal.data);
      setSaving(false);
      if (!res.ok) return setError(res.error);
    } else {
      const res = await ajouterAbonnement(config.secteurId, modal.data, user);
      if (!res.ok) {
        setSaving(false);
        return setError(res.error);
      }
      await addRecette(
        { secteurId: config.secteurId, montant, date: modal.data.dateSouscription, origine: `Abonnement : ${niveauLabel(modal.data.niveau)}`, client: modal.data.client, abonnementId: res.id },
        user
      );
      setSaving(false);
    }
    setModal(null);
  }

  async function confirmerSuppression(motif) {
    const { type, data } = confirmCible;
    if (type === "pointage") {
      await enregistrerMotifSuppression({ user, table: "gym_pointages", label: `${data.abonnementClient} — ${new Date(data.pointage.date).toLocaleDateString("fr-FR")}`, motif, secteurId: config.secteurId });
      return supprimerPointage(data.pointage.id, data.abonnementId);
    }
    await enregistrerMotifSuppression({ user, table: "gym_abonnements", label: data.client, motif, secteurId: config.secteurId });
    return supprimerAbonnement(data.id);
  }

  async function pointer(a) {
    const res = await pointerAbonnement(a.id);
    if (!res.ok) alert(res.error);
  }

  async function ouvrirCalendrier(a) {
    setCalendrier(a);
    await chargerPointages(a.id);
  }

  return (
    <div>
      <TopBarSimple title="Abonnements" subtitle={`${config.nom} : abonnements souscrits`} icon={CalendarCheck} accent={config.color} />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatTile icon={CalendarCheck} label="Abonnements enregistrés" value={String(abonnements.length)} tone={config.color} />
        <StatTile icon={CalendarCheck} label="Total facturé" value={fmtCompact(total) + " FCFA"} tone="#8E8E93" />
      </div>

      <div className="flex justify-end mb-4">
        <Button icon={Plus} onClick={ouvrirCreation} style={{ background: config.color }}>Nouvel abonnement</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse">
            <thead>
              <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-3 py-3">Souscrit le</th>
                <th className="px-3 py-3">Début</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Catégorie</th>
                <th className="px-3 py-3">Fin</th>
                <th className="px-3 py-3 text-center">Statut</th>
                <th className="px-3 py-3 text-right">Montant</th>
                <th className="px-3 py-3">Dernière arrivée</th>
                <th className="px-3 py-3">Notes</th>
                <th className="px-3 py-3">Enregistré par</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {liste.length === 0 && <tr><td colSpan={11} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun abonnement enregistré.</td></tr>}
              {liste.map((a) => {
                const actif = a.dateFin >= new Date().toISOString().slice(0, 10);
                return (
                  <tr key={a.id} className="text-[13px] hover:bg-white/50 transition-colors">
                    <td className="px-3 py-2.5 text-ink-soft tabular whitespace-nowrap">{new Date(a.dateSouscription).toLocaleDateString("fr-FR")}</td>
                    <td className="px-3 py-2.5 text-ink-soft tabular whitespace-nowrap">{new Date(a.dateDebut).toLocaleDateString("fr-FR")}</td>
                    <td className="px-3 py-2.5 font-semibold text-ink whitespace-nowrap">{a.client}{a.telephone && <span className="block text-[11px] font-normal text-ink-soft">{a.telephone}</span>}</td>
                    <td className="px-3 py-2.5"><Badge tone="accent">{niveauLabel(a.niveau)}</Badge></td>
                    <td className="px-3 py-2.5 text-ink-soft tabular whitespace-nowrap">{new Date(a.dateFin).toLocaleDateString("fr-FR")}</td>
                    <td className="px-3 py-2.5 text-center"><Badge tone={actif ? "mint" : "ink"}>{actif ? "Actif" : "Expiré"}</Badge></td>
                    <td className="px-3 py-2.5 text-right tabular font-bold text-ink whitespace-nowrap">{fmtFCFA(a.montant)}</td>
                    <td className="px-3 py-2.5 text-ink-soft whitespace-nowrap">{a.derniereArrivee ? joursRelatifs(a.derniereArrivee) : "—"}</td>
                    <td className="px-3 py-2.5 text-ink-soft max-w-[140px] truncate">{a.note || "—"}</td>
                    <td className="px-3 py-2.5 text-ink-soft whitespace-nowrap">{a.creeParNom || "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => pointer(a)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white whitespace-nowrap" style={{ background: "#30D158" }}>
                          <CheckCircle2 size={12} /> Pointer
                        </button>
                        <button onClick={() => ouvrirCalendrier(a)} className="text-ink-soft hover:text-ink" title="Jours pointés"><CalendarDays size={15} /></button>
                        {modifierOk && <button onClick={() => ouvrirEdition(a)} className="text-ink-soft hover:text-ink"><Pencil size={14} /></button>}
                        {supprimerOk && <button onClick={() => setConfirmCible({ type: "abonnement", data: a })} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Modifier l'abonnement" : "Nouvel abonnement"}
        icon={CalendarCheck}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {modal && (
          <form onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Client"><TextInput value={modal.data.client} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, client: e.target.value } }))} placeholder="Nom du client" autoFocus /></Field>
            <Field label="Téléphone (WhatsApp)" hint="Optionnel"><TextInput value={modal.data.telephone} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, telephone: e.target.value } }))} placeholder="ex : 22890000000" /></Field>
            <Field label="Catégorie">
              <div className="flex gap-2">
                {NIVEAUX_FORFAIT.map((n) => (
                  <button key={n.id} type="button" onClick={() => setModal((m) => ({ ...m, data: { ...m.data, niveau: n.id } }))}
                    className={`flex-1 rounded-2xl border px-3 py-2.5 text-[13px] font-bold transition-colors ${modal.data.niveau === n.id ? "text-white" : "border-black/10 text-ink-soft"}`}
                    style={modal.data.niveau === n.id ? { borderColor: config.color, background: config.color } : undefined}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
              {forfaitChoisi?.description && <p className="mt-1.5 text-[11.5px] text-ink-soft">{forfaitChoisi.description}</p>}
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Date de souscription" hint="Compte dans le CA de ce mois">
                <TextInput type="date" value={modal.data.dateSouscription} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateSouscription: e.target.value } }))} />
              </Field>
              <Field label="Début de l'abonnement">
                <TextInput type="date" value={modal.data.dateDebut} onChange={(e) => majDebutOuDuree({ dateDebut: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Durée (jours)"><TextInput type="number" min="1" value={modal.data.dureeJours} onChange={(e) => majDebutOuDuree({ dureeJours: e.target.value })} /></Field>
              <Field label="Date de fin" hint="Calculée automatiquement, modifiable"><TextInput type="date" value={modal.data.dateFin} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, dateFin: e.target.value } }))} /></Field>
            </div>
            <Field label="Montant (FCFA)" hint={forfaitChoisi?.prixAbonnement != null ? `Minimum ${fmtFCFA(forfaitChoisi.prixAbonnement)} pour cette catégorie` : "Tarif négocié à la souscription"}>
              <TextInput type="number" min="0" value={modal.data.montant} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, montant: e.target.value } }))} placeholder={forfaitChoisi?.prixAbonnement != null ? String(forfaitChoisi.prixAbonnement) : ""} />
            </Field>
            <Field label="Notes" hint="Optionnel"><TextInput value={modal.data.note} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, note: e.target.value } }))} /></Field>
          </form>
        )}
      </Modal>

      <Modal
        open={!!calendrier}
        onClose={() => setCalendrier(null)}
        title={calendrier ? `Jours pointés : ${calendrier.client}` : ""}
        icon={CalendarDays}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<Button variant="ghost" onClick={() => setCalendrier(null)}>Fermer</Button>}
      >
        {calendrier && (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {pointages.length === 0 && <p className="text-[13px] text-ink-soft italic py-4 text-center">Aucune arrivée pointée pour le moment.</p>}
            {pointages.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2 text-[13px]">
                <span className="font-semibold text-ink">{new Date(p.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
                {supprimerOk && (
                  <button onClick={() => setConfirmCible({ type: "pointage", data: { pointage: p, abonnementId: calendrier.id, abonnementClient: calendrier.client } })} className="text-[#FF453A]/60 hover:text-[#FF453A]"><X size={14} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmSuppressionModal
        open={!!confirmCible}
        titre={confirmCible?.type === "pointage" ? "Supprimer ce pointage ?" : "Supprimer cet abonnement ?"}
        description={confirmCible ? (confirmCible.type === "pointage"
          ? `Vous allez supprimer l'arrivée pointée du ${new Date(confirmCible.data.pointage.date).toLocaleDateString("fr-FR")} pour ${confirmCible.data.abonnementClient}.`
          : `Vous allez supprimer l'abonnement de « ${confirmCible.data.client} ».`) : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmCible(null)}
      />
    </div>
  );
}
