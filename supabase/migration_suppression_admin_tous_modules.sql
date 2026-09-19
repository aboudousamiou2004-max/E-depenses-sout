-- Migration : audit RLS complet suite à la révision du 2026-09-19 du bouton
-- Supprimer (désormais réservé partout à Directeur/PAU/Admin/GE, plus à
-- Superviseur/Gérant/Agent — voir lib/modules.js peutSupprimer()).
--
-- En auditant les policies RLS de chaque module métier, la plupart des
-- tables listées ci-dessous avaient une policy DELETE basée sur
-- has_module(...) — c'est-à-dire que N'IMPORTE QUEL utilisateur ayant accès
-- au module (agent compris) pouvait déjà supprimer ces lignes via un appel
-- direct à l'API, quel que soit ce qu'affichait le bouton côté écran. Le
-- masquage du bouton réduisait déjà le risque côté interface, mais ne
-- fermait pas la faille côté base. Cette migration aligne chaque policy
-- DELETE sur is_full_access() (Directeur/PAU/Admin/GE), pour les tables qui
-- exposent réellement un bouton Supprimer dans l'application (vérifié une
-- par une contre le code source avant d'écrire cette migration) :
--
--   com_campagnes, besoins, garderie_journaliers, garderie_enfants,
--   garderie_paiements, foncier_dossiers, foncier_frais, gym_clients,
--   gym_coachs, gym_abonnements, gym_pointages, egpro_projets,
--   egpro_versements_client, egpro_taches, agro_sante, agro_vaccins,
--   mouvements_animaux, logistique_transports, banque_mouvements.
--
-- Volontairement laissées de côté (pas de bouton Supprimer correspondant
-- dans l'app, donc pas concernées par la règle) : gym_coach_pointages
-- (aucune suppression exposée côté client), garderie_incidents/soins/
-- menus/repas, agro_materiel/aliments/mouvements/animaux_individuels,
-- referentiel_materiel, types_briques, briqueterie_config (aucune de ces
-- tables n'a de policy ni de GRANT DELETE du tout : la suppression y est
-- déjà impossible pour tout le monde, rien à resserrer).

drop policy if exists "campagnes supprimables selon accès module" on public.com_campagnes;
create policy "campagnes supprimables par les rôles à accès total" on public.com_campagnes
  for delete using (public.is_full_access());

drop policy if exists "besoins supprimables selon accès module" on public.besoins;
create policy "besoins supprimables par les rôles à accès total" on public.besoins
  for delete using (public.is_full_access());

drop policy if exists "garderie journaliers supprimables" on public.garderie_journaliers;
create policy "garderie journaliers supprimables par les rôles à accès total" on public.garderie_journaliers
  for delete using (public.is_full_access());

drop policy if exists "garderie enfants supprimables" on public.garderie_enfants;
create policy "garderie enfants supprimables par les rôles à accès total" on public.garderie_enfants
  for delete using (public.is_full_access());

drop policy if exists "garderie paiements supprimables" on public.garderie_paiements;
create policy "garderie paiements supprimables par les rôles à accès total" on public.garderie_paiements
  for delete using (public.is_full_access());

drop policy if exists "foncier dossiers supprimables" on public.foncier_dossiers;
create policy "foncier dossiers supprimables par les rôles à accès total" on public.foncier_dossiers
  for delete using (public.is_full_access());

drop policy if exists "foncier frais supprimables" on public.foncier_frais;
create policy "foncier frais supprimables par les rôles à accès total" on public.foncier_frais
  for delete using (public.is_full_access());

drop policy if exists "clients gym supprimables selon accès module" on public.gym_clients;
create policy "clients gym supprimables par les rôles à accès total" on public.gym_clients
  for delete using (public.is_full_access());

drop policy if exists "coachs gym supprimables selon accès module" on public.gym_coachs;
create policy "coachs gym supprimables par les rôles à accès total" on public.gym_coachs
  for delete using (public.is_full_access());

drop policy if exists "abonnements gym supprimables selon accès module" on public.gym_abonnements;
create policy "abonnements gym supprimables par les rôles à accès total" on public.gym_abonnements
  for delete using (public.is_full_access());

drop policy if exists "pointages gym supprimables selon accès module" on public.gym_pointages;
create policy "pointages gym supprimables par les rôles à accès total" on public.gym_pointages
  for delete using (public.is_full_access());

drop policy if exists "egpro projets supprimables" on public.egpro_projets;
create policy "egpro projets supprimables par les rôles à accès total" on public.egpro_projets
  for delete using (public.is_full_access());

drop policy if exists "egpro versements client supprimables" on public.egpro_versements_client;
create policy "egpro versements client supprimables par les rôles à accès total" on public.egpro_versements_client
  for delete using (public.is_full_access());

drop policy if exists "egpro taches supprimables" on public.egpro_taches;
create policy "egpro taches supprimables par les rôles à accès total" on public.egpro_taches
  for delete using (public.is_full_access());

drop policy if exists "agro sante supprimable" on public.agro_sante;
create policy "agro sante supprimable par les rôles à accès total" on public.agro_sante
  for delete using (public.is_full_access());

drop policy if exists "agro vaccins supprimables" on public.agro_vaccins;
create policy "agro vaccins supprimables par les rôles à accès total" on public.agro_vaccins
  for delete using (public.is_full_access());

drop policy if exists "mouvements animaux supprimables" on public.mouvements_animaux;
create policy "mouvements animaux supprimables par les rôles à accès total" on public.mouvements_animaux
  for delete using (public.is_full_access());

drop policy if exists "transports supprimables selon accès module" on public.logistique_transports;
create policy "transports supprimables par les rôles à accès total" on public.logistique_transports
  for delete using (public.is_full_access());

drop policy if exists "mouvements bancaires supprimables selon accès module" on public.banque_mouvements;
create policy "mouvements bancaires supprimables par les rôles à accès total" on public.banque_mouvements
  for delete using (public.is_full_access());
