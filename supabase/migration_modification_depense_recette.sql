-- Migration : autorise la modification d'une dépense ou d'une recette.
-- Déjà appliquée en base par Claude via connexion directe (psql) le
-- 2026-08-07 — ce fichier documente le changement dans l'historique du
-- dépôt, il n'a pas besoin d'être réexécuté.
--
-- Dépenses : une policy UPDATE existe déjà depuis schema.sql
-- ("statut dépense modifiable par les approbateurs"), scopée aux
-- approbateurs et à leurs secteurs — elle couvre déjà la modification
-- complète d'une ligne (pas seulement le statut), donc aucune nouvelle
-- policy n'est nécessaire ici pour les dépenses.
--
-- Recettes : aucune policy UPDATE n'existait — en ajoute une, réservée aux
-- rôles à accès total (même granularité que la suppression de recette).
create policy "modification recette reservee aux roles a acces total" on public.recettes
  for update using (public.is_full_access()) with check (public.is_full_access());
