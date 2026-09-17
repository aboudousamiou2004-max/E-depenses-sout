-- Nettoyage des traces du test en direct de la suppression du seuil fixe
-- (2026-09-17) : budget temporaire de 200 000 FCFA alloué à E-FONCIER +
-- dépense de test de 35 000 FCFA, déjà supprimés côté application, mais le
-- Journal et les Notifications ne sont jamais nettoyés par une suppression
-- individuelle de dépense/budget (volontaire, historique normalement
-- préservé). Filtré par date du jour pour ne toucher AUCUNE autre entrée
-- E-FONCIER déjà existante (budgets précédents à 50 000 FCFA notamment).
delete from public.notifications
  where message = 'Aboudou MOROU a alloué 200000 FCFA à E-FONCIER.'
    and "timestamp"::date = current_date;

delete from public.journal
  where details in ('E-FONCIER — 200000 FCFA', 'Test seuil supprime — E-FONCIER — 35000 FCFA')
    and "timestamp"::date = current_date;
