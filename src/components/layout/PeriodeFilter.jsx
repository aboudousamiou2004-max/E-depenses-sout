import { useUIStore } from "../../store/uiStore";

const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

// Sélecteur de période partagé par le tableau de bord général et les
// tableaux de bord sectoriels — bascule tous les KPI/graphiques qui en
// dépendent entre une vue "mois entier" (comportement historique) et une
// vue "un seul jour".
//
// Options pour les pages qui en ont besoin (ex. Caisse), absentes par défaut :
// - `extras` : boutons supplémentaires après « Jour », ex. « Plage », « Tous » ({ id, label, onClick }) ;
// - `extraActif` : id du bouton supplémentaire actif (Mois/Jour sont alors désactivés et les sélecteurs masqués) ;
// - `onQuitterExtra` : appelé quand on reclique sur Mois ou Jour pour sortir d'un bouton supplémentaire.
export default function PeriodeFilter({ extras = [], extraActif = null, onQuitterExtra }) {
  const { periode, setPeriode } = useUIStore();
  const modeJour = !!periode.jour && !extraActif;

  // Hors bouton supplémentaire, Mois et Jour se comportent comme avant (ils basculent l'un vers l'autre).
  function toggleMode() {
    setPeriode({ jour: modeJour ? null : new Date(periode.annee, periode.mois, 1).getDate() });
  }
  function choisirMois() {
    if (!extraActif) return toggleMode();
    onQuitterExtra?.();
    setPeriode({ jour: null });
  }
  function choisirJour() {
    if (!extraActif) return toggleMode();
    onQuitterExtra?.();
    setPeriode({ jour: new Date(periode.annee, periode.mois, 1).getDate() });
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
        onClick={choisirMois}
        className={`px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${!modeJour && !extraActif ? "bg-white/80 text-ink shadow-sm" : "text-ink-soft"}`}
      >
        Mois
      </button>
      <button
        onClick={choisirJour}
        className={`px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${modeJour ? "bg-white/80 text-ink shadow-sm" : "text-ink-soft"}`}
      >
        Jour
      </button>
      {extras.map((e) => (
        <button
          key={e.id}
          onClick={e.onClick}
          className={`px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${extraActif === e.id ? "bg-white/80 text-ink shadow-sm" : "text-ink-soft"}`}
        >
          {e.label}
        </button>
      ))}
      {!extraActif && <div className="w-px h-5 bg-black/10 mx-0.5" />}
      {extraActif ? null : modeJour ? (
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
