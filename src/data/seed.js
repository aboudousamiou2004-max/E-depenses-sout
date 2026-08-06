// Labels de rôle affichés dans l'UI (page Utilisateurs). Toutes les autres
// données (secteurs, dépenses, recettes, budgets, journal, utilisateurs) sont
// désormais réelles, en base Supabase — voir supabase/schema.sql. Ce fichier
// contenait auparavant un générateur de données factices en localStorage ;
// il n'a plus lieu d'être maintenant que la base est réelle.
export const ROLES = {
  super_admin: "Super-administrateur",
  pau: "PAU (approbateur)",
  ge: "Gestion Exécutive",
  directeur: "Directeur",
  superviseur: "Superviseur",
  gerant: "Gérant de secteur",
  agent: "Agent de secteur",
};
