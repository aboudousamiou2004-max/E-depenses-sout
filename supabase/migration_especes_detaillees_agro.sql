-- Détail des espèces MAXI AGRO par sous-type (sexe/âge), comme sur la
-- plateforme LA TERMITIÈRE (src/modules/agro/data.js — ESPECES) : les
-- catégories (OVINS, BOVINS, CAPRINS, POULETS, PINTADES) contenaient
-- jusqu'ici un seul référentiel générique par catégorie ("Ovins (moutons)",
-- etc.) — remplacé ici par le détail espèce par espèce demandé
-- explicitement par l'utilisateur (2026-08-18) : ex. OVINS → Béliers,
-- Brebis, Agneaux.
--
-- Les effectifs initiaux génériques (85 ovins, 32 bovins, 60 caprins,
-- 420 poulets, 140 pintades — données de démonstration) sont répartis entre
-- les nouveaux sous-types dans des proportions plausibles.
--
-- Seule la catégorie OVINS avait un historique de mouvements (3 lignes sur
-- 'ovins') : réassigné à 'brebis' avant suppression de l'ancien référentiel
-- générique, pour ne perdre aucune donnée.
--
-- Complète aussi CANARDS et DINDONS (absentes jusqu'ici de ce projet — 0
-- ligne en base), avec les mêmes libellés que la plateforme, à la demande
-- de l'utilisateur qui a montré en exemple l'écran « Répartition par
-- espèce — CANARDS » du vrai portail.

-- 1) Catégories sans historique : suppression directe du référentiel générique.
delete from public.referentiel_animaux where id in ('bovins', 'caprins', 'poulets', 'pintades');

-- 2) Nouveaux référentiels détaillés par espèce (mêmes libellés que la plateforme).
insert into public.referentiel_animaux (id, nom, cat, init_quantite) values
  ('brebis',       'Brebis',                  'OVINS',    45),
  ('beliers',      'Béliers',                 'OVINS',    25),
  ('agneaux',      'Agneaux (≤6 mois)',       'OVINS',    15),
  ('boeufs',       'Bœufs',                   'BOVINS',   10),
  ('vaches',       'Vaches',                  'BOVINS',   14),
  ('veaux',        'Veaux (≥8 mois)',         'BOVINS',    8),
  ('boucs',        'Boucs',                   'CAPRINS',  18),
  ('chevres',      'Chèvres',                 'CAPRINS',  30),
  ('chevreaux',    'Chevreaux (≤8 mois)',     'CAPRINS',  12),
  ('poulets_g',    'Poulets Goliath',         'POULETS',  40),
  ('poussins_g',   'Poussins Goliath',        'POULETS',  20),
  ('poulets_o',    'Poulets Ordinaires',      'POULETS', 120),
  ('poussins_o',   'Poussins Ordinaires',     'POULETS',  80),
  ('poulets_c',    'Poulets de Chair',        'POULETS', 100),
  ('poussins',     'Poussins',                'POULETS',  60),
  ('pintades',     'Pintades',                'PINTADES', 100),
  ('pintadeaux',   'Pintadeaux',              'PINTADES',  40),
  ('canards',      'Canards',                 'CANARDS',   50),
  ('cannetons',    'Cannetons',               'CANARDS',   25),
  ('dindons',      'Dindons',                 'DINDONS',   20),
  ('dindonneaux',  'Dindonneaux',             'DINDONS',   10);

-- 3) Historique 'ovins' → réassigné à 'brebis' (sous-type adulte le plus
--    représenté), puis suppression du référentiel générique OVINS.
update public.mouvements_animaux set espece_id = 'brebis' where espece_id = 'ovins';
delete from public.referentiel_animaux where id = 'ovins';
