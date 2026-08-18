-- Remet à zéro tous les effectifs du cheptel MAXI AGRO, à la demande de
-- l'utilisateur (2026-08-18) : les init_quantite de démonstration ajoutés
-- par migration_especes_detaillees_agro.sql (45 brebis, 25 béliers...) ne
-- doivent pas apparaître — état vide avant utilisation réelle.
--
-- Le référentiel d'espèces (21 lignes, 7 catégories) reste en place ; seuls
-- les effectifs (init_quantite) et l'historique de mouvements (3 lignes de
-- test sur 'brebis') sont vidés.

update public.referentiel_animaux set init_quantite = 0;
delete from public.mouvements_animaux;
