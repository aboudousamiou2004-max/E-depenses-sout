// Registre central des modules de la plateforme — chaque module métier partage le
// même secteur d'activité qu'E-DÉPENSES (agro, logistique, briqueterie, foncier,
// garderie) : les dépenses et recettes saisies ici sont automatiquement visibles
// dans E-DÉPENSES, sans double saisie, exactement comme sur la vraie plateforme.
import { Wallet, Wheat, Truck, Factory, MapPinned, Baby } from "lucide-react";

export const MODULE_DEPENSE = {
  id: "depense",
  nom: "E-DÉPENSES",
  description: "Pilotage financier consolidé",
  color: "#0A84FF",
  icon: Wallet,
  path: "/depense",
};

// Modules métiers "simplifiés" — un seul jeu de pages (Dashboard / Facturation /
// Dépenses) réutilisé pour chacun via sa config, plutôt que dupliqué cinq fois.
export const MODULES_METIER = [
  {
    id: "agro",
    nom: "MAXI AGRO",
    secteurId: "agro",
    description: "Élevage & agrobusiness",
    color: "#30D158",
    icon: Wheat,
    path: "/agro",
    typesFacturation: ["Prestation", "Vente de produits"],
    stock: "animaux",
  },
  {
    id: "logistique",
    nom: "MAXI LOGISTIQUE",
    secteurId: "logistique",
    description: "Transport & location de matériel",
    color: "#FF9F0A",
    icon: Truck,
    path: "/logistique",
    typesFacturation: ["Prestation", "Location"],
    stock: "materiel",
  },
  {
    id: "briqueterie",
    nom: "E-BRIQUETERIE",
    secteurId: "briqueterie",
    description: "Production & vente de briques",
    color: "#BF5AF2",
    icon: Factory,
    path: "/briqueterie",
    typesFacturation: ["Prestation", "Vente de briques"],
    stock: "briques",
  },
  {
    id: "foncier",
    nom: "E-FONCIER",
    secteurId: "foncier",
    description: "Gestion foncière",
    color: "#64D2FF",
    icon: MapPinned,
    path: "/foncier",
    typesFacturation: ["Prestation", "Location"],
  },
  {
    id: "garderie",
    nom: "E-GARDERIE",
    secteurId: "garderie",
    description: "Garderie LA TERMITIÈRE",
    color: "#FF453A",
    icon: Baby,
    path: "/garderie",
    typesFacturation: ["Prestation", "Frais d'inscription"],
  },
];

export const TOUS_LES_MODULES = [MODULE_DEPENSE, ...MODULES_METIER];

export function moduleParId(id) {
  return TOUS_LES_MODULES.find((m) => m.id === id);
}

// Un utilisateur "full access" (rôles dirigeants) voit tous les modules quelle que
// soit la liste `modules` sur son profil — cohérent avec les rôles E-DÉPENSES.
export const ROLES_ACCES_TOTAL = ["super_admin", "pau", "ge", "directeur"];

export function accesModule(user, moduleId) {
  if (!user) return false;
  if (ROLES_ACCES_TOTAL.includes(user.role)) return true;
  return (user.modules || []).includes(moduleId);
}

export function modulesAccessibles(user) {
  return TOUS_LES_MODULES.filter((m) => accesModule(user, m.id));
}
