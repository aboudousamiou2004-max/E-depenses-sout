import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

// `icon` + `accent` (+ `moduleLabel` optionnel) affichent le logo et le nom
// du module en tête de fenêtre — repris du bandeau de page (TopBarSimple),
// à la demande de l'utilisateur (2026-08-18) pour que chaque fenêtre reste
// identifiable même une fois ouverte par-dessus la page.
export default function Modal({ open, onClose, title, icon: Icon, accent = "#0A84FF", moduleLabel, children, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative glass-strong rounded-[28px] w-full max-w-lg max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 px-5 sm:px-7 pt-5 sm:pt-7 pb-4">
              {Icon && (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${accent}1a`, color: accent }}>
                  <Icon size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {moduleLabel && <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: accent }}>{moduleLabel}</p>}
                <h2 className="text-lg font-bold tracking-tight text-ink truncate">{title}</h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center hover:bg-black/5 text-ink-soft transition-colors">
                <X size={17} strokeWidth={2.2} />
              </button>
            </div>
            <div className={`h-px bg-black/[0.06] mx-5 sm:mx-7 ${Icon ? "" : "hidden"}`} />
            <div className="px-5 sm:px-7 pt-4 pb-5 sm:pb-7">
              {children}
              {footer && <div className="mt-6 flex items-center justify-end gap-2.5">{footer}</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
