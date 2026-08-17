-- Migration : la Saisie journalière MAXI AGRO (src/pages/business/SaisieJournaliere.jsx),
-- portée depuis termitiere-platform/src/modules/agro/Saisie.jsx, permet de
-- supprimer une ligne de mouvement animal saisie par erreur — `mouvements_animaux`
-- n'avait qu'une policy SELECT/INSERT, pas de DELETE.

create policy "mouvements animaux supprimables" on public.mouvements_animaux
  for delete using (public.has_module('agro'));

grant delete on public.mouvements_animaux to authenticated;
