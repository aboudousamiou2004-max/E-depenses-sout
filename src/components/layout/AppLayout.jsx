import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, ChevronLeft, LayoutGrid, Receipt, ShieldCheck, Grid2x2 } from "lucide-react";
import Sidebar from "./Sidebar";
import MobileTabBar from "./MobileTabBar";

// Volets essentiels au suivi quotidien d'E-DÉPENSES pour la barre mobile —
// même principe que BusinessLayout.jsx (Tableau de bord + 2 volets clés +
// « Plus » pour le reste), à la demande explicite de l'utilisateur
// (2026-08-19) : la barre doit être visible partout, pas seulement dans un secteur.
const NAV_MOBILE = [
  { to: "/depense", label: "Tableau de bord", icon: LayoutGrid, end: true },
  { to: "/depense/depenses", label: "Dépenses", icon: Receipt },
  { to: "/depense/autorisations", label: "Autorisations", icon: ShieldCheck },
];

export default function AppLayout() {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      <div className="mesh-bg">
        <div className="blob" />
      </div>

      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center gap-3 px-4 py-3 glass-strong m-3 rounded-2xl">
        <button
          onClick={() => navigate(-1)}
          title="Retour"
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-ink-soft hover:bg-black/5 transition-colors"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <button
          onClick={() => setMenuOuvert(true)}
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-ink-soft hover:bg-black/5 transition-colors"
        >
          <Menu size={20} strokeWidth={2.2} />
        </button>
        <img src="/logo_termitiere.png" alt="Logo" className="w-7 h-7 rounded-lg object-contain glass shrink-0" />
        <p className="font-bold tracking-tight text-[14px] text-ink truncate">E-DÉPENSES</p>
      </header>

      <Sidebar open={menuOuvert} onClose={() => setMenuOuvert(false)} />

      <main className="flex-1 min-w-0 p-4 pt-[76px] lg:pt-4 lg:pl-0">
        <div className="h-full overflow-y-auto pr-1 pb-24 lg:pb-8">
          <Outlet />
        </div>
      </main>

      <MobileTabBar items={NAV_MOBILE} accent="#0A84FF" pillId="mobile-nav-pill-depense" menu={{ label: "Plus", icon: Grid2x2, onClick: () => setMenuOuvert(true) }} />
    </div>
  );
}
