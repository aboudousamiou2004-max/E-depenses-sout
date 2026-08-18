import NotificationBell from "./NotificationBell";
import PeriodeFilter from "./PeriodeFilter";

// Assombrit une couleur hex d'un facteur (0-1) — pour le second point du
// dégradé du bandeau (repris de la formule du bandeau MAXI AGRO).
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

// Bandeau d'en-tête partagé par tous les volets secteur — icône du volet,
// nom du volet, description de ce qu'il contient, dégradé teinté à la
// couleur du secteur. Repris du bandeau MAXI AGRO/Cheptel et généralisé à
// toute l'application à la demande de l'utilisateur (2026-08-18).
export default function TopBarSimple({ title, subtitle, icon: Icon, accent = "#0A84FF", showPeriodeFilter = true }) {
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
      <div className="flex items-center justify-end gap-3 flex-wrap mt-3">
        {showPeriodeFilter && <PeriodeFilter />}
        <NotificationBell />
      </div>
    </div>
  );
}
