// Registre central des modules de la plateforme — chaque module métier partage le
// même secteur d'activité qu'E-DÉPENSES : les dépenses et recettes saisies ici
// sont automatiquement visibles dans E-DÉPENSES, sans double saisie, exactement
// comme sur la vraie plateforme.
//
// Les modules métiers ne sont plus une liste codée en dur : ils sont dérivés
// dynamiquement de la table `secteurs` (Supabase), gérée depuis Paramètres.
// Un secteur nouvellement créé devient donc automatiquement un module complet
// (portail + tableau de bord + facturation + dépenses), sans déploiement de
// code. `PRESETS` ne fait que personnaliser l'icône/le stock des secteurs déjà
// connus à la conception de l'application — un secteur inconnu reçoit une
// icône et un comportement génériques, identiques à E-FONCIER/E-GARDERIE.
import { Wallet, Wheat, Truck, Factory, MapPinned, Baby, Building2, Briefcase, Dumbbell, Megaphone } from "lucide-react";

export const MODULE_DEPENSE = {
  id: "depense",
  nom: "E-DÉPENSES",
  description: "Pilotage financier consolidé",
  color: "#0A84FF",
  icon: Wallet,
  path: "/depense",
};

// Secteur exclu de la liste des modules métiers du portail par conception —
// le BTP est piloté par le circuit PAU en dehors des vues E-DÉPENSES.
const SECTEURS_EXCLUS_DES_MODULES = ["btp"];

// Toute ville susceptible de porter un secteur « succursale » (ex. « MAXI
// GYM KARA », « E-BRIQUETERIE SOKODÉ »). Sert à la fois à reconnaître le
// preset d'un secteur par préfixe de nom (`matchNom`) et à extraire
// module/ville pour l'affichage (`decoupeNomVille`, `groupesModules`) — donc
// à la fonctionnalité « Ajouter un lieu » de Paramètres, générique à tous
// les modules (à la demande de l'utilisateur, 2026-09-15).
export const VILLES_CONNUES = ["LOME", "LOMÉ", "KARA", "SOKODE", "SOKODÉ"];

const PRESETS = {
  agro: { icon: Wheat, description: "Élevage & agrobusiness", typesFacturation: ["Prestation", "Vente de produits"], stock: "animaux", matchNom: "MAXI AGRO" },
  // `transport: true` active le volet dédié « Transport » (courses),
  // distinct de la facturation Prestation/Location déjà générique — suivi
  // opérationnel (client, horaire, véhicule, chauffeur) plutôt que
  // financier. `matchNom` : MAXI LOGISTIQUE est présent à Lomé, Sokodé et
  // Kara — un secteur par ville (ex. « MAXI LOGISTIQUE KARA », id différent
  // de "logistique") reste reconnu comme ce même preset via son nom.
  logistique: { icon: Truck, description: "Transport & location de matériel", typesFacturation: ["Prestation", "Location"], stock: "materiel", transport: true, matchNom: "MAXI LOGISTIQUE" },
  // `transport: true` : livraison des briques vers les chantiers/clients —
  // même volet « Transport » (courses, heure de départ, dépenses liées) que
  // MAXI LOGISTIQUE, la table `logistique_transports` étant déjà partagée
  // par secteur_id.
  briqueterie: { icon: Factory, description: "Production & vente de briques", typesFacturation: ["Vente de briques"], stock: "briques", transport: true, matchNom: "E-BRIQUETERIE" },
  // `foncier: true` : active le volet dédié « Dossiers fonciers » dans
  // BusinessLayout — un `config.id === "foncier"` échouerait pour une
  // succursale (ex. « E-FONCIER SOKODÉ », id différent).
  foncier: { icon: MapPinned, description: "Gestion foncière", typesFacturation: ["Prestation", "Location"], foncier: true, matchNom: "E-FONCIER" },
  // `garderie: true` : idem, pour les volets Enfants/Paiements/Cantine/
  // Infirmerie/Analyse propres à E-GARDERIE.
  garderie: { icon: Baby, description: "Garderie LA TERMITIÈRE", typesFacturation: ["Frais d'inscription"], garderie: true, matchNom: "E-GARDERIE" },
  // typesFacturation absent : plus de nav Prestations pour E-G.PRO, la
  // facturation client se fait depuis Projets (contrat + versements).
  // `egpro: true` : idem, pour les volets Projets/Tâches.
  egpro: { icon: Briefcase, description: "Gestion des projets de l'entreprise", egpro: true, matchNom: "E-G.PRO" },
  // MAXI GYM : salle de sport — séances ponctuelles et abonnements, vendus
  // selon 3 forfaits (Simple / Classique / VIP) gérés depuis le volet dédié
  // « Nos forfaits ». `forfaits: true` active ce volet ainsi que « Clients »
  // dans BusinessLayout. `matchNom` : présent à Lomé ET Kara — chaque ville
  // est son propre secteur (ex. « MAXI GYM KARA »), reconnu par préfixe de
  // nom puisque son id slugifié diffère de "maxi-gym".
  "maxi-gym": { icon: Dumbbell, description: "Salle de sport — séances & abonnements", typesFacturation: ["Séance", "Abonnement"], forfaits: true, matchNom: "MAXI GYM" },
  // MAXI COM : communication & marketing — facturé à la prestation
  // (campagne, visuel, community management...). `campagnes: true` active un
  // volet de suivi par campagne (budget, client, statut), plus fin que la
  // seule liste de dépenses/recettes.
  "maxi-com": { icon: Megaphone, description: "Communication & marketing", typesFacturation: ["Prestation"], campagnes: true, matchNom: "MAXI COM" },
};

// Un secteur "succursale" (ex. « MAXI GYM KARA », créé depuis Paramètres
// avec un nom qui n'est pas exactement celui de la clé PRESETS) reçoit son
// propre id slugifié (slugify("MAXI GYM KARA") = "maxi-gym-kara") — la
// correspondance exacte sur `secteur.id` échouerait donc pour lui. On
// retombe alors sur une correspondance par préfixe de nom (`matchNom`),
// insensible à la casse, pour que toutes les villes d'un même module métier
// (Lomé, Kara...) partagent bien la même icône et les mêmes volets.
function presetPour(secteur) {
  if (PRESETS[secteur.id]) return PRESETS[secteur.id];
  const nom = (secteur.nom || "").trim().toUpperCase();
  for (const key in PRESETS) {
    const p = PRESETS[key];
    if (p.matchNom && nom.startsWith(p.matchNom)) return p;
  }
  return {};
}

function moduleFromSecteur(secteur) {
  const preset = presetPour(secteur);
  return {
    id: secteur.id,
    nom: secteur.nom,
    secteurId: secteur.id,
    description: preset.description || secteur.label || secteur.nom,
    color: secteur.color || "#0A84FF",
    icon: preset.icon || Building2,
    path: `/secteur/${secteur.id}`,
    typesFacturation: preset.typesFacturation || ["Prestation"],
    stock: preset.stock,
    forfaits: preset.forfaits || false,
    campagnes: preset.campagnes || false,
    transport: preset.transport || false,
    foncier: preset.foncier || false,
    egpro: preset.egpro || false,
    garderie: preset.garderie || false,
  };
}

// Sépare le nom d'un secteur en { base, ville } quand son dernier mot est
// une ville connue (VILLES_CONNUES) — ex. « MAXI GYM KARA » → { base: "MAXI
// GYM", ville: "Kara" }. Un secteur pas encore décliné par ville (ou dont le
// dernier mot n'est pas une ville reconnue) renvoie `ville: ""`.
export function decoupeNomVille(nom) {
  const mots = (nom || "").trim().split(/\s+/);
  const dernier = (mots[mots.length - 1] || "").toUpperCase();
  if (mots.length < 2 || !VILLES_CONNUES.includes(dernier)) return { base: nom || "", ville: "" };
  const ville = mots[mots.length - 1];
  return { base: mots.slice(0, -1).join(" "), ville: ville.charAt(0) + ville.slice(1).toLowerCase() };
}

// Regroupe les modules métier par « famille » (même base une fois la ville
// retirée) — utilisé par Utilisateurs.jsx pour proposer un seul bouton
// « MAXI GYM » (au lieu d'un bouton par ville) qui ouvre un choix de ville,
// à la demande de l'utilisateur (2026-09-15). Un module non décliné par
// ville reste seul dans son groupe (`villes.length === 1`, `ville: ""`).
export function groupesModules(modules) {
  const groupes = new Map();
  for (const m of modules) {
    const { base, ville } = decoupeNomVille(m.nom);
    const cle = ville ? base : m.nom;
    if (!groupes.has(cle)) groupes.set(cle, { base: cle, modules: [] });
    groupes.get(cle).modules.push({ ...m, ville });
  }
  return [...groupes.values()];
}

export function modulesMetier(secteurs = []) {
  return secteurs
    .filter((s) => s.actif !== false && !SECTEURS_EXCLUS_DES_MODULES.includes(s.id))
    .map(moduleFromSecteur);
}

export function tousLesModules(secteurs = []) {
  return [MODULE_DEPENSE, ...modulesMetier(secteurs)];
}

export function moduleParId(id, secteurs = []) {
  return tousLesModules(secteurs).find((m) => m.id === id);
}

// Un utilisateur "full access" (rôles dirigeants) voit tous les modules quelle que
// soit la liste `modules` sur son profil — cohérent avec les rôles E-DÉPENSES.
export const ROLES_ACCES_TOTAL = ["super_admin", "pau", "ge", "directeur"];

// Boutons Modifier/Supprimer, communs à toutes les listes de l'application
// (dépenses, recettes, clients, forfaits, transport...), à la demande de
// l'utilisateur (2026-09-14) : Modifier reste réservé aux rôles à accès
// total (ROLES_ACCES_TOTAL) ; Supprimer s'étend en plus à Superviseur et
// Gérant de secteur ; Agent ne voit NI l'un ni l'autre, dans AUCUN module —
// règle non négociable, confirmée explicitement par l'utilisateur.
export const ROLES_SUPPRESSION = [...ROLES_ACCES_TOTAL, "superviseur", "gerant"];
export function peutModifier(role) { return ROLES_ACCES_TOTAL.includes(role); }
export function peutSupprimer(role) { return ROLES_SUPPRESSION.includes(role); }

// Confirmer la réception d'un budget alloué par un directeur (Recettes.jsx) :
// c'est le Gérant de secteur qui reçoit le budget de SON secteur, pas
// forcément un autre rôle à accès total — Agent en reste exclu (à la
// demande de l'utilisateur, 2026-09-14 : "c'est l'agent ou c'est le gérant
// qui valide la réception ?" → le gérant).
export const ROLES_CONFIRMATION_BUDGET = [...ROLES_ACCES_TOTAL, "gerant"];
export function peutConfirmerBudget(role) { return ROLES_CONFIRMATION_BUDGET.includes(role); }

export function accesModule(user, moduleId) {
  if (!user) return false;
  if (ROLES_ACCES_TOTAL.includes(user.role)) return true;
  return (user.modules || []).includes(moduleId);
}

export function modulesAccessibles(user, secteurs = []) {
  return tousLesModules(secteurs).filter((m) => accesModule(user, m.id));
}

// `secteurFiltre` (uiStore) vaut soit "tous", soit l'id d'un secteur précis,
// soit `grupo:<base>` pour un module décliné par ville choisi comme un tout
// (ex. « MAXI LOGISTIQUE » = Lomé + Kara cumulés) — voir TopBar.jsx. Renvoie
// la liste des ids de secteur à additionner, ou `null` pour "tous" (pas de
// filtre). À la demande explicite de l'utilisateur (2026-09-15) : un module à
// plusieurs secteurs doit cumuler tous ses lieux quand on le sélectionne.
export function secteurIdsPourFiltre(secteurFiltre, secteurs = []) {
  if (!secteurFiltre || secteurFiltre === "tous") return null;
  if (secteurFiltre.startsWith("grupo:")) {
    const base = secteurFiltre.slice(6);
    const groupe = groupesModules(modulesMetier(secteurs)).find((g) => g.base === base);
    return groupe ? groupe.modules.map((m) => m.id) : [];
  }
  return [secteurFiltre];
}
