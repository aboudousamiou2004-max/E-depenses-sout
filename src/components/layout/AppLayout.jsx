import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <div className="min-h-screen flex">
      <div className="mesh-bg">
        <div className="blob" />
      </div>

      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center gap-3 px-4 py-3 glass-strong m-3 rounded-2xl">
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
        <div className="h-full overflow-y-auto pr-1 pb-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
