import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ShieldCheck, Banknote } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import { fmtFCFA, statutLabel } from "../lib/logic";

export default function Autorisations() {
  const { secteurs, depenses, changerStatutDepense } = useDataStore();
  const { user } = useAuthStore();

  const enAttente = useMemo(() => depenses.filter((d) => d.statut === "en_attente"), [depenses]);
  const approuvees = useMemo(() => depenses.filter((d) => d.statut === "approuvee"), [depenses]);
  const historique = useMemo(() => depenses.filter((d) => ["decaissee", "refusee"].includes(d.statut)).slice(0, 20), [depenses]);

  function secteurOf(id) {
    return secteurs.find((s) => s.id === id);
  }

  async function changerStatut(id, statut) {
    const res = await changerStatutDepense(id, statut, user);
    if (!res.ok) alert(res.error);
  }

  return (
    <div>
      <TopBar title="Autorisations" subtitle="Circuit de validation des dépenses — dès dépassement du budget alloué (PAU ou GE)" icon={ShieldCheck} accent="#FF9F0A" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-5">
        <GlassCard className="p-5">
          <p className="text-[12.5px] font-semibold text-ink-soft">En attente d'approbation</p>
          <p className="text-3xl font-bold tracking-tight tabular text-[#9a5f00] mt-1.5">{enAttente.length}</p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-[12.5px] font-semibold text-ink-soft">Approuvées — à décaisser</p>
          <p className="text-3xl font-bold tracking-tight tabular text-[#0a5cb3] mt-1.5">{approuvees.length}</p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-[12.5px] font-semibold text-ink-soft">Traitées récemment</p>
          <p className="text-3xl font-bold tracking-tight tabular text-[#1a7d34] mt-1.5">{historique.length}</p>
        </GlassCard>
      </div>

      <GlassCard className="p-6 mb-5" hover={false}>
        <h3 className="font-bold tracking-tight text-ink mb-4 flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#FF9F0A]" /> En attente d'approbation
        </h3>
        <div className="flex flex-col gap-2.5">
          <AnimatePresence>
            {enAttente.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucune dépense en attente.</p>}
            {enAttente.map((d) => {
              const s = secteurOf(d.secteurId);
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-2xl bg-white/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s?.color }} />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{d.categorie} — {s?.nom}</p>
                      <p className="text-[11.5px] text-ink-soft truncate">{d.beneficiaireNom} · {new Date(d.date).toLocaleDateString("fr-FR")}</p>
                      <p className="text-[11.5px] text-ink-soft italic truncate mt-0.5">Motif : {d.description?.trim() || "non renseigné"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold tabular text-ink">{fmtFCFA(d.montant)}</span>
                    <Button variant="success" className="!px-3 !py-2" onClick={() => changerStatut(d.id, "approuvee")}>
                      <Check size={15} strokeWidth={2.6} />
                    </Button>
                    <Button variant="danger" className="!px-3 !py-2" onClick={() => changerStatut(d.id, "refusee")}>
                      <X size={15} strokeWidth={2.6} />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </GlassCard>

      <GlassCard className="p-6 mb-5" hover={false}>
        <h3 className="font-bold tracking-tight text-ink mb-4 flex items-center gap-2">
          <Banknote size={18} className="text-[#0A84FF]" /> Approuvées — décaissement
        </h3>
        <div className="flex flex-col gap-2.5">
          {approuvees.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucune dépense approuvée en attente de décaissement.</p>}
          {approuvees.map((d) => {
            const s = secteurOf(d.secteurId);
            return (
              <div key={d.id} className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-2xl bg-white/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s?.color }} />
                  <p className="text-[13.5px] font-semibold text-ink truncate">{d.categorie} — {s?.nom}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold tabular text-ink">{fmtFCFA(d.montant)}</span>
                  <Button variant="primary" className="!px-3 !py-2 text-xs" onClick={() => changerStatut(d.id, "decaissee")}>
                    Décaisser
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="p-6" hover={false}>
        <h3 className="font-bold tracking-tight text-ink mb-4">Historique récent</h3>
        <div className="flex flex-col gap-2">
          {historique.map((d) => {
            const s = secteurOf(d.secteurId);
            const st = statutLabel(d.statut);
            return (
              <div key={d.id} className="flex items-center justify-between text-[13px] px-3 py-2 rounded-xl hover:bg-white/40">
                <span className="text-ink-soft">{s?.nom} · {d.categorie}</span>
                <div className="flex items-center gap-3">
                  <span className="tabular font-semibold text-ink">{fmtFCFA(d.montant)}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
