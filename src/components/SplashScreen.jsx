import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

// Écran affiché pendant la résolution de la session (App.jsx) : le logo
// LA TERMITIÈRE, suivi d'un scénario de chargement qui fait défiler tous les
// modules de la plateforme un par un — plutôt qu'un simple spinner neutre.
// Purement visuel (les modules réellement accessibles dépendent du rôle et
// ne sont connus qu'une fois la session résolue) : la liste ci-dessous sert
// de mise en scène, pas d'indicateur technique de progression.
const MODULES = [
  { nom: "E-DÉPENSES", color: "#0A84FF" },
  { nom: "MAXI AGRO", color: "#30D158" },
  { nom: "MAXI LOGISTIQUE", color: "#FF9F0A" },
  { nom: "E-BRIQUETERIE", color: "#BF5AF2" },
  { nom: "E-FONCIER", color: "#64D2FF" },
  { nom: "E-GARDERIE", color: "#FF375F" },
  { nom: "E-G.PRO", color: "#5E5CE6" },
];

const DELAI_PAR_MODULE = 260;

export default function SplashScreen() {
  const [visibles, setVisibles] = useState(0);

  useEffect(() => {
    if (visibles >= MODULES.length) return;
    const t = setTimeout(() => setVisibles((v) => v + 1), visibles === 0 ? 350 : DELAI_PAR_MODULE);
    return () => clearTimeout(t);
  }, [visibles]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-white">
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="w-20 h-20 rounded-full bg-white shadow-[0_8px_28px_-6px_rgba(0,0,0,0.18)] border border-black/5 flex items-center justify-center p-3"
      >
        <img src="/logo_termitiere.png" alt="LA TERMITIÈRE" className="w-full h-full object-contain" />
      </motion.div>

      <div className="flex flex-col gap-2 w-64">
        <AnimatePresence>
          {MODULES.map((m, i) => (
            i < visibles && (
              <motion.div
                key={m.nom}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2.5"
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${m.color}1a`, color: m.color }}
                >
                  <Check size={11} strokeWidth={3} />
                </span>
                <span className="text-[12.5px] font-semibold text-ink-soft">{m.nom}</span>
              </motion.div>
            )
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
