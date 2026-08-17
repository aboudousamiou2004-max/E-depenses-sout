-- Migration : Prestations de location structurées — MAXI LOGISTIQUE. Porté
-- (simplifié) depuis termitiere-platform/src/modules/logistique/{Demandes.jsx,
-- logic.js} (montantLigne/analyserPrestations), à la demande explicite de
-- l'utilisateur (2026-08-17).
--
-- Constat : la facturation logistique était purement en texte libre (un
-- montant tapé à la main), contrairement à la briqueterie qui calcule déjà
-- automatiquement qté × tarif. Ajoute un tarif de location par jour sur
-- chaque article, pour permettre le même calcul automatique
-- (jours × tarif/jour = montant) côté UI.
--
-- Le suivi des retours (bon état / cassé / perdu) n'a PAS besoin de nouvelle
-- table : `mouvements_materiel` a déjà les types retour_ok/retour_casse/
-- retour_perdu (voir schema.sql, TYPES_MOUVEMENT_MATERIEL côté client) —
-- simplement pas mis en avant dans une vue dédiée jusqu'ici.

alter table public.referentiel_materiel add column if not exists tarif_location numeric not null default 0;
