import { Search } from "lucide-react";
import { useDataStore } from "../../store/dataStore";
import { useUIStore } from "../../store/uiStore";
import NotificationBell from "./NotificationBell";
import PeriodeFilter from "./PeriodeFilter";

// `recherche` (identifiant, catégorie, description…) n'est réellement
// consommée que par les pages qui listent des dépenses/recettes
// (Depenses.jsx, Recettes.jsx) — ailleurs le champ reste présent pour la
// cohérence visuelle du bandeau mais n'a simplement rien à filtrer.
export default function TopBar({ title, subtitle }) {
  const { secteurs } = useDataStore();
  const { secteurFiltre, setSecteurFiltre, recherche, setRecherche } = useUIStore();

  return (
    <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <div className="flex items-center justify-between w-full sm:w-auto gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="text-[13.5px] text-ink-soft font-medium mt-0.5">{subtitle}</p>}
        </div>
        <div className="sm:hidden shrink-0">
          <NotificationBell />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
        <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2 w-full sm:w-56">
          <Search size={16} className="text-ink-soft shrink-0" strokeWidth={2.2} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Catégorie, motif, origine…"
            className="bg-transparent outline-none text-sm text-ink placeholder:text-ink-soft/70 w-full"
          />
        </div>

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

        <div className="hidden sm:block">
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}
