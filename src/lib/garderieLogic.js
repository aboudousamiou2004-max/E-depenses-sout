// Logique E-GARDERIE partagée entre Enfants.jsx, Paiements.jsx et
// InscriptionEnfantModal.jsx — reprise de termitiere-platform/src/modules/
// garderie/logic.js (âge, tarif suggéré, date de fin du court séjour).

export const GRILLE_TARIFAIRE = [
  { label: "6 mois – 1 an", minMois: 6, maxMois: 12, tarif: 35000 },
  { label: "1 an – 3 ans", minMois: 12, maxMois: 36, tarif: 45000 },
  { label: "3 ans – 5 ans", minMois: 36, maxMois: 60, tarif: 65000 },
];

export function ageEnMois(dateNaissance) {
  if (!dateNaissance) return null;
  const n = new Date(dateNaissance), now = new Date();
  return (now.getFullYear() - n.getFullYear()) * 12 + (now.getMonth() - n.getMonth());
}
export function tarifSuggere(dateNaissance) {
  const m = ageEnMois(dateNaissance);
  if (m == null) return null;
  return GRILLE_TARIFAIRE.find((t) => m >= t.minMois && m < t.maxMois)?.tarif ?? null;
}
export function ageLabel(dateNaissance) {
  const m = ageEnMois(dateNaissance);
  if (m == null) return "—";
  if (m < 12) return `${m} mois`;
  return `${Math.floor(m / 12)} an${Math.floor(m / 12) > 1 ? "s" : ""}`;
}

// Court séjour : date de fin dérivée (inscription + N semaines) — pas
// stockée, recalculée à l'affichage.
export function dateFinCourtSejour(dateInscription, dureeSemaines) {
  if (!dateInscription || !dureeSemaines) return null;
  const d = new Date(dateInscription);
  d.setDate(d.getDate() + dureeSemaines * 7);
  return d.toISOString().slice(0, 10);
}
export function joursRestants(dateFin) {
  if (!dateFin) return null;
  return Math.ceil((new Date(dateFin) - new Date(new Date().toISOString().slice(0, 10))) / 86400000);
}
