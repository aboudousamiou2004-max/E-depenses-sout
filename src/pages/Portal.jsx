import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, ChevronRight, Users } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { modulesAccessibles, MODULE_DEPENSE, ROLES_ACCES_TOTAL } from "../lib/modules";
import { budgetSecteurMois, depensesSecteurMois, totalMontant, fmtCompact } from "../lib/logic";
import GlassCard from "../components/ui/GlassCard";

const now = { annee: 2026, mois: 6 };

export default function Portal() {
  const { user, logout } = useAuthStore();
  const { depenses, budgets, secteurs } = useDataStore();
  const navigate = useNavigate();

  const accessibles = useMemo(() => modulesAccessibles(user, secteurs), [user, secteurs]);
  const peutGererUtilisateurs = ROLES_ACCES_TOTAL.includes(user?.role);
  const heure = new Date().getHours();
  const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
  const dateBrute = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="glass-hero rounded-[28px] p-4 sm:p-6 mb-8"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl glass flex items-center justify-center shadow-lg overflow-hidden shrink-0">
              <img src="/logo_termitiere.png" alt="Logo LA TERMITIÈRE" className="w-full h-full object-contain p-1.5" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {peutGererUtilisateurs && (
                <button
                  onClick={() => navigate("/utilisateurs")}
                  className="glass rounded-2xl px-3 sm:px-4 py-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink hover:bg-[#0A84FF]/15 hover:text-[#0A84FF] transition-colors"
                >
                  <Users size={15} strokeWidth={2.2} /> <span className="hidden sm:inline">Utilisateurs</span>
                </button>
              )}
              <button
                onClick={logout}
                className="glass rounded-2xl px-3 sm:px-4 py-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink hover:bg-[#FF453A]/15 hover:text-[#FF453A] transition-colors"
              >
                <LogOut size={15} strokeWidth={2.2} /> <span className="hidden sm:inline">Se déconnecter</span>
              </button>
            </div>
          </div>
          <div className="mt-4 sm:mt-5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] shadow-[0_0_8px_#0A84FF]" />
              <p className="text-[10.5px] sm:text-[11px] font-bold text-[#0A84FF] uppercase tracking-wider">
                {salutation}, {user?.nom}
              </p>
              <span className="glass px-1.5 py-[2px] rounded-full text-[#0A84FF] text-[9px] sm:text-[9.5px] font-bold tracking-wide ml-1">
                E-DÉPENSES
              </span>
            </div>
            <h1 className="text-[26px] sm:text-[32px] font-bold tracking-tight leading-none bg-gradient-to-r from-ink to-ink/60 bg-clip-text text-transparent">
              LA TERMITIÈRE
            </h1>
            <p className="text-[12px] sm:text-[13.5px] text-ink-soft font-medium mt-2">
              {dateDuJour} — choisissez un module pour continuer
            </p>
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
