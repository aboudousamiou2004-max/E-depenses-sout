-- Migration : ouvre la modification d'une recette (facture/prestation) à
-- tout rôle ayant accès au module du secteur — plus seulement aux rôles à
-- accès total. Décision explicite de l'utilisateur (2026-09-19) : « la
-- modification = gérants + admin + PAU + GE + Agents ». La suppression
-- reste inchangée, réservée aux rôles à accès total
-- (migration_suppression_depense_recette.sql).
--
-- Au passage : `grant update on public.recettes` n'a jamais existé (seuls
-- select/insert étaient accordés dans schema.sql, delete ajouté séparément
-- dans migration_nouveaux_volets.sql) — sans ce GRANT au niveau table,
-- PostgREST refusait toute requête UPDATE avant même d'évaluer RLS, donc la
-- modification d'une recette n'a jamais fonctionné, même pour les rôles à
-- accès total. Corrigé ci-dessous, même schéma que le correctif équivalent
-- déjà fait pour DELETE (migration_nouveaux_volets.sql).
drop policy if exists "modification recette reservee aux roles a acces total" on public.recettes;

create policy "recettes modifiables selon accès module" on public.recettes
  for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));

grant update on public.recettes to authenticated;
