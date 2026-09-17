-- Migration : rendre la suppression d'un secteur/module réellement
-- inconditionnelle — à la demande explicite de l'utilisateur (2026-09-17) :
-- « je ne veux plus avoir le truc de il y'a déjà des dépenses, je veux
-- pouvoir supprimer ». Testé en direct : la suppression de MAXI LOGISTIQUE
-- KARA échouait avec « update or delete on table "secteurs" violates
-- foreign key constraint "journal_secteur_id_fkey" ».
--
-- Cause : la plupart des tables liées à un secteur référencent
-- `secteurs(id)` sans clause ON DELETE (= RESTRICT implicite), et certaines
-- (journal, referentiel_materiel, mouvements_materiel...) n'ont même aucune
-- policy RLS de suppression — la suppression scopée de ces lignes depuis le
-- client (archiverEtSupprimerModule / reinitialiserBaseDeDonnees) échoue
-- alors silencieusement (0 ligne supprimée), puis la suppression du secteur
-- lui-même échoue avec une violation de clé étrangère.
--
-- Solution : convertir toutes ces FK en ON DELETE CASCADE. Les contraintes
-- d'intégrité référentielle (dont les CASCADE qu'elles déclenchent) passent
-- toujours au-dessus du RLS (doc Postgres : « referential integrity checks
-- ... will always bypass row security »), donc supprimer un secteur
-- nettoiera désormais TOUJOURS ses données, même sur les tables sans policy
-- DELETE dédiée. Les dépenses/recettes/journal du secteur sont déjà
-- recopiées dans `archives` par le code AVANT cette suppression : rien
-- n'est perdu (voir migration_archives.sql).
--
-- Exclusions volontaires :
--  - profiles.secteur : le code met explicitement ce champ à NULL avant de
--    supprimer le secteur (archiverEtSupprimerModule) — on ne supprime
--    jamais un compte utilisateur en supprimant un secteur.
--  - motifs_suppression.secteur_id : déjà en ON DELETE SET NULL (voir
--    migration_fix_motifs_suppression_fk.sql) — l'historique des motifs de
--    suppression doit survivre même sans secteur associé.
do $$
declare
  r record;
  v_column text;
begin
  for r in
    select conrelid::regclass::text as table_name, conname, conrelid
    from pg_constraint
    where confrelid = 'public.secteurs'::regclass
      and contype = 'f'
      and confdeltype not in ('c', 'n') -- déjà CASCADE ou SET NULL : rien à faire
      -- regclass::text est rendu SANS le préfixe "public." tant que le
      -- search_path par défaut est actif : exclusion sur le nom simple.
      and conrelid::regclass::text not in ('profiles', 'motifs_suppression')
  loop
    -- Colonne déduite dynamiquement plutôt que supposée "secteur_id" : la
    -- plupart des tables l'appellent ainsi, mais mieux vaut ne pas le
    -- deviner (cf. l'échec initial de cette migration sur "profiles").
    select a.attname into v_column
    from pg_constraint c
    join unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.conname = r.conname and c.conrelid = r.conrelid;

    execute format('alter table %s drop constraint %I', r.table_name, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references public.secteurs(id) on delete cascade',
      r.table_name, r.conname, v_column
    );
    raise notice 'FK % sur % (colonne %) convertie en ON DELETE CASCADE', r.conname, r.table_name, v_column;
  end loop;
end $$;
