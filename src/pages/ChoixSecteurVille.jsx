import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { modulesAccessibles, groupesModules } from "../lib/modules";
import CarteSecteurVille from "../components/CarteSecteurVille";
import GlassCard from "../components/ui/GlassCard";

// Écran intermédiaire « choisir un lieu » — affiché quand on clique, depuis
// le Portail, sur un module décliné par ville (MAXI GYM, MAXI LOGISTIQUE...).
// Le Portail lui-même ne montre plus qu'une seule carte par module (voir
// CarteFamilleModule dans Portal.jsx) : c'est ICI, et seulement ici, que les
// lieux (Lomé, Kara...) apparaissent en cartes détaillées — à la demande
// explicite de l'utilisateur (2026-09-15), pour qu'un module fraîchement
// décliné sur une nouvelle ville (depuis Paramètres) apparaisse tout de
// suite ici sans jamais encombrer la page d'accueil.
export default function ChoixSecteurVille() {
  const { base: baseParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { secteurs, recettes } = useDataStore();

  const accessibles = useMemo(() => modulesAccessibles(user, secteurs), [user, secteurs]);
  const groupe = useMemo(
    () => groupesModules(accessibles).find((g) => g.base === baseParam),
    [accessibles, baseParam]
  );

  if (!groupe || groupe.modules.length < 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <GlassCard className="p-8 text-center max-w-sm" hover={false}>
          <p className="text-ink-soft mb-4">Ce module n'est pas (ou plus) accessible depuis ce lien.</p>
          <button
            onClick={() => navigate("/portal")}
            className="glass rounded-2xl px-4 py-2 text-[13px] font-semibold text-ink hover:bg-white/70 transition-colors"
          >
            Retour au portail
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="mesh-bg">
        <div className="blob" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <button
          onClick={() => navigate("/portal")}
          className="btn-signal-glow glass rounded-2xl px-3.5 py-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink hover:bg-white/70 transition-colors mb-5"
        >
          <motion.span className="flex items-center" animate={{ x: [0, -4, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}>
            <ArrowLeft size={14} strokeWidth={2.4} />
          </motion.span>
          Retour au portail
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${groupe.modules[0].color}1a`, color: groupe.modules[0].color }}>
            <MapPin size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-ink leading-tight">{groupe.base}</h1>
            <p className="text-[12.5px] sm:text-[13.5px] text-ink-soft font-medium">{groupe.modules[0].description} : choisissez un lieu</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {groupe.modules.map((m, i) => (
            <CarteSecteurVille key={m.id} m={m} i={i} recettes={recettes} onClick={() => navigate(m.path)} />
          ))}
        </div>
      </div>
    </div>
  );
}
