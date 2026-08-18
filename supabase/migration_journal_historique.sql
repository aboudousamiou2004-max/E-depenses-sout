-- Migration : Journal et Historique par module — à la demande de
-- l'utilisateur (2026-08-18) : "ajoute les volets journal et historique au
-- niveau de tous les modules". Porté (simplifié) depuis les volets
-- Historique de termitiere-platform (agro/Historique.jsx,
-- depense/Historique.jsx) : période + filtres + totaux.
--
-- Journal : le journal d'audit existe déjà (table `journal`, lecture
-- réservée aux rôles à accès total — cf. schema.sql) mais son `module` est
-- souvent une valeur libre ('E-DÉPENSES' pour toutes les dépenses/recettes/
-- budgets, quel que soit le secteur) — impossible à filtrer fiablement par
-- module. Ajoute une colonne `secteur_id` structurée et la fait renseigner
-- par les triggers déjà en place, pour que chaque module affiche SON
-- journal (directeurs/administration uniquement, même accès qu'avant).
--
-- Historique : ne nécessite aucune nouvelle donnée — dépenses et recettes
-- ont déjà `secteur_id` ; le volet n'est qu'un filtre (période/type/texte)
-- sur les données déjà chargées, ouvert à qui a déjà accès au module
-- (mêmes droits que Dépenses/Prestations).

alter table public.journal add column secteur_id text references public.secteurs(id);

create or replace function public.journaliser_depense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_secteur_nom text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = coalesce(new.secteur_id, old.secteur_id);
  if tg_op = 'INSERT' then
    insert into public.journal (user_id, user_nom, role, module, action, details, secteur_id)
    values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', 'Saisie dépense',
            new.categorie || ' — ' || coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant || ' FCFA', new.secteur_id);
  elsif tg_op = 'UPDATE' and old.statut is distinct from new.statut then
    v_action := case new.statut
      when 'approuvee' then 'Approbation dépense'
      when 'refusee' then 'Refus dépense'
      when 'decaissee' then 'Décaissement'
      else 'Modification dépense' end;
    insert into public.journal (user_id, user_nom, role, module, action, details, secteur_id)
    values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action,
            new.categorie || ' — ' || coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant || ' FCFA', new.secteur_id);
  end if;
  return new;
end;
$$;

create or replace function public.journaliser_recette()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_secteur_nom text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
  insert into public.journal (user_id, user_nom, role, module, action, details, secteur_id)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', 'Saisie recette',
          coalesce(new.origine, '') || ' — ' || coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant || ' FCFA', new.secteur_id);
  return new;
end;
$$;

create or replace function public.journaliser_budget_revision()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_secteur_nom text; v_action text; v_details text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
  if tg_op = 'INSERT' then
    v_action := 'Budget alloué'; v_details := coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant || ' FCFA';
  elsif new.statut_validation = 'en_attente' and (old.statut_validation is distinct from new.statut_validation) then
    v_action := 'Budget proposé'; v_details := coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant_propose || ' FCFA proposés';
  elsif old.statut_validation = 'en_attente' and new.statut_validation is null then
    v_action := 'Réception budget confirmée'; v_details := coalesce(v_secteur_nom, new.secteur_id) || ' — ' || new.montant || ' FCFA confirmés';
  elsif old.montant is distinct from new.montant and new.statut_validation is null then
    v_action := 'Budget révisé';
    v_details := coalesce(v_secteur_nom, new.secteur_id) || ' — ' || old.montant || ' → ' || new.montant || ' FCFA';
  else
    return new;
  end if;
  insert into public.journal (user_id, user_nom, role, module, action, details, secteur_id)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action, v_details, new.secteur_id);
  return new;
end;
$$;

create or replace function public.journaliser_foncier_dossier()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_action := case tg_op when 'INSERT' then 'Dossier foncier créé'
                          when 'UPDATE' then 'Dossier foncier modifié'
                          when 'DELETE' then 'Dossier foncier supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details, secteur_id)
  values (auth.uid(), v_nom, v_role, 'E-FONCIER', v_action, coalesce(new.numero, old.numero, '') || ' — ' || coalesce(new.commune, old.commune, ''), 'foncier');
  return coalesce(new, old);
end;
$$;

create or replace function public.journaliser_egpro_projet()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_action := case tg_op when 'INSERT' then 'Projet créé'
                          when 'UPDATE' then 'Projet modifié'
                          when 'DELETE' then 'Projet supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details, secteur_id)
  values (auth.uid(), v_nom, v_role, 'E-G.PRO', v_action, coalesce(new.num, old.num, '') || ' — ' || coalesce(new.nom, old.nom, ''), 'egpro');
  return coalesce(new, old);
end;
$$;

create or replace function public.journaliser_besoin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_secteur_nom text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = coalesce(new.secteur_id, old.secteur_id);
  v_action := case tg_op when 'INSERT' then 'Besoin créé'
                          when 'UPDATE' then 'Besoin modifié'
                          when 'DELETE' then 'Besoin supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details, secteur_id)
  values (auth.uid(), v_nom, v_role, coalesce(v_secteur_nom, 'Besoins'), v_action, coalesce(new.titre, old.titre, ''), coalesce(new.secteur_id, old.secteur_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.journaliser_garderie_paiement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_enfant text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select (nom || ' ' || prenom) into v_enfant from public.garderie_enfants where id = new.enfant_id;
  insert into public.journal (user_id, user_nom, role, module, action, details, secteur_id)
  values (auth.uid(), v_nom, v_role, 'E-GARDERIE', 'Paiement enregistré', coalesce(v_enfant, '') || ' — ' || new.montant || ' FCFA (' || new.mois || ')', 'garderie');
  return new;
end;
$$;

create or replace function public.journaliser_agro_sante()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_action := case tg_op when 'INSERT' then 'Intervention sanitaire enregistrée'
                          when 'UPDATE' then 'Intervention sanitaire modifiée'
                          when 'DELETE' then 'Intervention sanitaire supprimée' end;
  insert into public.journal (user_id, user_nom, role, module, action, details, secteur_id)
  values (auth.uid(), v_nom, v_role, 'MAXI AGRO', v_action,
          coalesce(new.espece_nom, old.espece_nom, '') || ' — ' || coalesce(new.produit, old.produit, ''), 'agro');
  return coalesce(new, old);
end;
$$;
