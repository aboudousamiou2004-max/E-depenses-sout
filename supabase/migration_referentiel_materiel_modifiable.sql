-- Migration : permettre de modifier un article du stock MAXI LOGISTIQUE
-- (nom, catégorie, unité, coût d'achat, tarif de location) — à la demande
-- explicite de l'utilisateur (2026-09-17). Jusqu'ici seules les policies
-- SELECT et INSERT existaient sur `referentiel_materiel` : un UPDATE côté
-- client échouait silencieusement (0 ligne modifiée, RLS oblige).
create policy "referentiel materiel modifiable (update)" on public.referentiel_materiel
  for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));

grant update on public.referentiel_materiel to authenticated;
