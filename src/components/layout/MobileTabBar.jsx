import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

// Barre de navigation flottante générique (mobile uniquement) — présente sur
// TOUTES les pages de l'application (Portail, E-DÉPENSES, chaque secteur),
// à la demande explicite de l'utilisateur (2026-08-19) : "je veux qu'elle
// soit visible partout". Chaque layout (Portal.jsx, AppLayout.jsx,
// BusinessLayout.jsx) lui passe sa propre liste d'items — c'est ce qui la
// rend différente selon le contexte (et selon le secteur, via
// MobileBottomNav.jsx qui l'enrobe pour BusinessLayout).
export default function MobileTabBar({ items, accent, pillId, menu }) {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-3 z-40 flex justify-center px-3" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="glass-strong relative flex items-center gap-1 rounded-full px-2 py-2 shadow-lg">
        {items.map((item) => {
          const isActive = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className="relative flex flex-col items-center gap-0.5 rounded-full px-3.5 py-1.5">
              {isActive && (
                <motion.div
                  layoutId={pillId}
                  className="absolute inset-0 rounded-full shadow-sm"
                  style={{ background: accent }}
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
        {menu && (
          <button onClick={menu.onClick} className="relative flex flex-col items-center gap-0.5 rounded-full px-3.5 py-1.5 text-ink-soft">
            <span className="flex h-6 items-center justify-center"><menu.icon size={18} strokeWidth={2.3} /></span>
            <span className="max-w-[64px] truncate text-[10px] font-semibold">{menu.label}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
