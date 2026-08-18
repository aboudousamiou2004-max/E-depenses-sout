// Référentiel E-GARDERIE — repris de termitiere-platform/src/modules/
// garderie/data.js (GROUPES_AGE, PROGRAMMES_ENFANT, GROUPES_PAR_PROGRAMME,
// programmeDuGroupe) et logic.js (groupeRecommande).

export const GROUPES_AGE = [
  { id: "nourrisson", label: "Nourrisson", desc: "0 – 12 mois" },
  { id: "bambin", label: "Bambin", desc: "1 – 2 ans" },
  { id: "petite_section", label: "Petite section", desc: "3 ans" },
  { id: "moyenne_section", label: "Moyenne section", desc: "4 ans" },
  { id: "grande_section", label: "Grande section", desc: "5 – 6 ans" },
];

// Garderie (0-2 ans) et maternelle (3-6 ans) — deux programmes distincts,
// choisis explicitement à l'inscription en plus du groupe d'âge précis.
export const PROGRAMMES_ENFANT = [
  { id: "garderie", label: "Garderie", desc: "0 – 2 ans" },
  { id: "maternelle", label: "Maternelle", desc: "3 – 6 ans" },
];

export const GROUPES_PAR_PROGRAMME = {
  garderie: ["nourrisson", "bambin"],
  maternelle: ["petite_section", "moyenne_section", "grande_section"],
};

export const programmeDuGroupe = (groupeId) =>
  GROUPES_PAR_PROGRAMME.maternelle.includes(groupeId) ? "maternelle" : "garderie";

// Groupe d'âge suggéré à partir de la date de naissance.
export function groupeRecommande(dateNaissance) {
  if (!dateNaissance) return "";
  const naissance = new Date(dateNaissance);
  const now = new Date();
  const moisTotal = (now.getFullYear() - naissance.getFullYear()) * 12 + (now.getMonth() - naissance.getMonth());
  if (moisTotal < 12) return "nourrisson";
  if (moisTotal < 36) return "bambin";
  if (moisTotal < 48) return "petite_section";
  if (moisTotal < 60) return "moyenne_section";
  return "grande_section";
}
