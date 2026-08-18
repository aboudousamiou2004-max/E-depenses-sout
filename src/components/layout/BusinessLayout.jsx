import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutGrid, Receipt, FileText, LogOut, ArrowLeft, Boxes, PawPrint, ClipboardList, HeartPulse, Scale, FolderOpen, Baby, Menu, Warehouse, Gauge, RotateCcw, Factory, Package, Wrench, Wallet, Stethoscope, Utensils, BarChart3, FolderKanban, ListTodo, PackagePlus } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

const STOCK_NAV = {
  materiel: { label: "Stock", icon: Boxes },
  animaux: { label: "Cheptel", icon: PawPrint },
};

export default function BusinessLayout({ config }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const stockNav = STOCK_NAV[config.stock];
  const [menuOuvert, setMenuOuvert] = useState(false);

  const NAV = [
    { to: config.path, label: "Tableau de bord", icon: LayoutGrid, end: true },
    // Prestations : sans objet pour E-GARDERIE (pas de prestation générique
    // — l'inscription et le frais qui l'accompagne se font depuis Enfants) ni
    // pour E-G.PRO (la facturation client se fait désormais depuis Projets —
    // contrat + versements — à la demande de l'utilisateur, 2026-08-18).
    ...(!["garderie", "egpro"].includes(config.id) ? [{ to: `${config.path}/facturation`, label: "Prestations", icon: FileText }] : []),
    { to: `${config.path}/depenses`, label: "Dépenses", icon: Receipt },
    // Besoins : disponible dans TOUS les modules métier — demandes reçues par
    // les directeurs et l'administration, à la demande de l'utilisateur
    // (2026-08-18). Un besoin validé crée une dépense réelle.
    { to: `${config.path}/besoins`, label: "Besoins", icon: PackagePlus },
    ...(stockNav ? [{ to: `${config.path}/stock`, label: stockNav.label, icon: stockNav.icon }] : []),
    // Saisie journalière + Santé animale : spécifiques au cheptel MAXI AGRO —
    // cf. termitiere-platform/src/modules/agro/{Saisie,Sante}.jsx.
    ...(config.stock === "animaux" ? [
      { to: `${config.path}/saisie`, label: "Saisie journalière", icon: ClipboardList },
      { to: `${config.path}/sante`, label: "Santé animale", icon: HeartPulse },
      { to: `${config.path}/magasin`, label: "Magasin", icon: Warehouse },
    ] : []),
    // Production, Matériaux, Matériel, Marge & Bénéfice : spécifiques à
    // E-BRIQUETERIE (remplacent l'ancien volet générique « Stock »).
    ...(config.stock === "briques" ? [
      { to: `${config.path}/production`, label: "Production", icon: Factory },
      { to: `${config.path}/materiaux`, label: "Matériaux", icon: Package },
      { to: `${config.path}/materiel`, label: "Matériel", icon: Wrench },
      { to: `${config.path}/marge`, label: "Marge & Bénéfice", icon: Scale },
    ] : []),
    // Analyses + Retour : spécifiques à MAXI LOGISTIQUE — rentabilité
    // locative (CA par article, taux d'utilisation, pertes) et validation
    // des retours de matériel (bon état / cassé / perdu).
    ...(config.stock === "materiel" ? [
      { to: `${config.path}/analyses`, label: "Analyses", icon: Gauge },
      { to: `${config.path}/retour`, label: "Retour", icon: RotateCcw },
    ] : []),
    // Dossiers fonciers : spécifique à E-FONCIER — cf.
    // termitiere-platform/src/modules/foncier/Dossiers.jsx.
    ...(config.id === "foncier" ? [{ to: `${config.path}/dossiers`, label: "Dossiers fonciers", icon: FolderOpen }] : []),
    // Projets, Tâches : spécifiques à E-G.PRO — porté (simplifié) depuis
    // termitiere-platform/src/modules/projet/{Projets,Taches}.jsx, à la
    // demande de l'utilisateur (2026-08-18), scope "Projets + Tâches"
    // choisi car rattachable aux dépenses (contrairement à Planning,
    // Documents, Galerie photos, hors scope de cette application).
    ...(config.id === "egpro" ? [
      { to: `${config.path}/projets`, label: "Projets", icon: FolderKanban },
      { to: `${config.path}/taches`, label: "Tâches", icon: ListTodo },
    ] : []),
    // Enfants, Paiements, Cantine & Repas, Santé & Infirmerie, Analyse &
    // Pilotage : spécifiques à E-GARDERIE — cf. termitiere-platform/src/
    // modules/garderie/{Enfants,Paiements,Cantine,Incidents,Analyses}.jsx.
    ...(config.id === "garderie" ? [
      { to: `${config.path}/enfants`, label: "Enfants", icon: Baby },
      { to: `${config.path}/paiements`, label: "Paiements", icon: Wallet },
      { to: `${config.path}/cantine`, label: "Cantine & Repas", icon: Utensils },
      { to: `${config.path}/infirmerie`, label: "Santé & Infirmerie", icon: Stethoscope },
      { to: `${config.path}/analyse`, label: "Analyse & Pilotage", icon: BarChart3 },
    ] : []),
  ];

  function go(to) {
    navigate(to);
    setMenuOuvert(false);
  }

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
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: config.color }}>
          <config.icon size={14} className="text-white" strokeWidth={2.4} />
        </div>
        <p className="font-bold tracking-tight text-[14px] text-ink truncate">{config.nom}</p>
      </header>

      {menuOuvert && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMenuOuvert(false)} />}

      <aside
        className={`w-[264px] shrink-0 h-screen fixed lg:sticky top-0 left-0 z-50 p-4 flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 ${
          menuOuvert ? "translate-x-0" : "-translate-x-full"
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
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: config.color, boxShadow: `0 8px 20px ${config.color}55` }}>
              <config.icon size={20} className="text-white" strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-bold tracking-tight text-[15px] leading-none text-ink">{config.nom}</p>
              <p className="text-[11px] text-ink-soft font-medium mt-1">{config.description}</p>
            </div>
          </div>

          <nav className="mt-4 flex-1 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOuvert(false)}>
                {({ isActive }) => (
                  <div className="relative px-3 py-2.5 rounded-2xl flex items-center gap-3 group cursor-pointer">
                    {isActive && (
                      <motion.div
                        layoutId={`nav-pill-${config.id}`}
                        className="absolute inset-0 bg-white/85 shadow-[0_4px_16px_rgba(15,23,42,0.10)] rounded-2xl"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <item.icon
                      size={18}
                      strokeWidth={2.2}
                      className="relative z-10 transition-colors"
                      style={{ color: isActive ? config.color : undefined }}
                    />
                    <span className={`relative z-10 text-[13.5px] font-semibold tracking-tight transition-colors ${isActive ? "text-ink" : "text-ink-soft group-hover:text-ink"}`}>
                      {item.label}
                    </span>
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-2 pt-3 border-t border-black/5">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF9F0A] to-[#FF453A] flex items-center justify-center text-white text-xs font-bold">
                {user?.nom?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-ink truncate">{user?.nom}</p>
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

      <main className="flex-1 min-w-0 p-4 pt-[76px] lg:pt-4 lg:pl-0">
        <div className="h-full overflow-y-auto pr-1 pb-8">
          <Outlet context={config} />
        </div>
      </main>
    </div>
  );
}
