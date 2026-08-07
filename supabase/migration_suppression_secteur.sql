-- Migration : autorise la suppression d'un secteur depuis Paramètres
-- À exécuter dans Supabase SQL Editor (New query), après migration_parametres.sql.
--
-- Aucune option ON DELETE CASCADE n'est ajoutée sur les tables budgets,
-- depenses, recettes ou profiles : si un secteur a déjà une activité
-- financière ou des utilisateurs rattachés, la suppression est refusée par
-- PostgreSQL (violation de clé étrangère) plutôt que d'effacer silencieusement
-- l'historique. Un secteur avec de l'historique doit être désactivé, pas
-- supprimé — la désactivation reste possible dans tous les cas.

create policy "suppression de secteur reservee aux roles a acces total" on public.secteurs
  for delete using (public.is_full_access());
