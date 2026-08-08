import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, BellOff, Loader2 } from "lucide-react";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { pushSupporte, statutAbonnementPush, activerNotificationsPush, desactiverNotificationsPush } from "../../lib/push";

const TYPE_TONE = { warning: "#FF9F0A", info: "#0A84FF", success: "#30D158", danger: "#FF453A" };

const PUSH_LABEL = {
  actif: "Notifications push activées",
  inactif: "Activer les notifications push",
  refuse: "Notifications bloquées par le navigateur",
  "non-supporte": "Notifications push non disponibles sur ce navigateur",
};

// Cloche de notifications — chaque utilisateur ne voit que les siennes
// (destinataireUid). Alimentée par le circuit d'autorisation des dépenses :
// demande envoyée à PAU/GE dès dépassement du budget alloué au secteur,
// puis réponse (approuvée / refusée / décaissée) renvoyée au secteur qui a
// fait la demande — désormais aussi relayée en notification navigateur
// (Web Push) en plus de cette cloche in-app, voir src/lib/push.js.
export default function NotificationBell() {
  const { notifications, marquerNotificationLue, marquerToutesNotificationsLues } = useDataStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pushStatut, setPushStatut] = useState("inactif");
  const [pushLoading, setPushLoading] = useState(false);

  const mesNotifs = notifications.filter((n) => n.destinataireUid === user?.uid).slice(0, 30);
  const nonLues = mesNotifs.filter((n) => !n.lu).length;

  useEffect(() => {
    if (open) statutAbonnementPush().then(setPushStatut);
  }, [open]);

  async function togglePush() {
    if (pushStatut === "refuse" || pushStatut === "non-supporte" || pushLoading) return;
    setPushLoading(true);
    const res =
      pushStatut === "actif" ? await desactiverNotificationsPush() : await activerNotificationsPush(user?.uid);
    setPushLoading(false);
    if (!res.ok) return alert(res.error);
    setPushStatut(await statutAbonnementPush());
  }

  async function onClickNotif(n) {
    setOpen(false);
    if (n.lien) navigate(n.lien);
    await marquerNotificationLue(n.id);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-10 h-10 rounded-2xl glass flex items-center justify-center text-ink-soft hover:text-ink transition-colors"
      >
        <Bell size={17} strokeWidth={2.2} />
        {nonLues > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF453A] text-white text-[9.5px] font-bold flex items-center justify-center">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] glass-strong rounded-[22px] p-2 max-h-[420px] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-2.5 py-2">
                <p className="text-[13px] font-bold text-ink">Notifications</p>
                {nonLues > 0 && (
                  <button onClick={() => marquerToutesNotificationsLues(user?.uid)} className="text-[11px] font-semibold text-ink-soft hover:text-ink">
                    Tout marquer lu
                  </button>
                )}
              </div>
              {pushSupporte && (
                <button
                  onClick={togglePush}
                  disabled={pushStatut === "refuse" || pushLoading}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 mb-1 rounded-2xl text-left transition-colors ${
                    pushStatut === "refuse" ? "cursor-not-allowed opacity-60" : "hover:bg-black/5"
                  } ${pushStatut === "actif" ? "bg-[#30D158]/10" : "bg-black/[0.03]"}`}
                >
                  {pushLoading ? (
                    <Loader2 size={15} className="animate-spin text-ink-soft shrink-0" />
                  ) : pushStatut === "actif" ? (
                    <BellRing size={15} className="text-[#1a7d34] shrink-0" strokeWidth={2.2} />
                  ) : (
                    <BellOff size={15} className="text-ink-soft shrink-0" strokeWidth={2.2} />
                  )}
                  <span className="text-[12px] font-semibold text-ink leading-snug">{PUSH_LABEL[pushStatut]}</span>
                </button>
              )}
              {mesNotifs.length === 0 && <p className="text-[13px] text-ink-soft italic text-center py-8">Aucune notification.</p>}
              {mesNotifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onClickNotif(n)}
                  className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2.5 rounded-2xl transition-colors hover:bg-black/5 ${n.lu ? "" : "bg-black/[0.03]"}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: TYPE_TONE[n.type] || "#8E8E93", opacity: n.lu ? 0.35 : 1 }} />
                  <div className="min-w-0">
                    <p className={`text-[12.5px] leading-snug ${n.lu ? "text-ink-soft font-medium" : "text-ink font-bold"}`}>{n.titre}</p>
                    <p className="text-[11.5px] text-ink-soft leading-snug mt-0.5">{n.message}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
