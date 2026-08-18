-- E-GARDERIE — suivi d'inscription complet (mensuel/annuel/court séjour) et
-- frais de cantine, à la demande explicite de l'utilisateur (2026-08-18).
-- Porté (simplifié) depuis termitiere-platform/src/modules/garderie/
-- {Enfants,Paiements}.jsx :
-- - Court séjour : dureeSemaines + dateInscription → date de fin dérivée
--   côté client (dateInscription + N×7 jours), comme sur la plateforme
--   (logic.js/dateFinCourtSejour) — pas de colonne date_fin stockée,
--   recalculée à l'affichage.
-- - Frais de cantine : montant fixe par enfant (pas de programmation des
--   repas/présence par repas — volontairement écarté, aucune dimension
--   financière sur la plateforme non plus : « on met plus l'accent sur les
--   dépenses », donc uniquement ce qui a un impact monétaire est repris).

alter table public.garderie_enfants add column date_inscription date not null default current_date;
alter table public.garderie_enfants add column duree_semaines integer;
alter table public.garderie_enfants add column frais_cantine numeric not null default 0;

alter table public.garderie_paiements add column montant_cantine numeric not null default 0;
