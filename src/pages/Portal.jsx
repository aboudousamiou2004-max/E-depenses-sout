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

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center shrink-0">
              <img src="/logo_termitiere.png" alt="Logo E-DÉPENSES" className="w-12 h-12 rounded-2xl object-contain glass" />
              <span className="text-[9px] font-bold text-ink-soft tracking-wide mt-1">E-DÉPENSES</span>
            </div>
            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-ink">LA TERMITIÈRE</h1>
              <p className="text-[13.5px] text-ink-soft font-medium mt-0.5">
                Bonjour {user?.nom} — choisissez un module
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {peutGererUtilisateurs && (
              <button
                onClick={() => navigate("/utilisateurs")}
                className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink hover:bg-white/70 transition-colors"
              >
                <Users size={15} strokeWidth={2.2} /> Utilisateurs
              </button>
            )}
            <button
              onClick={logout}
              className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink hover:bg-white/70 transition-colors"
            >
              <LogOut size={15} strokeWidth={2.2} /> Se déconnecter
            </button>
          </div>
        </div>

        {accessibles.length === 0 ? (
          <GlassCard className="p-10 text-center" hover={false}>
            <p className="text-ink-soft">Aucun module ne vous a encore été attribué. Contactez un administrateur.</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-3 gap-5">
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
