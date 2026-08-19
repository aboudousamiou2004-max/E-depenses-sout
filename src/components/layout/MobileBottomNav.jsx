import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Grid2x2 } from "lucide-react";

// Volets jugés essentiels au suivi/gestion quotidien de chaque secteur — en
// plus du Tableau de bord (toujours inclus) et du bouton « Plus » (ouvre le
// menu complet pour tout le reste). Référencés par le dernier segment de
// leur chemin (`${config.path}/<segment>`), pour rester indépendants de
// l'ordre du tableau NAV construit dans BusinessLayout.jsx. Limité à 2 par
// secteur pour garder la barre lisible sur mobile — à la demande explicite
// de l'utilisateur (2026-08-19).
const ESSENTIELS = {
  agro: ["saisie", "facturation"],
  logistique: ["facturation", "stock"],
  briqueterie: ["production", "facturation"],
  foncier: ["dossiers", "besoins"],
  garderie: ["enfants", "paiements"],
  egpro: ["projets", "taches"],
};

// Barre de navigation flottante — mobile uniquement (le sidebar complet
// reste utilisable dès la largeur tablette). Porté (simplifié, sans mesure
// de pastille glissante) depuis
// termitiere-platform/src/shared/Layout/MobileBottomNav.jsx.
export default function MobileBottomNav({ config, nav, onOpenMenu }) {
  const location = useLocation();

  const dashboard = nav.find((n) => n.end);
  const essentielsSegments = ESSENTIELS[config.id] || [];
  const essentiels = essentielsSegments
    .map((seg) => nav.find((n) => n.to.endsWith(`/${seg}`)))
    .filter(Boolean);
  const items = [dashboard, ...essentiels].filter((it, i, arr) => it && arr.findIndex((x) => x.to === it.to) === i);

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-3 z-40 flex justify-center px-3" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="glass-strong relative flex items-center gap-1 rounded-full px-2 py-2 shadow-lg">
        {items.map((item) => {
          const isActive = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className="relative flex flex-col items-center gap-0.5 rounded-full px-3.5 py-1.5">
              {isActive && (
                <motion.div
                  layoutId={`mobile-nav-pill-${config.id}`}
                  className="absolute inset-0 rounded-full shadow-sm"
                  style={{ background: config.color }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative z-10 flex h-6 items-center justify-center">
                <item.icon size={18} strokeWidth={2.3} color={isActive ? "#fff" : undefined} className={isActive ? "" : "text-ink-soft"} />
              </span>
              <span className={`relative z-10 max-w-[64px] truncate text-[10px] font-semibold ${isActive ? "text-white" : "text-ink-soft"}`}>{item.label}</span>
            </NavLink>
          );
        })}
        <button onClick={onOpenMenu} className="relative flex flex-col items-center gap-0.5 rounded-full px-3.5 py-1.5 text-ink-soft">
          <span className="flex h-6 items-center justify-center"><Grid2x2 size={18} strokeWidth={2.3} /></span>
          <span className="max-w-[64px] truncate text-[10px] font-semibold">Plus</span>
        </button>
      </div>
    </nav>
  );
}

