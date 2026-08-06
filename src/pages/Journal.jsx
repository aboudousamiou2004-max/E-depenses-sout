import { motion } from "framer-motion";
import { ScrollText, User } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import Badge from "../components/ui/Badge";
import { useDataStore } from "../store/dataStore";

const ACTION_TONE = {
  "Saisie dépense": "accent",
  "Saisie recette": "mint",
  "Approbation dépense": "mint",
  "Refus dépense": "coral",
  Décaissement: "grape",
  "Définition budget": "amber",
  "Consultation tableau de bord": "ink",
};

export default function Journal() {
  const { journal } = useDataStore();

  return (
    <div>
      <TopBar title="Journal" subtitle="Historique des opérations — traçabilité complète (écriture seule)" />

      <GlassCard className="p-6" hover={false}>
        <h3 className="font-bold tracking-tight text-ink mb-4 flex items-center gap-2">
          <ScrollText size={18} className="text-[#5E5CE6]" /> Activité récente
        </h3>
        <div className="relative flex flex-col">
          {journal.map((j, i) => (
            <motion.div
              key={j.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.03 }}
              className="flex gap-4 pb-6 last:pb-0 relative"
            >
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
                  <User size={15} className="text-ink-soft" strokeWidth={2.2} />
                </div>
                {i < journal.length - 1 && <div className="w-px flex-1 bg-black/10 mt-1" />}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13.5px] font-bold text-ink">{j.userNom}</p>
                  <Badge tone={ACTION_TONE[j.action] || "ink"}>{j.action}</Badge>
                  <span className="text-[11.5px] text-ink-soft ml-auto">
                    {new Date(j.timestamp).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-[13px] text-ink-soft mt-1">{j.details}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
