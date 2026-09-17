-- Remise à zéro des coûts d'achat de test (Tente 10x10, Table ronde,
-- Chaise pliante, Pack sonorisation...) pour MAXI LOGISTIQUE LOMÉ + KARA —
-- à la demande explicite de l'utilisateur (2026-09-17) : il ressaisira les
-- vrais coûts lui-même. Ne touche NI aux quantités/mouvements (achats,
-- sorties, retours) NI au tarif de location : uniquement `cout_achat`.
update public.referentiel_materiel
set cout_achat = 0
where secteur_id in (
  select id from public.secteurs where nom ilike 'MAXI LOGISTIQUE%'
);
