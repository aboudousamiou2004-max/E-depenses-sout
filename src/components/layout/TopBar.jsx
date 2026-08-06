import { Search } from "lucide-react";
import { useDataStore } from "../../store/dataStore";
import { useUIStore } from "../../store/uiStore";
import NotificationBell from "./NotificationBell";

export default function TopBar({ title, subtitle }) {
  const { secteurs } = useDataStore();
  const { secteurFiltre, setSecteurFiltre } = useUIStore();

  return (
    <div className="flex items-center justify-between mb-6 gap-4">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-[13.5px] text-ink-soft font-medium mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2 w-56">
          <Search size={16} className="text-ink-soft" strokeWidth={2.2} />
          <input
            placeholder="Rechercher…"
            className="bg-transparent outline-none text-sm text-ink placeholder:text-ink-soft/70 w-full"
          />
        </div>

        <select
          value={secteurFiltre}
          onChange={(e) => setSecteurFiltre(e.target.value)}
          className="glass rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-ink outline-none cursor-pointer"
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
  );
}
