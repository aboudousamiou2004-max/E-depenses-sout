import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutGrid, Receipt, Wallet, ShieldCheck, LineChart, TrendingUp, Landmark, Handshake, ScrollText, LogOut, ArrowLeft, Users, Settings,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { ROLES_ACCES_TOTAL } from "../../lib/modules";

const NAV = [
  { to: "/depense", label: "Tableau de bord", icon: LayoutGrid, end: true },
  { to: "/depense/depenses", label: "Dépenses", icon: Receipt },
  { to: "/depense/recettes", label: "Recette et Budget", icon: Wallet },
  { to: "/depense/autorisations", label: "Autorisations", icon: ShieldCheck },
  { to: "/depense/analyses", label: "Analyses", icon: LineChart },
  { to: "/depense/rentabilite", label: "Rentabilité", icon: TrendingUp },
  { to: "/depense/flux", label: "Flux de trésorerie", icon: TrendingUp },
  { to: "/depense/banque", label: "Compte bancaire", icon: Landmark },
  { to: "/depense/partenaires", label: "Partenaires", icon: Handshake },
  { to: "/depense/journal", label: "Journal", icon: ScrollText },
];

export default function Sidebar({ open = false, onClose }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const peutGererUtilisateurs = ROLES_ACCES_TOTAL.includes(user?.role);

  function go(to) {
    navigate(to);
    onClose?.();
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`w-[264px] shrink-0 h-screen fixed lg:sticky top-0 left-0 z-50 p-4 flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="glass-strong rounded-[28px] flex-1 flex flex-col p-4 overflow-y-auto">
        <button
          onClick={() => go("/portal")}
          className="btn-signal-glow flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-soft hover:text-ink px-2 py-1 rounded-xl mb-2 transition-colors"
        >
          <motion.span
            className="flex items-center"
            animate={{ x: [0, -4, 0] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowLeft size={13} strokeWidth={2.4} />
          </motion.span>
          Retour au portail
        </button>

        <div className="flex items-center gap-2.5 px-2 py-3">
          <img src="/logo_termitiere.png" alt="Logo" className="w-10 h-10 rounded-2xl object-contain glass shrink-0" />
          <div>
            <p className="font-bold tracking-tight text-[15px] leading-none text-ink">E-DÉPENSES</p>
            <p className="text-[11px] text-ink-soft font-medium mt-1">LA TERMITIÈRE</p>
          </div>
        </div>

        <nav className="mt-4 flex-1 flex flex-col gap-1">
          {peutGererUtilisateurs && (
            <NavLink to="/utilisateurs" onClick={onClose}>
              {({ isActive }) => (
                <div className="relative px-3 py-2.5 rounded-2xl flex items-center gap-3 group cursor-pointer">
                  {isActive && (
                    <motion.div layoutId="nav-pill" className="absolute inset-0 bg-white/85 shadow-[0_4px_16px_rgba(15,23,42,0.10)] rounded-2xl" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                  )}
                  <Users size={18} strokeWidth={2.2} className={`relative z-10 transition-colors ${isActive ? "text-[#0A84FF]" : "text-ink-soft group-hover:text-ink"}`} />
                  <span className={`relative z-10 text-[13.5px] font-semibold tracking-tight transition-colors ${isActive ? "text-ink" : "text-ink-soft group-hover:text-ink"}`}>Utilisateurs</span>
                </div>
              )}
            </NavLink>
          )}
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose}>
              {({ isActive }) => (
                <div className="relative px-3 py-2.5 rounded-2xl flex items-center gap-3 group cursor-pointer">
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white/85 shadow-[0_4px_16px_rgba(15,23,42,0.10)] rounded-2xl"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <item.icon
                    size={18}
                    strokeWidth={2.2}
                    className={`relative z-10 transition-colors ${isActive ? "text-[#0A84FF]" : "text-ink-soft group-hover:text-ink"}`}
                  />
                  <span className={`relative z-10 text-[13.5px] font-semibold tracking-tight transition-colors ${isActive ? "text-ink" : "text-ink-soft group-hover:text-ink"}`}>
                    {item.label}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
          {peutGererUtilisateurs && (
            <NavLink to="/depense/parametres" onClick={onClose}>
              {({ isActive }) => (
                <div className="relative px-3 py-2.5 rounded-2xl flex items-center gap-3 group cursor-pointer">
                  {isActive && (
                    <motion.div layoutId="nav-pill" className="absolute inset-0 bg-white/85 shadow-[0_4px_16px_rgba(15,23,42,0.10)] rounded-2xl" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                  )}
                  <Settings size={18} strokeWidth={2.2} className={`relative z-10 transition-colors ${isActive ? "text-[#0A84FF]" : "text-ink-soft group-hover:text-ink"}`} />
                  <span className={`relative z-10 text-[13.5px] font-semibold tracking-tight transition-colors ${isActive ? "text-ink" : "text-ink-soft group-hover:text-ink"}`}>Paramètres</span>
                </div>
              )}
            </NavLink>
          )}
        </nav>

        <div className="mt-2 pt-3 border-t border-black/5">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF9F0A] to-[#FF453A] flex items-center justify-center text-white text-xs font-bold">
              {user?.nom?.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate">{user?.nom}</p>
              <p className="text-[11px] text-ink-soft truncate">{roleLabel(user?.role)}</p>
            </div>
            <button
              onClick={logout}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-black/5 hover:text-[#FF453A] transition-colors"
              title="Se déconnecter"
            >
              <LogOut size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
      </aside>
    </>
  );
}

function roleLabel(role) {
  return (
    {
      super_admin: "Super-administrateur",
      pau: "PAU (approbateur)",
      ge: "Gestion Exécutive",
      directeur: "Directeur",
      superviseur: "Superviseur",
      gerant: "Gérant de secteur",
      agent: "Agent de secteur",
    }[role] || role
  );
}
