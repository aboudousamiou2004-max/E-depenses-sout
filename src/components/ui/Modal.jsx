import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

// Vrai sur téléphone (moins de 640 px). Sert uniquement au mode `feuille`.
function useEstMobile(actif) {
  const [mobile, setMobile] = useState(() => actif && typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    if (!actif) return undefined;
    const mq = window.matchMedia("(max-width: 639px)");
    const maj = () => setMobile(mq.matches);
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, [actif]);
  return actif && mobile;
}

// `icon` + `accent` (+ `moduleLabel` optionnel) affichent le logo et le nom
// du module en tête de fenêtre, repris du bandeau de page (TopBarSimple),
// à la demande de l'utilisateur (2026-08-18) pour que chaque fenêtre reste
// identifiable même une fois ouverte par-dessus la page.
//
// Options pour les écrans tactiles (désactivées par défaut, les autres
// fenêtres de l'application ne changent pas) :
// - `feuille` : sur téléphone, la fenêtre monte du bas de l'écran comme une
//   feuille (bords arrondis en haut seulement) et son en-tête reste visible ;
// - `footerCollant` : les boutons du bas restent visibles en permanence, sans
//   avoir à faire défiler tout le formulaire pour atteindre « Enregistrer ».
export default function Modal({ open, onClose, title, icon: Icon, iconNode, accent = "#0A84FF", moduleLabel, children, footer, feuille = false, footerCollant = false }) {
  const feuilleMobile = useEstMobile(feuille);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex justify-center ${feuille ? "items-end p-0 sm:items-center sm:p-6" : "items-center p-3 sm:p-6"}`}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={feuilleMobile ? { y: "100%" } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={feuilleMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={feuilleMobile ? { y: "100%" } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={feuilleMobile ? { type: "spring", damping: 34, stiffness: 340 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`relative glass-strong w-full max-w-lg overflow-y-auto ${feuille ? "max-h-[92vh] rounded-b-none rounded-t-[28px] sm:max-h-[85vh] sm:rounded-b-[28px]" : "max-h-[85vh] rounded-[28px]"}`}
          >
            {feuille && <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-black/15 sm:hidden" />}
            <div className={`flex items-center gap-3 px-5 sm:px-7 pb-4 ${feuille ? "sticky top-0 z-10 bg-white/80 pt-3 backdrop-blur-xl sm:pt-7" : "pt-5 sm:pt-7"}`}>
              {iconNode}
              {!iconNode && Icon && (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${accent}1a`, color: accent }}>
                  <Icon size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {moduleLabel && <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: accent }}>{moduleLabel}</p>}
                <h2 className={`text-lg font-bold tracking-tight text-ink ${iconNode ? "leading-tight" : "truncate"}`}>{title}</h2>
              </div>
              <button onClick={onClose} className={`shrink-0 rounded-xl flex items-center justify-center hover:bg-black/5 text-ink-soft transition-colors ${feuille ? "h-10 w-10 sm:h-8 sm:w-8" : "h-8 w-8"}`}>
                <X size={17} strokeWidth={2.2} />
              </button>
            </div>
            <div className={`h-px bg-black/[0.06] mx-5 sm:mx-7 ${Icon || iconNode ? "" : "hidden"}`} />
            <div className="px-5 sm:px-7 pt-4 pb-5 sm:pb-7">
              {children}
              {footer && (
                <div
                  className={footerCollant
                    ? "sticky bottom-0 z-10 -mx-5 -mb-5 mt-4 flex items-center justify-end gap-2.5 border-t border-black/[0.06] bg-white/85 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:-mx-7 sm:-mb-7 sm:px-7 sm:pb-4"
                    : "mt-6 flex items-center justify-end gap-2.5"}
                >
                  {footer}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
