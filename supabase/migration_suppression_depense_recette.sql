-- Migration : autorise la suppression d'une dépense ou d'une recette.
-- Déjà appliquée en base par Claude via connexion directe (psql) le
-- 2026-08-07 — ce fichier documente le changement dans l'historique du
-- dépôt, il n'a pas besoin d'être réexécuté.
--
-- Suppression d'une dépense : réservée aux approbateurs (mêmes rôles que
-- ceux qui valident déjà le circuit d'autorisation), et seulement sur les
-- secteurs auxquels ils ont accès — cohérent avec le fait qu'un agent ne
-- doit jamais pouvoir effacer ce qu'il a saisi lui-même.
create policy "suppression depense reservee aux approbateurs" on public.depenses
  for delete using (public.is_approbateur() and public.has_module(secteur_id));

-- Suppression d'une recette : réservée aux rôles à accès total (pas de
-- circuit d'approbation équivalent pour les recettes dans ce module).
create policy "suppression recette reservee aux roles a acces total" on public.recettes
  for delete using (public.is_full_access());
