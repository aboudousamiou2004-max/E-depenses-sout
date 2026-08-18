// Constantes d'affichage pour les stocks (catégories, libellés et couleurs des
// types de mouvement) — reprises du vrai module (src/modules/logistique/data.js
// et src/modules/evenementiel/data.js de la plateforme LA TERMITIÈRE).
// Les référentiels d'articles/matières/types eux-mêmes (autrefois des tableaux
// JS ici) vivent désormais en base (voir supabase/schema.sql) — ce fichier ne
// garde que ce qui reste utile côté client : les libellés des formulaires.

export const CAT_MATERIEL = ["TENTES & STRUCTURES", "TABLES", "CHAISES", "SONORISATION", "ÉCLAIRAGE", "DÉCORATION", "VAISSELLE & SERVICE", "AUTRES"];

export const TYPES_MOUVEMENT_MATERIEL = {
  achat: { label: "Achat", signe: 1 },
  sortie: { label: "Sortie", signe: -1 },
  retour_ok: { label: "Retour — bon état", signe: 1 },
  retour_casse: { label: "Retour — cassé", signe: 0 },
  retour_perdu: { label: "Retour — perdu", signe: 0 },
};

export const ETATS_BRIQUE = [
  { id: "appatam", label: "Appâtam (venant de production)", color: "#8E8E93" },
  { id: "sechage", label: "En séchage", color: "#FF9F0A" },
  { id: "pret", label: "Prêt à la vente", color: "#30D158" },
  { id: "caillasses", label: "Caillasses (cassées)", color: "#FF453A" },
];

// MAXI AGRO — cheptel, repris de src/modules/agro/data.js (7 catégories :
// OVINS, BOVINS, CAPRINS, CANARDS, DINDONS, PINTADES, POULETS), avec détail
// par espèce (sexe/âge) comme sur la plateforme — voir
// supabase/migration_especes_detaillees_agro.sql.
export const CAT_ANIMAUX = ["OVINS", "BOVINS", "CAPRINS", "CANARDS", "DINDONS", "PINTADES", "POULETS"];

export const TYPES_MOUVEMENT_ANIMAL = {
  achat: { label: "Achat", signe: 1 },
  naissance: { label: "Naissance", signe: 1 },
  vente: { label: "Vente", signe: -1 },
  deces: { label: "Décès", signe: -1 },
  perte: { label: "Perte / vol", signe: -1 },
};

// Magasin MAXI AGRO — matériel/machines (parc propre à l'exploitation,
// distinct du parc locatif de MAXI LOGISTIQUE) et aliments/silo (repris des
// catégories ALIMENTS/DIVERS de termitiere-platform/src/modules/agro/data.js).
export const CAT_MATERIEL_AGRO = ["MACHINES & MOTEURS", "OUTILLAGE", "ABRIS & CLÔTURES", "TRANSPORT", "AUTRES"];
export const CAT_ALIMENTS = ["ALIMENTS", "DIVERS"];
export const TYPES_MOUVEMENT_MAGASIN = {
  achat: { label: "Achat", signe: 1 },
  sortie: { label: "Sortie / consommation", signe: -1 },
};

// Matériel E-BRIQUETERIE — équipement de l'exploitation pouvant sortir en
// location (presse à briques, brouettes, bétonnière, véhicule de livraison…).
export const CAT_MATERIEL_BRIQUETERIE = ["MACHINES DE PRODUCTION", "OUTILLAGE", "TRANSPORT", "AUTRES"];
