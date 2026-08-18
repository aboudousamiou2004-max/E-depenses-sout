-- E-GARDERIE — fiche d'inscription complète, à la demande explicite de
-- l'utilisateur (2026-08-18) qui a demandé de reprendre tous les critères
-- d'inscription du vrai module (termitiere-platform/src/modules/garderie/
-- {Enfants.jsx,data.js}) : identité détaillée, groupe d'âge/programme,
-- parent/tuteur, santé/allergies, notes. Le bouton d'inscription est
-- maintenant accessible depuis Prestations, avec le formulaire complet
-- (au lieu d'une simple saisie de montant).
--
-- Simplification assumée : pas de photo (pas d'infrastructure de stockage
-- d'images dans ce projet).

alter table public.garderie_enfants add column age_saisi text not null default '';
alter table public.garderie_enfants add column sexe text check (sexe in ('F','M'));
alter table public.garderie_enfants add column programme text check (programme in ('garderie','maternelle'));
alter table public.garderie_enfants add column groupe text;
alter table public.garderie_enfants add column allergies text not null default '';
alter table public.garderie_enfants add column info_medicale text not null default '';
alter table public.garderie_enfants add column parent_nom text not null default '';
alter table public.garderie_enfants add column parent_contact text not null default '';
alter table public.garderie_enfants add column parent_contact2 text not null default '';
alter table public.garderie_enfants add column parent_profession text not null default '';
alter table public.garderie_enfants add column adresse text not null default '';
alter table public.garderie_enfants add column notes text not null default '';
