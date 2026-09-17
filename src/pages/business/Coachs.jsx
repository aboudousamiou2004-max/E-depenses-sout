import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Dumbbell, Plus, Trash2, Pencil, Phone, CalendarDays, CheckCircle2 } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput } from "../../components/ui/Field";
import { useGymStore, JOURS_SEMAINE, jourAujourdhui, heureActuelle } from "../../store/gymStore";
import { useAuthStore } from "../../store/authStore";
import { peutModifier, peutSupprimer } from "../../lib/modules";
import ConfirmSuppressionModal from "../../components/ui/ConfirmSuppressionModal";
import { enregistrerMotifSuppression } from "../../lib/motifSuppression";

const VIDE = { nom: "", telephone: "", specialite: "", joursPresence: [], heureArrivee: "08:00" };

// Coachs — volet spécifique à MAXI GYM : liste des coachs/entraîneurs (nom,
// spécialité, contact, jours de présence dans la semaine + heure d'arrivée
// attendue). L'agent pointe l'arrivée réelle du jour ici (bouton « Arrivé »)
// — le tableau de bord du secteur reprend ce même statut (attendu / en
// retard / arrivé) pour les coachs programmés aujourd'hui. Ne gère pas la
// paie — les dépenses de personnel restent saisies depuis Dépenses.
export default function Coachs() {
  const config = useOutletContext();
  const { coachs, chargerCoachs, ajouterCoach, modifierCoach, toggleActifCoach, supprimerCoach, pointagesCoachsAujourdhui, chargerPointagesCoachsAujourdhui, pointerCoach } = useGymStore();
  const { user } = useAuthStore();
  const modifierOk = peutModifier(user?.role);
  const supprimerOk = peutSupprimer(user?.role);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmCible, setConfirmCible] = useState(null);

  useEffect(() => { chargerCoachs(config.secteurId); chargerPointagesCoachsAujourdhui(config.secteurId); }, [config.secteurId]);

  const actifs = coachs.filter((c) => c.actif).length;
  const today = jourAujourdhui();
  const heureMaintenant = heureActuelle();

  const pointageDe = (coachId) => pointagesCoachsAujourdhui.find((p) => p.coachId === coachId);

  function openCreate() { setModal({ id: null, data: { ...VIDE } }); setError(""); }
  function openEdit(c) { setModal({ id: c.id, data: { nom: c.nom, telephone: c.telephone, specialite: c.specialite, joursPresence: c.joursPresence, heureArrivee: c.heureArrivee || "08:00" } }); setError(""); }

  function toggleJour(j) {
    setModal((m) => {
      const joursPresence = m.data.joursPresence.includes(j) ? m.data.joursPresence.filter((x) => x !== j) : [...m.data.joursPresence, j];
      return { ...m, data: { ...m.data, joursPresence } };
    });
  }

  async function enregistrer() {
    if (!modal.data.nom.trim()) return setError("Nom requis");
    setSaving(true);
    setError("");
    const res = modal.id ? await modifierCoach(modal.id, modal.data) : await ajouterCoach(config.secteurId, modal.data);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function confirmerSuppression(motif) {
    const c = confirmCible;
    await enregistrerMotifSuppression({ user, table: "gym_coachs", label: c.nom, motif, secteurId: config.secteurId });
    return supprimerCoach(c.id);
  }

  async function pointer(c) {
    const res = await pointerCoach(c.id);
    if (!res.ok) alert(res.error);
  }

  return (
    <div>
      <TopBarSimple title="Coachs" subtitle={`${config.nom} : équipe d'entraîneurs`} icon={Dumbbell} accent={config.color} />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatTile icon={Dumbbell} label="Coachs actifs" value={String(actifs)} tone={config.color} />
        <StatTile icon={Dumbbell} label="Total" value={String(coachs.length)} tone="#8E8E93" />
      </div>

      <div className="flex justify-end mb-4">
        <Button icon={Plus} onClick={openCreate} style={{ background: config.color }}>Nouveau coach</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-3 py-3">Coach</th>
              <th className="px-3 py-3">Spécialité</th>
              <th className="px-3 py-3">Jours de présence</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3">Aujourd'hui</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {coachs.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun coach.</td></tr>}
            {coachs.map((c) => {
              const programmeAujourdhui = c.joursPresence.includes(today);
              const pointage = pointageDe(c.id);
              const enRetard = programmeAujourdhui && !pointage && c.heureArrivee && heureMaintenant > c.heureArrivee;
              return (
                <tr key={c.id} className="text-[13px] hover:bg-white/50 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-ink">{c.nom}</p>
                    {c.telephone && <p className="text-[11.5px] text-ink-soft flex items-center gap-1 mt-0.5"><Phone size={11} /> {c.telephone}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">{c.specialite || "—"}</td>
                  <td className="px-3 py-2.5">
                    {c.joursPresence.length === 0 ? (
                      <span className="text-ink-soft/50">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {JOURS_SEMAINE.filter((j) => c.joursPresence.includes(j.id)).map((j) => (
                          <span key={j.id} className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{j.label}</span>
                        ))}
                        {c.heureArrivee && <span className="ml-1 text-[11px] font-semibold text-ink-soft">{c.heureArrivee}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => toggleActifCoach(c.id, !c.actif)}>
                      <Badge tone={c.actif ? "mint" : "ink"}>{c.actif ? "Actif" : "Inactif"}</Badge>
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    {!programmeAujourdhui ? (
                      <span className="text-ink-soft/50">—</span>
                    ) : pointage ? (
                      <Badge tone="mint">Arrivé à {pointage.heureReelle?.slice(0, 5)}</Badge>
                    ) : enRetard ? (
                      <button onClick={() => pointer(c)} className="flex items-center gap-1 rounded-full bg-[#FF453A]/10 px-2.5 py-1 text-[11px] font-bold text-[#b3241b]">
                        <CheckCircle2 size={12} /> En retard : Arrivé
                      </button>
                    ) : (
                      <button onClick={() => pointer(c)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: "#30D158" }}>
                        <CheckCircle2 size={12} /> Attendu {c.heureArrivee || ""} : Arrivé
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {modifierOk && <button onClick={() => openEdit(c)} className="text-ink-soft hover:text-ink"><Pencil size={14} /></button>}
                      {supprimerOk && <button onClick={() => setConfirmCible(c)} className="text-[#FF453A] hover:opacity-70"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Modifier le coach" : "Nouveau coach"}
        icon={Dumbbell}
        accent={config.color}
        moduleLabel={config.nom}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={enregistrer} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {modal && (
          <form onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Nom du coach"><TextInput value={modal.data.nom} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, nom: e.target.value } }))} placeholder="ex : Willy" autoFocus /></Field>
            <Field label="Spécialité" hint="Optionnel"><TextInput value={modal.data.specialite} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, specialite: e.target.value } }))} placeholder="ex : Musculation, cardio…" /></Field>
            <Field label="Téléphone" hint="Optionnel"><TextInput value={modal.data.telephone} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, telephone: e.target.value } }))} /></Field>
            <Field label="Jours de présence">
              <div className="flex flex-wrap gap-1.5">
                {JOURS_SEMAINE.map((j) => (
                  <button key={j.id} type="button" onClick={() => toggleJour(j.id)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${modal.data.joursPresence.includes(j.id) ? "text-white" : "border-black/10 text-ink-soft"}`}
                    style={modal.data.joursPresence.includes(j.id) ? { borderColor: config.color, background: config.color } : undefined}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
            </Field>
            {modal.data.joursPresence.length > 0 ? (
              <Field label="Heure d'arrivée attendue">
                <TextInput type="time" value={modal.data.heureArrivee} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, heureArrivee: e.target.value } }))} />
              </Field>
            ) : (
              <p className="flex items-center gap-1.5 text-[12px] text-ink-soft mb-2"><CalendarDays size={13} /> Choisis au moins un jour ci-dessus pour définir son heure d'arrivée.</p>
            )}
          </form>
        )}
      </Modal>

      <ConfirmSuppressionModal
        open={!!confirmCible}
        titre="Supprimer ce coach ?"
        description={confirmCible ? `Vous allez supprimer la fiche de ${confirmCible.nom}.` : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setConfirmCible(null)}
      />
    </div>
  );
}
