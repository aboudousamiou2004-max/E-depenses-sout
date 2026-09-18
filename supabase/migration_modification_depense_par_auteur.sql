-- Migration : permet à l'auteur d'une dépense de la modifier lui-même tant
-- qu'elle est encore en_attente (pas déjà approuvée/refusée/décaissée), en
-- plus des approbateurs qui gardent le droit de tout modifier — à la demande
-- explicite de l'utilisateur (2026-09-18).
--
-- Remplace la policy UPDATE qui ne laissait passer QUE les approbateurs
-- (is_approbateur()). Le WITH CHECK exige que la dépense reste en_attente
-- après modification côté auteur : il ne peut donc pas se l'auto-approuver
-- via un appel API direct, même en contournant l'interface (qui n'affiche de
-- toute façon jamais les boutons Valider/Refuser à un non-approbateur — voir
-- peutApprouver dans DepenseDetailModal.jsx).
drop policy if exists "statut dépense modifiable par les approbateurs" on public.depenses;

create policy "dépenses modifiables par les approbateurs ou leur auteur tant qu'en attente" on public.depenses
  for update using (
    (public.is_approbateur() and public.has_module(secteur_id))
    or (cree_par = auth.uid() and statut = 'en_attente' and public.has_module(secteur_id))
  )
  with check (
    (public.is_approbateur() and public.has_module(secteur_id))
    or (cree_par = auth.uid() and statut = 'en_attente' and public.has_module(secteur_id))
  );
