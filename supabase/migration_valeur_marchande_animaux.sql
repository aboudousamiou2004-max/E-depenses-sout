-- Valeur marchande par animal identifié (bovins/ovins/caprins) — renseignable
-- par l'utilisateur depuis le volet « Espèces » de Cheptel (2026-08-18).
alter table public.agro_animaux_individuels add column valeur_marchande numeric not null default 0;
