-- Migration : étend le droit de l'auteur de modifier sa propre dépense
-- (migration_modification_depense_par_auteur.sql, 2026-09-18) aux dépenses
-- directement "décaissée" — celles qui n'ont JAMAIS déclenché le circuit
-- d'autorisation car dans le budget du secteur (voir compute_depense_statut :
-- statut = 'decaissee' dès la création si le montant reste sous le seuil/le
-- budget). Décision explicite de l'utilisateur (2026-09-18) : « je parle des
-- dépenses qui sont contenus dans le budget alloué, c'est-à-dire celles qui
-- ne passent pas par l'autorisation. Pour celles qui passent par
-- l'autorisation, ne change rien » — donc une fois en_attente → approuvee ou
-- refusee (passée par le circuit), la dépense reste verrouillée pour
-- gérant/agent exactement comme avant.
--
-- Remplace la policy posée par migration_decaissement_gerant.sql (dont le nom
-- est le plus récent en base, pas celui de migration_modification_depense_par_auteur.sql
-- que ce fichier avait ciblé par erreur au premier jet — repéré en testant en
-- direct : l'ancien nom de policy n'existait déjà plus, ce DROP IF EXISTS ne
-- faisait donc rien et laissait l'ancienne policy active, d'où l'échec
-- silencieux constaté au rechargement). On reprend ses 3 branches à
-- l'identique (approbateur, auteur, décaissement gérant) en élargissant
-- seulement la branche "auteur".
--
-- Aucun risque de contournement du circuit d'autorisation : le trigger
-- trg_valider_transition_statut (schema.sql) bloque déjà tout changement de
-- statut une fois la dépense 'decaissee' ("Cette dépense est déjà soldée") —
-- cette migration ne rouvre que les AUTRES colonnes (montant, catégorie,
-- date...), jamais une transition de statut supplémentaire.
drop policy if exists "dépenses modifiables par les approbateurs ou leur auteur tant qu'en attente" on public.depenses;
drop policy if exists "dépenses modifiables par les approbateurs, leur auteur tant qu'en attente, ou décaissées par le gérant" on public.depenses;

create policy "dépenses modifiables par les approbateurs, leur auteur, ou décaissées par le gérant" on public.depenses
  for update using (
    (public.is_approbateur() and public.has_module(secteur_id))
    or (cree_par = auth.uid() and statut in ('en_attente', 'decaissee') and public.has_module(secteur_id))
    or (
      statut = 'approuvee' and public.has_module(secteur_id)
      and public.current_role_name() = 'gerant'
      and exists (select 1 from public.profiles where id = auth.uid() and secteur = depenses.secteur_id)
    )
  )
  with check (
    (public.is_approbateur() and public.has_module(secteur_id))
    or (cree_par = auth.uid() and statut in ('en_attente', 'decaissee') and public.has_module(secteur_id))
    or (
      statut = 'decaissee' and public.has_module(secteur_id)
      and public.current_role_name() = 'gerant'
      and exists (select 1 from public.profiles where id = auth.uid() and secteur = depenses.secteur_id)
    )
  );
