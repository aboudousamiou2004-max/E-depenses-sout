// Données de référence pour les stocks — reprises du vrai module (catégories,
// articles, types de briques, matières premières) — src/modules/logistique/data.js
// et src/modules/evenementiel/data.js de la plateforme LA TERMITIÈRE.

export const CAT_MATERIEL = ["TENTES & STRUCTURES", "TABLES", "CHAISES", "SONORISATION", "ÉCLAIRAGE", "DÉCORATION", "VAISSELLE & SERVICE", "AUTRES"];

export const MATERIEL_DEFAUT = [
  { id: "tente_10x10", nom: "Tente 10x10", cat: "TENTES & STRUCTURES", unite: "unités", coutAchat: 85000 },
  { id: "table_ronde", nom: "Table ronde", cat: "TABLES", unite: "unités", coutAchat: 10000 },
  { id: "chaise_pliante", nom: "Chaise pliante", cat: "CHAISES", unite: "unités", coutAchat: 3000 },
  { id: "sono_pack", nom: "Pack sonorisation", cat: "SONORISATION", unite: "unités", coutAchat: 55000 },
  { id: "projecteur", nom: "Projecteur LED", cat: "ÉCLAIRAGE", unite: "unités", coutAchat: 8000 },
  { id: "nappe", nom: "Nappe de table", cat: "DÉCORATION", unite: "unités", coutAchat: 1800 },
  { id: "assiette", nom: "Assiette (lot de 10)", cat: "VAISSELLE & SERVICE", unite: "lots", coutAchat: 3500 },
];

export const TYPES_MOUVEMENT_MATERIEL = {
  achat: { label: "Achat", signe: 1 },
  sortie: { label: "Sortie", signe: -1 },
  retour_ok: { label: "Retour — bon état", signe: 1 },
  retour_casse: { label: "Retour — cassé", signe: 0 },
  retour_perdu: { label: "Retour — perdu", signe: 0 },
};

export const BRIQUES_DEFAUT = [
  { id: "b12_creux", nom: "Brique 12 creux", tarifVente: 150 },
  { id: "b15_creux", nom: "Brique 15 creux", tarifVente: 175 },
  { id: "b20_creux", nom: "Brique 20 creux", tarifVente: 225 },
  { id: "b12_plein", nom: "Brique 12 pleine", tarifVente: 200 },
];

export const ETATS_BRIQUE = [
  { id: "appatam", label: "Appâtam (venant de production)", color: "#8E8E93" },
  { id: "sechage", label: "En séchage", color: "#FF9F0A" },
  { id: "pret", label: "Prêt à la vente", color: "#30D158" },
  { id: "caillasses", label: "Caillasses (cassées)", color: "#FF453A" },
];
export const DUREE_SECHAGE_JOURS = 5;

export const MATIERES_PREMIERES = [
  { id: "ciment", nom: "Ciment", unite: "sacs" },
  { id: "concasse", nom: "Concassé", unite: "m³" },
  { id: "sable", nom: "Sable", unite: "m³" },
];

// MAXI AGRO — cheptel, repris de src/modules/agro/data.js (catégories OVINS,
// BOVINS, CAPRINS, POULETS, PINTADES) simplifié : un effectif par espèce plutôt
// que la distinction adultes/jeunes du vrai module.
export const CAT_ANIMAUX = ["OVINS", "BOVINS", "CAPRINS", "POULETS", "PINTADES"];

export const ESPECES_DEFAUT = [
  { id: "ovins", nom: "Ovins (moutons)", cat: "OVINS" },
  { id: "bovins", nom: "Bovins (bœufs, vaches)", cat: "BOVINS" },
  { id: "caprins", nom: "Caprins (chèvres)", cat: "CAPRINS" },
  { id: "poulets", nom: "Poulets", cat: "POULETS" },
  { id: "pintades", nom: "Pintades", cat: "PINTADES" },
];

export const TYPES_MOUVEMENT_ANIMAL = {
  achat: { label: "Achat", signe: 1 },
  naissance: { label: "Naissance", signe: 1 },
  vente: { label: "Vente", signe: -1 },
  deces: { label: "Décès", signe: -1 },
  perte: { label: "Perte / vol", signe: -1 },
};
