import { useUIStore } from "../../store/uiStore";

const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

// Sélecteur de période partagé par le tableau de bord général et les
// tableaux de bord sectoriels — bascule tous les KPI/graphiques qui en
// dépendent entre une vue "mois entier" (comportement historique) et une
// vue "un seul jour".
export default function PeriodeFilter() {
  const { periode, setPeriode } = useUIStore();
  const modeJour = !!periode.jour;

  function toggleMode() {
    setPeriode({ jour: modeJour ? null : new Date(periode.annee, periode.mois, 1).getDate() });
  }

  function onMoisChange(e) {
    const mois = Number(e.target.value);
    setPeriode({ mois });
  }

  function onAnneeChange(e) {
    setPeriode({ annee: Number(e.target.value) });
  }

  function onJourChange(e) {
    const [annee, mois1, jour] = e.target.value.split("-").map(Number);
    setPeriode({ annee, mois: mois1 - 1, jour });
  }

  const dateValue = `${periode.annee}-${String(periode.mois + 1).padStart(2, "0")}-${String(periode.jour || 1).padStart(2, "0")}`;
  const annees = [periode.annee - 1, periode.annee, periode.annee + 1];

  return (
    <div className="glass rounded-2xl p-1 flex items-center gap-1 flex-wrap max-w-full">
      <button
        onClick={toggleMode}
        className={`px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${!modeJour ? "bg-white/80 text-ink shadow-sm" : "text-ink-soft"}`}
      >
        Mois
      </button>
      <button
        onClick={toggleMode}
        className={`px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${modeJour ? "bg-white/80 text-ink shadow-sm" : "text-ink-soft"}`}
      >
        Jour
      </button>
      <div className="w-px h-5 bg-black/10 mx-0.5" />
      {modeJour ? (
        <input
          type="date"
          value={dateValue}
          onChange={onJourChange}
          className="bg-transparent outline-none text-[12.5px] font-semibold text-ink px-1.5 cursor-pointer"
        />
      ) : (
        <>
          <select value={periode.mois} onChange={onMoisChange} className="bg-transparent outline-none text-[12.5px] font-semibold text-ink cursor-pointer">
            {MOIS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select value={periode.annee} onChange={onAnneeChange} className="bg-transparent outline-none text-[12.5px] font-semibold text-ink cursor-pointer">
            {annees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
