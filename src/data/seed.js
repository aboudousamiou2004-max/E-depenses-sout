// Données de démonstration — cohérentes avec le mémoire "Implémentation d'un
// système de pilotage financier pour une entreprise multisectorielle utilisant
// des tableaux de bord décisionnels : Cas de LA TERMITIÈRE".

export const SECTEURS = [
  { id: "btp", nom: "MAXI BAT", label: "Bâtiment & Travaux Publics", color: "#0A84FF" },
  { id: "agro", nom: "MAXI AGRO", label: "Agro-élevage", color: "#30D158" },
  { id: "logistique", nom: "MAXI LOGISTIQUE", label: "Logistique & Transport", color: "#FF9F0A" },
  { id: "briqueterie", nom: "E-BRIQUETERIE", label: "Production de briques", color: "#BF5AF2" },
  { id: "foncier", nom: "E-FONCIER", label: "Gestion foncière", color: "#64D2FF" },
  { id: "garderie", nom: "E-GARDERIE", label: "Garderie LA TERMITIÈRE", color: "#FF453A" },
];

export const ROLES = {
  super_admin: "Super-administrateur",
  pau: "PAU (approbateur)",
  ge: "Gestion Exécutive",
  directeur: "Directeur",
  superviseur: "Superviseur",
  gerant: "Gérant de secteur",
  agent: "Agent de secteur",
};

// `modules` liste les modules auxquels l'utilisateur a explicitement accès — sans effet
// pour les rôles à accès total (super_admin, pau, ge, directeur), qui voient tout
// quelle que soit cette liste (cf. lib/modules.js → accesModule).
export const USERS = [
  { uid: "u1", login: "admin", nom: "Aboudou MOROU", role: "super_admin", secteur: null, modules: [] },
  { uid: "u2", login: "pau", nom: "K. AMEGANVI", role: "pau", secteur: null, modules: [] },
  { uid: "u2b", login: "ge", nom: "F. HOUNSOU", role: "ge", secteur: null, modules: [] },
  { uid: "u3", login: "directeur", nom: "Le Directeur Général", role: "directeur", secteur: null, modules: [] },
  { uid: "u4", login: "gerant.log", nom: "S. BALOUKI", role: "gerant", secteur: "logistique", modules: ["depense", "logistique"] },
  { uid: "u5", login: "agent.agro", nom: "A. KOFFI", role: "agent", secteur: "agro", modules: ["agro"] },
  { uid: "u6", login: "agent.gard", nom: "Y. ADEWALE", role: "agent", secteur: "garderie", modules: ["garderie"] },
];

const CATEGORIES_PAR_SECTEUR = {
  btp: ["Matériaux de construction", "Main d'œuvre", "Location d'engins", "Transport de matériaux"],
  agro: ["Aliments bétail", "Vétérinaire & vaccins", "Carburant", "Entretien ferme"],
  logistique: ["Carburant", "Entretien véhicules", "Péages", "Pièces détachées"],
  briqueterie: ["Matières premières", "Énergie & combustible", "Maintenance four", "Transport"],
  foncier: ["Frais de notaire", "Bornage", "Taxes foncières", "Impression de dossiers"],
  garderie: ["Alimentation enfants", "Fournitures pédagogiques", "Santé & pharmacie", "Salaires personnel"],
};

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
const rand = rng(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const amount = (min, max) => Math.round((min + rand() * (max - min)) / 500) * 500;

const now = new Date(2026, 6, 27); // 27 juillet 2026, cohérent avec le mémoire
const monthsBack = 12;

const BENEFICIAIRES = ["Fournisseur Alpha", "Fournisseur Bêta", "Atelier Sud", "Garage Central", "Coopérative Nord"];

// Chaque catégorie de dépense appartient à un ordre de grandeur réaliste,
// pour éviter les montants aberrants (ex. un péage à 15 millions de FCFA).
const TIER_RANGE = {
  petite: [1500, 15000], // carburant, péages, pharmacie, fournitures courantes
  moyenne: [8000, 45000], // vétérinaire, entretien, maintenance, transport
  grande: [25000, 180000], // matériaux, matières premières, notaire, main d'œuvre, taxes
};
const CATEGORY_TIER = {
  "Matériaux de construction": "grande",
  "Main d'œuvre": "grande",
  "Location d'engins": "grande",
  "Transport de matériaux": "moyenne",
  "Aliments bétail": "moyenne",
  "Vétérinaire & vaccins": "moyenne",
  Carburant: "petite",
  "Entretien ferme": "moyenne",
  "Entretien véhicules": "moyenne",
  Péages: "petite",
  "Pièces détachées": "moyenne",
  "Matières premières": "grande",
  "Énergie & combustible": "moyenne",
  "Maintenance four": "grande",
  Transport: "moyenne",
  "Frais de notaire": "grande",
  Bornage: "moyenne",
  "Taxes foncières": "grande",
  "Impression de dossiers": "petite",
  "Alimentation enfants": "moyenne",
  "Fournitures pédagogiques": "petite",
  "Santé & pharmacie": "petite",
  "Salaires personnel": "grande",
  Matériaux: "grande",
  Prestataires: "grande",
  Équipements: "grande",
};
function montantCategorie(categorie) {
  const [min, max] = TIER_RANGE[CATEGORY_TIER[categorie] || "moyenne"];
  return Math.max(2000, Math.round(amount(min, max) / 500) * 500);
}

export const DEPENSES = [];
let depId = 1;
for (let m = 0; m < monthsBack; m++) {
  const d0 = new Date(now.getFullYear(), now.getMonth() - m, 1);
  SECTEURS.forEach((s) => {
    const nb = 6 + Math.floor(rand() * 8);
    for (let i = 0; i < nb; i++) {
      const day = 1 + Math.floor(rand() * 27);
      const date = new Date(d0.getFullYear(), d0.getMonth(), day);
      const categorie = pick(CATEGORIES_PAR_SECTEUR[s.id]);
      const montant = montantCategorie(categorie);
      const seuil = 30000;
      // seules les dépenses du mois en cours peuvent rester "en attente" ou "approuvée" (non décaissée) ;
      // les mois précédents sont nécessairement soldés (décaissés ou refusés).
      const statut =
        montant < seuil
          ? "decaissee"
          : m === 0
          ? pick(["en_attente", "en_attente", "approuvee", "decaissee", "decaissee"])
          : pick(["decaissee", "decaissee", "decaissee", "decaissee", "refusee"]);
      DEPENSES.push({
        id: `dep_${depId++}`,
        secteurId: s.id,
        categorie,
        montant,
        date: date.toISOString().slice(0, 10),
        description: `${categorie} — ${s.nom}`,
        natureFlux: pick(["exploitation", "exploitation", "exploitation", "investissement", "perte"]),
        sourceFinancement: pick(["entreprise", "entreprise", "entreprise", "pau"]),
        beneficiaireNom: pick(BENEFICIAIRES),
        piece: `facture_${String(depId).padStart(4, "0")}.pdf`,
        statut,
        seuil,
      });
    }
  });
}

// Le budget est dérivé des dépenses réellement générées pour chaque secteur/mois,
// avec un taux de consommation cible variable — plutôt que l'inverse — afin
// d'obtenir une répartition crédible (certains secteurs dans les clous, d'autres
// en dépassement), sans jamais produire de pourcentages aberrants.
function totalDepenseSecteurMois(secteurId, annee, mois) {
  return DEPENSES.filter((d) => {
    const dt = new Date(d.date);
    return d.secteurId === secteurId && dt.getFullYear() === annee && dt.getMonth() === mois && d.statut !== "refusee";
  }).reduce((s, d) => s + d.montant, 0);
}
// taux de consommation cible du mois en cours, choisi pour obtenir un tableau de
// bord démonstratif varié (secteurs sains, en attention, et en dépassement).
const RATIO_MOIS_COURANT = { logistique: 0.48, agro: 0.66, btp: 0.74, garderie: 0.95, briqueterie: 1.12, foncier: 1.28 };

// Sécurité : aucun montant affiché (total mensuel dépenses/recettes par secteur,
// ou budget alloué) ne doit dépasser 1 000 000 FCFA — si le tirage aléatoire
// produit un mois trop chargé, on réduit proportionnellement tous les montants
// de ce mois/secteur pour rester sous ce plafond, plutôt que de tronquer
// arbitrairement une ligne (ce qui fausserait les totaux affichés).
const PLAFOND_MENSUEL = 950_000;
function plafonnerParMoisSecteur(liste) {
  const groupes = {};
  liste.forEach((item) => {
    const cle = `${item.secteurId}_${item.date.slice(0, 7)}`;
    (groupes[cle] ||= []).push(item);
  });
  Object.values(groupes).forEach((items) => {
    const total = items.reduce((s, i) => s + i.montant, 0);
    if (total > PLAFOND_MENSUEL) {
      const facteur = PLAFOND_MENSUEL / total;
      items.forEach((i) => {
        i.montant = Math.max(1500, Math.round((i.montant * facteur) / 500) * 500);
      });
    }
  });
}
plafonnerParMoisSecteur(DEPENSES);
// Un montant redescendu sous le seuil d'autorisation après plafonnement doit
// nécessairement redevenir "décaissée" (même règle qu'à la génération).
DEPENSES.forEach((d) => {
  if (d.montant < d.seuil) d.statut = "decaissee";
});

export const BUDGETS = [];
for (let m = 0; m < monthsBack; m++) {
  const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
  SECTEURS.forEach((s) => {
    const depenseMois = totalDepenseSecteurMois(s.id, d.getFullYear(), d.getMonth());
    const ratio = m === 0 ? RATIO_MOIS_COURANT[s.id] ?? 0.75 : 0.55 + rand() * 0.35;
    const montant = Math.min(980_000, Math.max(80_000, Math.round(depenseMois / ratio / 5000) * 5000));
    BUDGETS.push({
      id: `bud_${s.id}_${d.getFullYear()}_${d.getMonth()}`,
      secteurId: s.id,
      annee: d.getFullYear(),
      mois: d.getMonth(),
      montant,
    });
  });
}

export const RECETTES = [];
let recId = 1;
for (let m = 0; m < monthsBack; m++) {
  const d0 = new Date(now.getFullYear(), now.getMonth() - m, 1);
  SECTEURS.forEach((s) => {
    const nb = 3 + Math.floor(rand() * 5);
    for (let i = 0; i < nb; i++) {
      const day = 1 + Math.floor(rand() * 27);
      const date = new Date(d0.getFullYear(), d0.getMonth(), day);
      RECETTES.push({
        id: `rec_${recId++}`,
        secteurId: s.id,
        montant: amount(10000, 140_000),
        date: date.toISOString().slice(0, 10),
        origine: pick(["Vente", "Prestation", "Facturation client", "Subvention"]),
      });
    }
  });
}
plafonnerParMoisSecteur(RECETTES);

export const JOURNAL = [
  { id: "j1", userNom: "A. KOFFI", role: "agent", module: "E-DÉPENSES", action: "Saisie dépense", details: "Carburant — MAXI LOGISTIQUE — 35 000 FCFA", timestamp: "2026-07-27T09:12:00" },
  { id: "j2", userNom: "S. BALOUKI", role: "gerant", module: "E-DÉPENSES", action: "Définition budget", details: "Budget juillet 2026 — MAXI LOGISTIQUE", timestamp: "2026-07-26T16:40:00" },
  { id: "j3", userNom: "K. AMEGANVI", role: "pau", module: "E-DÉPENSES", action: "Approbation dépense", details: "Dépense #DEP-0231 approuvée — 45 000 FCFA", timestamp: "2026-07-26T11:05:00" },
  { id: "j4", userNom: "Le Directeur Général", role: "directeur", module: "E-DÉPENSES", action: "Consultation tableau de bord", details: "Vue consolidée — tous secteurs", timestamp: "2026-07-25T18:22:00" },
  { id: "j5", userNom: "A. KOFFI", role: "agent", module: "E-DÉPENSES", action: "Saisie recette", details: "Vente — MAXI BAT — 180 000 FCFA", timestamp: "2026-07-25T10:03:00" },
];

export function seuilApprobation() {
  return 30000;
}
