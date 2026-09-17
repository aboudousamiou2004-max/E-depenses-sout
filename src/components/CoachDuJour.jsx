import { useEffect } from "react";
import { CheckCircle2, Dumbbell } from "lucide-react";
import GlassCard from "./ui/GlassCard";
import Badge from "./ui/Badge";
import { useGymStore, jourAujourdhui, heureActuelle } from "../store/gymStore";

// Widget « Coach du jour » — tableau de bord MAXI GYM (voir BusinessDashboard.jsx) :
// coachs programmés aujourd'hui (jours de présence), avec leur statut
// (attendu à telle heure / en retard / arrivé à telle heure). L'agent pointe
// l'arrivée réelle ici OU depuis le volet Coachs (même action, même store).
export default function CoachDuJour({ secteurId, accent }) {
  const { coachs, chargerCoachs, pointagesCoachsAujourdhui, chargerPointagesCoachsAujourdhui, pointerCoach } = useGymStore();

  useEffect(() => { chargerCoachs(secteurId); chargerPointagesCoachsAujourdhui(secteurId); }, [secteurId]);

  const today = jourAujourdhui();
  const heureMaintenant = heureActuelle();
  const duJour = coachs.filter((c) => c.actif && c.joursPresence.includes(today));
  const pointageDe = (coachId) => pointagesCoachsAujourdhui.find((p) => p.coachId === coachId);

  async function pointer(c) {
    const res = await pointerCoach(c.id);
    if (!res.ok) alert(res.error);
  }

  if (duJour.length === 0) return null;

  return (
    <GlassCard className="p-5 mt-5" hover={false}>
      <div className="flex items-center gap-2 mb-3">
        <Dumbbell size={16} style={{ color: accent }} />
        <h3 className="font-bold tracking-tight text-ink">Coach du jour</h3>
      </div>
      <div className="flex flex-col gap-2">
        {duJour.map((c) => {
          const pointage = pointageDe(c.id);
          const enRetard = !pointage && c.heureArrivee && heureMaintenant > c.heureArrivee;
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-black/[0.03] px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-ink text-[13.5px] truncate">{c.nom}</p>
                {c.specialite && <p className="text-[11.5px] text-ink-soft truncate">{c.specialite}</p>}
              </div>
              {pointage ? (
                <Badge tone="mint">Arrivé à {pointage.heureReelle?.slice(0, 5)}</Badge>
              ) : enRetard ? (
                <button onClick={() => pointer(c)} className="shrink-0 flex items-center gap-1 rounded-full bg-[#FF453A]/10 px-3 py-1.5 text-[11.5px] font-bold text-[#b3241b]">
                  <CheckCircle2 size={13} /> En retard (attendu {c.heureArrivee})
                </button>
              ) : (
                <button onClick={() => pointer(c)} className="shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white" style={{ background: "#30D158" }}>
                  <CheckCircle2 size={13} /> Attendu {c.heureArrivee || ""}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
