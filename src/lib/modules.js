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
import { Wallet, Wheat, Truck, Factory, MapPinned, Baby, Building2, Briefcase } from "lucide-react";

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

const PRESETS = {
  agro: { icon: Wheat, description: "Élevage & agrobusiness", typesFacturation: ["Prestation", "Vente de produits"], stock: "animaux" },
  logistique: { icon: Truck, description: "Transport & location de matériel", typesFacturation: ["Prestation", "Location"], stock: "materiel" },
  briqueterie: { icon: Factory, description: "Production & vente de briques", typesFacturation: ["Vente de briques"], stock: "briques" },
  foncier: { icon: MapPinned, description: "Gestion foncière", typesFacturation: ["Prestation", "Location"] },
  garderie: { icon: Baby, description: "Garderie LA TERMITIÈRE", typesFacturation: ["Prestation", "Frais d'inscription"] },
  egpro: { icon: Briefcase, description: "Gestion des projets de l'entreprise", typesFacturation: ["Prestation", "Facturation de projet"] },
};

function moduleFromSecteur(secteur) {
  const preset = PRESETS[secteur.id] || {};
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
  };
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

export function accesModule(user, moduleId) {
  if (!user) return false;
  if (ROLES_ACCES_TOTAL.includes(user.role)) return true;
  return (user.modules || []).includes(moduleId);
}

export function modulesAccessibles(user, secteurs = []) {
  return tousLesModules(secteurs).filter((m) => accesModule(user, m.id));
}
