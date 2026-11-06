// Filtre de dates du volet Caisse. Trois modes :
// - "jusqua" : depuis le début jusqu'à la fin de la période choisie dans le bandeau (mois ou jour) ;
// - "plage"  : entre deux dates choisies (début et/ou fin, bornes incluses) ;
// - "tout"   : tout l'historique.
// Les dates sont des chaînes "AAAA-MM-JJ", comparables telles quelles.

export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Dernier jour de la période du bandeau : le jour choisi, ou le dernier jour du mois.
export const finDePeriode = (p) => iso(p.jour ? new Date(p.annee, p.mois, p.jour) : new Date(p.annee, p.mois + 1, 0));
export const debutDePeriode = (p) => iso(new Date(p.annee, p.mois, p.jour || 1));

// Une date de début postérieure à la date de fin est simplement inversée.
export const bornesPlage = (du, au) => (du && au && du > au ? [au, du] : [du, au]);

export function dansFiltre(date, mode, lo, hi, finBandeau) {
  if (mode === "tout") return true;
  if (mode === "plage") return (!lo || date >= lo) && (!hi || date <= hi);
  return date <= finBandeau;
}

const dateFr = (d, options) => new Date(d).toLocaleDateString("fr-FR", options);

export function libelleFiltre(mode, lo, hi, finBandeau) {
  if (mode === "tout") return "Tout l'historique";
  if (mode === "plage") return `Du ${lo ? dateFr(lo) : "début"} au ${hi ? dateFr(hi) : "aujourd'hui"}`;
  return `Jusqu'au ${dateFr(finBandeau, { day: "numeric", month: "long", year: "numeric" })}`;
}
