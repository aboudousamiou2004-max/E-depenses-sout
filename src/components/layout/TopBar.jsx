import { Search } from "lucide-react";
import { useDataStore } from "../../store/dataStore";
import { useUIStore } from "../../store/uiStore";
import NotificationBell from "./NotificationBell";
import PeriodeFilter from "./PeriodeFilter";

// Assombrit une couleur hex d'un facteur (0-1) — pour le second point du
// dégradé du bandeau (même formule que TopBarSimple.jsx).
function darkenHex(hex, factor) {
  const h = (hex || "0A84FF").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16) || 0;
  const clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
  const r = clamp(((num >> 16) & 255) * factor);
  const g = clamp(((num >> 8) & 255) * factor);
  const b = clamp((num & 255) * factor);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

// `recherche` (identifiant, catégorie, description…) n'est réellement
// consommée que par les pages qui listent des dépenses/recettes
// (Depenses.jsx, Recettes.jsx) — ailleurs le champ reste présent pour la
// cohérence visuelle du bandeau mais n'a simplement rien à filtrer.
//
// Bandeau en dégradé (icône + titre + description) repris du bandeau MAXI
// AGRO/Cheptel, généralisé à toute l'application — à la demande de
// l'utilisateur (2026-08-18). Les contrôles (recherche, période, secteur,
// notifications) restent sur leur propre rangée en dessous.
export default function TopBar({ title, subtitle, icon: Icon, accent = "#0A84FF" }) {
  const { secteurs } = useDataStore();
  const { secteurFiltre, setSecteurFiltre, recherche, setRecherche } = useUIStore();
  const gradient = `linear-gradient(135deg, ${accent}d9 0%, ${darkenHex(accent, 0.58)}cc 100%)`;

  return (
    <div className="mb-5">
      <div
        className="relative flex items-center gap-4 overflow-hidden rounded-3xl p-4 text-white shadow-[0_14px_24px_-12px_rgba(0,0,0,0.45)]"
        style={{ background: gradient }}
      >
        {Icon && (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/90">
            <Icon size={26} color={accent} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-extrabold drop-shadow truncate">{title}</h1>
          {subtitle && <p className="text-[13px] text-white/90 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-between mt-3">
        <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2 w-full sm:w-56">
          <Search size={16} className="text-ink-soft shrink-0" strokeWidth={2.2} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Catégorie, motif, origine…"
            className="bg-transparent outline-none text-sm text-ink placeholder:text-ink-soft/70 w-full"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap flex-1 justify-end">
          <PeriodeFilter />
          <select
            value={secteurFiltre}
            onChange={(e) => setSecteurFiltre(e.target.value)}
            className="glass rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-ink outline-none cursor-pointer flex-1 sm:flex-none min-w-0"
          >
            <option value="tous">Tous les secteurs</option>
            {secteurs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}
