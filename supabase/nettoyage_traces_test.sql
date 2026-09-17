-- Nettoyage des traces de test laissées par la vérification en direct du
-- 2026-09-17 (secteur "TEST VERIF CLAUDE", dépense "Test Claude Verif").
-- Le secteur lui-même a déjà été supprimé (via archiverEtSupprimerModule),
-- mais journal/notifications/motifs_suppression/archives ne sont pas dans
-- le périmètre d'une suppression de secteur (volontaire, pour préserver un
-- vrai historique en usage normal) : ces lignes-là ont survécu.
delete from public.notifications
  where message ilike '%TEST VERIF CLAUDE%' or message ilike '%Test Claude Verif%';

delete from public.journal
  where details ilike '%TEST VERIF CLAUDE%';

delete from public.motifs_suppression
  where element_label ilike '%TEST VERIF CLAUDE%';

delete from public.archives
  where secteur_nom ilike '%TEST VERIF CLAUDE%';
