import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, AlertTriangle, Info, CheckCircle2, XCircle, Loader2, CheckCheck } from "lucide-react";
import { useDataStore } from "../../store/dataStore";
import { useAuthStore } from "../../store/authStore";
import { pushSupporte, statutAbonnementPush, activerNotificationsPush, desactiverNotificationsPush } from "../../lib/push";

const TYPE_STYLE = {
  warning: { color: "#FF9F0A", icon: AlertTriangle },
  info: { color: "#0A84FF", icon: Info },
  success: { color: "#30D158", icon: CheckCircle2 },
  danger: { color: "#FF453A", icon: XCircle },
};

const PUSH_LABEL = {
  actif: "Notifications push activées",
  inactif: "Notifications push",
  refuse: "Notifications bloquées",
  "non-supporte": "Push non disponible",
};

const PUSH_CAPTION = {
  actif: "Tu reçois les alertes même app fermée",
  inactif: "Reçois les alertes même app fermée",
  refuse: "Débloque-les dans les réglages du navigateur",
  "non-supporte": "Ce navigateur n'est pas compatible",
};

// Formatage relatif court ("à l'instant", "12 min", "3 h", "2 j") — au-delà
// d'une semaine on retombe sur une date classique, plus lisible qu'un
// nombre de jours à trois chiffres.
function tempsRelatif(timestamp) {
  const diffMin = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  const diffJ = Math.floor(diffH / 24);
  if (diffJ < 7) return `${diffJ} j`;
  return new Date(timestamp).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function Toggle({ on, disabled, loading }) {
  return (
    <span
      className={`relative inline-flex items-center w-9 h-5 rounded-full shrink-0 transition-colors duration-200 ${
        on ? "bg-[#30D158]" : "bg-black/15"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <motion.span
        animate={{ x: on ? 16 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] flex items-center justify-center"
      >
        {loading && <Loader2 size={9} className="animate-spin text-ink-soft" strokeWidth={3} />}
      </motion.span>
    </span>
  );
}

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
          <span className="absolute top-1.5 right-1.5 flex">
            <span className="absolute inset-0 rounded-full bg-[#FF453A] opacity-60 animate-ping" />
            <span className="relative min-w-[16px] h-4 px-1 rounded-full bg-[#FF453A] text-white text-[9.5px] font-bold flex items-center justify-center">
              {nonLues > 9 ? "9+" : nonLues}
            </span>
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
              className="absolute right-0 top-12 z-50 w-[340px] max-w-[calc(100vw-2rem)] glass-strong rounded-[24px] overflow-hidden flex flex-col"
            >
              {/* En-tête */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-black/[0.06]">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-ink tracking-tight">Notifications</p>
                  {nonLues > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF453A]/12 text-[#b3241b] text-[10.5px] font-bold flex items-center justify-center">
                      {nonLues}
                    </span>
                  )}
                </div>
                {nonLues > 0 && (
                  <button
                    onClick={() => marquerToutesNotificationsLues(user?.uid)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-ink-soft hover:text-ink transition-colors"
                  >
                    <CheckCheck size={12} strokeWidth={2.4} /> Tout marquer lu
                  </button>
                )}
              </div>

              {/* Réglage push */}
              {pushSupporte && (
                <button
                  onClick={togglePush}
                  disabled={pushStatut === "refuse" || pushStatut === "non-supporte" || pushLoading}
                  className={`flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-black/[0.06] ${
                    pushStatut === "refuse" || pushStatut === "non-supporte" ? "cursor-not-allowed" : "hover:bg-black/[0.02]"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: pushStatut === "actif" ? "#30D1581f" : "rgba(0,0,0,0.045)",
                      color: pushStatut === "actif" ? "#1a7d34" : "#8E8E93",
                    }}
                  >
                    {pushStatut === "refuse" || pushStatut === "non-supporte" ? (
                      <BellOff size={14} strokeWidth={2.2} />
                    ) : (
                      <Bell size={14} strokeWidth={2.2} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-ink leading-snug">{PUSH_LABEL[pushStatut]}</p>
                    <p className="text-[11px] text-ink-soft leading-snug mt-0.5 truncate">{PUSH_CAPTION[pushStatut]}</p>
                  </div>
                  <Toggle on={pushStatut === "actif"} disabled={pushStatut === "refuse" || pushStatut === "non-supporte"} loading={pushLoading} />
                </button>
              )}

              {/* Liste */}
              <div className="max-h-[360px] overflow-y-auto py-1.5">
                {mesNotifs.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-10 px-6 text-center">
                    <div className="w-11 h-11 rounded-full bg-black/[0.04] flex items-center justify-center text-ink-soft/70">
                      <Bell size={18} strokeWidth={2} />
                    </div>
                    <p className="text-[12.5px] text-ink-soft">Tu n'as aucune notification pour le moment.</p>
                  </div>
                )}
                {mesNotifs.map((n) => {
                  const style = TYPE_STYLE[n.type] || TYPE_STYLE.info;
                  const Icon = style.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => onClickNotif(n)}
                      className={`relative w-full text-left flex items-start gap-3 px-4 py-2.5 mx-1.5 rounded-2xl transition-colors hover:bg-black/[0.035] ${
                        n.lu ? "" : "bg-[#0A84FF]/[0.035]"
                      }`}
                      style={{ width: "calc(100% - 12px)" }}
                    >
                      {!n.lu && <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#0A84FF]" />}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${style.color}1a`, color: style.color, opacity: n.lu ? 0.6 : 1 }}
                      >
                        <Icon size={14} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[12.5px] leading-snug ${n.lu ? "text-ink-soft font-medium" : "text-ink font-bold"}`}>
                            {n.titre}
                          </p>
                          <span className="text-[10.5px] text-ink-soft/80 shrink-0 whitespace-nowrap mt-0.5">
                            {tempsRelatif(n.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-ink-soft leading-snug mt-0.5">{n.message}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
