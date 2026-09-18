-- Migration : le décaissement d'une dépense déjà approuvée revient au gérant
-- DU SECTEUR CONCERNÉ, pas à l'administration qui l'a validée — décision
-- explicite de l'utilisateur (2026-09-18). Valider/refuser une demande reste
-- réservé à l'administration (is_approbateur) ; seule l'étape suivante
-- (décaisser une dépense déjà "approuvee") passe au gérant.
--
-- Remplace la policy UPDATE posée par migration_modification_depense_par_auteur.sql
-- (elle-même : approbateurs OU auteur tant qu'en_attente) en y ajoutant une
-- troisième branche, avec le même principe que la confirmation de budget
-- (migration_confirmation_reservee_gerant.sql) : le gérant ne peut faire
-- QUE cette transition précise (approuvee → decaissee), rien d'autre — le
-- WITH CHECK borne explicitement le statut résultant.
drop policy if exists "dépenses modifiables par les approbateurs ou leur auteur tant qu'en attente" on public.depenses;

create policy "dépenses modifiables par les approbateurs, leur auteur tant qu'en attente, ou décaissées par le gérant" on public.depenses
  for update using (
    (public.is_approbateur() and public.has_module(secteur_id))
    or (cree_par = auth.uid() and statut = 'en_attente' and public.has_module(secteur_id))
    or (
      statut = 'approuvee' and public.has_module(secteur_id)
      and public.current_role_name() = 'gerant'
      and exists (select 1 from public.profiles where id = auth.uid() and secteur = depenses.secteur_id)
    )
  )
  with check (
    (public.is_approbateur() and public.has_module(secteur_id))
    or (cree_par = auth.uid() and statut = 'en_attente' and public.has_module(secteur_id))
    or (
      statut = 'decaissee' and public.has_module(secteur_id)
      and public.current_role_name() = 'gerant'
      and exists (select 1 from public.profiles where id = auth.uid() and secteur = depenses.secteur_id)
    )
  );
