import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { ScrollText, User, Search } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import Badge from "../../components/ui/Badge";
import { TextInput } from "../../components/ui/Field";
import { useDataStore } from "../../store/dataStore";

const ACTION_TONE = {
  "Saisie dépense": "accent", "Saisie recette": "mint", "Approbation dépense": "mint",
  "Refus dépense": "coral", Décaissement: "grape", "Budget alloué": "amber", "Budget révisé": "amber",
};

// Journal — audit trail par module, porté (simplifié) depuis
// pages/Journal.jsx (vue globale) filtré par secteur (colonne
// journal.secteur_id, cf. migration_journal_historique.sql). Réservé aux
// directeurs et à l'administration — même accès que le journal global (RLS
// `journal lisible par les rôles à accès total`), à la demande de
// l'utilisateur (2026-08-18).
export default function BusinessJournal() {
  const config = useOutletContext();
  const { journal, chargerJournal } = useDataStore();

  useEffect(() => { chargerJournal(); }, [chargerJournal]);

  const [recherche, setRecherche] = useState("");
  const duSecteur = useMemo(() => journal.filter((j) => j.secteurId === config.secteurId), [journal, config.secteurId]);
  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return duSecteur.filter((j) => !q || (j.details || "").toLowerCase().includes(q) || (j.action || "").toLowerCase().includes(q) || (j.userNom || "").toLowerCase().includes(q));
  }, [duSecteur, recherche]);

  return (
    <div>
      <TopBarSimple title="Journal" subtitle={`${config.nom} — traçabilité complète des opérations (réservé à l'administration)`} icon={ScrollText} accent={config.color} />

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/50" />
        <TextInput className="pl-8" placeholder="Rechercher une action, une personne…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      </div>

      <GlassCard className="p-6" hover={false}>
        {lignes.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-ink-soft italic">Aucune activité{recherche ? " correspondante" : ""} pour ce module.</p>
        ) : (
          <div className="relative flex flex-col">
            {lignes.map((j, i) => (
              <motion.div key={j.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="flex gap-4 pb-6 last:pb-0 relative">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
                    <User size={15} className="text-ink-soft" strokeWidth={2.2} />
                  </div>
                  {i < lignes.length - 1 && <div className="w-px flex-1 bg-black/10 mt-1" />}
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
        )}
      </GlassCard>
    </div>
  );
}
