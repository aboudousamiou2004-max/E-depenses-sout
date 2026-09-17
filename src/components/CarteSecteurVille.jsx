import { motion } from "framer-motion";
import { ChevronRight, Ticket, CalendarCheck, Receipt, Users, Wallet as WalletIcon } from "lucide-react";
import { decoupeNomVille } from "../lib/modules";
import { totalMontant, fmtCompact } from "../lib/logic";

const now = { annee: 2026, mois: 6 };

// Couleur de fond de page (voir .mesh-bg dans index.css) — reprise ici pour
// les deux « perforations » de la carte, afin qu'elles se fondent dans le
// fond plutôt que de trancher dessus.
const FOND_PAGE = "#eef1f7";

function statsSecteurVille(m, recettes) {
  const secteur = recettes.filter((r) => r.secteurId === m.secteurId);
  const mois = secteur.filter((r) => (r.date || "").startsWith(`${now.annee}-${String(now.mois + 1).padStart(2, "0")}`));
  const clients = new Set(secteur.filter((r) => r.client).map((r) => r.client)).size;
  if (m.forfaits) {
    return [
      { label: "Séances/mois", value: mois.filter((r) => r.origine?.startsWith("Séance")).length, icon: Ticket },
      { label: "Abo./mois", value: mois.filter((r) => r.origine?.startsWith("Abonnement")).length, icon: CalendarCheck },
      { label: "Clients", value: clients, icon: Users },
    ];
  }
  return [
    { label: "Prestations/mois", value: mois.length, icon: Receipt },
    { label: "CA/mois", value: fmtCompact(totalMontant(mois)), icon: WalletIcon },
    { label: "Clients", value: clients, icon: Users },
  ];
}

// Carte « lieu » — un secteur précis d'un module décliné par ville (ex.
// « MAXI GYM KARA »). Pensée comme une carte d'embarquement : un talon
// coloré (ville) détaché du corps de la carte par une ligne perforée, à la
// demande explicite de l'utilisateur (2026-09-15) de ne pas reproduire un
// « effet habituel » de carte en dégradé plein. Affichée uniquement sur
// l'écran de choix du lieu (voir src/pages/ChoixSecteurVille.jsx) — le
// Portail, lui, ne montre qu'une carte par module.
export default function CarteSecteurVille({ m, i, recettes, onClick }) {
  const { base, ville } = decoupeNomVille(m.nom);
  const baseStylise = base.split(" ").join("-");
  const stats = statsSecteurVille(m, recettes);

  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05, duration: 0.4 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="relative flex items-stretch text-left group rounded-[18px] sm:rounded-[22px] overflow-hidden bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] border border-black/[0.06]"
    >
      {/* Talon — couleur du secteur, ville affichée en grand */}
      <div
        className="w-[64px] sm:w-[84px] shrink-0 flex flex-col items-center justify-center gap-2 py-4 px-1.5"
        style={{ background: m.color }}
      >
        <m.icon size={18} strokeWidth={2.2} className="text-white/90 shrink-0" />
        <p className="text-white font-bold text-[12px] sm:text-[14px] leading-tight text-center break-words">
          {ville || m.nom}
        </p>
      </div>

      {/* Ligne perforée façon billet — deux demi-cercles qui « mordent »
          le bord de la carte, dans la couleur de fond de la page. */}
      <div className="relative w-0 shrink-0">
        <div className="absolute inset-y-3 border-l-2 border-dashed" style={{ borderColor: "rgba(15,23,42,0.12)" }} />
        <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full" style={{ background: FOND_PAGE }} />
        <div className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full" style={{ background: FOND_PAGE }} />
      </div>

      {/* Corps de la carte */}
      <div className="flex-1 min-w-0 p-3.5 sm:p-5 flex flex-col gap-2 sm:gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold tracking-tight text-ink-soft text-[10.5px] sm:text-[11.5px] uppercase truncate">{baseStylise}</p>
            <p className="text-[11px] sm:text-[12px] text-ink-soft/80 font-medium leading-snug mt-0.5 line-clamp-2">{m.description}</p>
          </div>
          <ChevronRight size={16} className="shrink-0 mt-0.5 text-ink-soft/50 group-hover:translate-x-1 group-hover:text-ink-soft transition-all" />
        </div>

        <div className="flex items-center gap-3.5 sm:gap-4 flex-wrap">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <s.icon size={13} strokeWidth={2.2} style={{ color: m.color }} />
              <span className="font-bold text-ink text-[13px] sm:text-[14px] tabular">{s.value}</span>
              <span className="text-ink-soft/70 text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>

        <p className="mt-auto pt-1 flex items-center gap-1 text-[11.5px] sm:text-[12.5px] font-bold" style={{ color: m.color }}>
          Entrer <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
        </p>
      </div>
    </motion.button>
  );
}
