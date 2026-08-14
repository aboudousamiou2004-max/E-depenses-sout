import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, ChevronRight, Users } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { modulesAccessibles, MODULE_DEPENSE, ROLES_ACCES_TOTAL } from "../lib/modules";
import { budgetSecteurMois, depensesSecteurMois, totalMontant, fmtCompact } from "../lib/logic";
import GlassCard from "../components/ui/GlassCard";
import NotificationBell from "../components/layout/NotificationBell";

const now = { annee: 2026, mois: 6 };

export default function Portal() {
  const { user, logout } = useAuthStore();
  const { depenses, budgets, secteurs } = useDataStore();
  const navigate = useNavigate();

  const accessibles = useMemo(() => modulesAccessibles(user, secteurs), [user, secteurs]);
  const peutGererUtilisateurs = ROLES_ACCES_TOTAL.includes(user?.role);
  const heure = new Date().getHours();
  const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
  const dateBrute = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dateDuJour = dateBrute.charAt(0).toUpperCase() + dateBrute.slice(1);

  function kpiPourModule(m) {
    if (m.id === MODULE_DEPENSE.id) {
      const total = totalMontant(
        depenses.filter((d) => (d.date || "").startsWith(`${now.annee}-${String(now.mois + 1).padStart(2, "0")}`))
      );
      return `${fmtCompact(total)} FCFA ce mois`;
    }
    const budget = budgetSecteurMois(budgets, m.secteurId, now.annee, now.mois);
    const depense = totalMontant(depensesSecteurMois(depenses, m.secteurId, now.annee, now.mois));
    return budget ? `${Math.round((depense / budget) * 100)}% du budget` : `${fmtCompact(depense)} FCFA ce mois`;
  }

  return (
    <div className="min-h-screen relative">
      <div className="mesh-bg">
        <div className="blob" />
      </div>

      <div className="sticky top-0 z-30 px-3 sm:px-6 pt-3 sm:pt-4">
        <nav className="max-w-5xl mx-auto glass-strong rounded-[22px] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo_termitiere.png" alt="Logo E-DÉPENSES" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-contain glass shrink-0 p-1" />
            <div className="min-w-0 leading-none">
              <p className="font-bold tracking-tight text-[#7A1128] text-[14.5px] sm:text-[16px]">LA TERMITIÈRE</p>
              <p className="text-[10.5px] sm:text-[11.5px] text-ink-soft font-semibold mt-1">Accueil</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {peutGererUtilisateurs && (
              <button
                onClick={() => navigate("/utilisateurs")}
                className="glass rounded-2xl px-3 sm:px-4 py-2 flex items-center gap-2 text-[13px] font-semibold text-ink hover:bg-[#7A1128]/10 hover:text-[#7A1128] transition-colors"
              >
                <Users size={15} strokeWidth={2.2} /> <span className="hidden sm:inline">Utilisateurs</span>
              </button>
            )}
            <NotificationBell />
            <span className="hidden sm:inline text-[13px] font-semibold text-ink ml-1">{user?.nom}</span>
            <button
              onClick={logout}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl glass flex items-center justify-center text-ink-soft hover:bg-[#7A1128]/10 hover:text-[#7A1128] transition-colors shrink-0"
              title="Se déconnecter"
            >
              <LogOut size={16} strokeWidth={2.2} />
            </button>
          </div>
        </nav>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[28px] p-6 sm:p-8 mb-8"
          style={{ background: "linear-gradient(120deg, #9c3a3a 0%, #7A1128 55%, #4d0d18 100%)" }}
        >
          <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-black/15 blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />

          <div className="relative flex items-center gap-5">
            <div className="logo-ring-blink-white w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center shrink-0 border-4">
              <img src="/logo_termitiere.png" alt="Logo LA TERMITIÈRE" className="w-[70%] h-[70%] object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-[12px] font-bold text-white/70 uppercase tracking-widest mb-1">
                {dateDuJour}
              </p>
              <h1 className="text-[24px] sm:text-[32px] font-bold tracking-tight text-white leading-none">
                {salutation}, {user?.nom} 👋
              </h1>
              <p className="flex items-center gap-2 text-[12.5px] sm:text-[13.5px] text-white/75 font-medium mt-3">
                <span className="px-2 py-[3px] rounded-full bg-white/15 text-white text-[10.5px] font-bold tracking-wide">Info</span>
                Sélectionnez un module pour continuer
              </p>
            </div>
          </div>
        </motion.div>

        {accessibles.length === 0 ? (
          <GlassCard className="p-10 text-center" hover={false}>
            <p className="text-ink-soft">Aucun module ne vous a encore été attribué. Contactez un administrateur.</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {accessibles.map((m, i) => (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ y: -4 }}
                onClick={() => navigate(m.path)}
                className="glass rounded-[28px] p-6 text-left flex flex-col gap-4 group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden" style={{ background: `${m.color}1f` }}>
                    {m.id === MODULE_DEPENSE.id ? (
                      <img src="/logo_termitiere.png" alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <m.icon size={22} strokeWidth={2.2} style={{ color: m.color }} />
                    )}
                  </div>
                  <ChevronRight size={18} className="text-ink-soft group-hover:translate-x-1 group-hover:text-ink transition-all" />
                </div>
                <div>
                  <p className="font-bold tracking-tight text-ink">{m.nom}</p>
                  <p className="text-[12.5px] text-ink-soft font-medium mt-0.5">{m.description}</p>
                </div>
                <p className="text-[12px] font-semibold" style={{ color: m.color }}>
                  {kpiPourModule(m)}
                </p>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
