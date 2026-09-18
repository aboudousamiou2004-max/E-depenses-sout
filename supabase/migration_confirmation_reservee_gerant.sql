-- Migration : la confirmation de réception d'un budget doit venir du gérant
-- du secteur concerné, jamais de l'administration qui l'a alloué — même si
-- un rôle à accès total (is_approbateur) a par ailleurs le droit de modifier
-- la ligne budgets. Précision apportée le 2026-09-18 : "c'est les acteurs du
-- module où on a alloué qui valident, pas l'admin... qui a alloué, et c'est
-- pareil pour tous les secteurs, même ceux pas encore ajoutés."
--
-- 1) Un trigger, en plus de la policy RLS existante (qui permet à
--    is_approbateur() de modifier budgets pour PROPOSER/réviser), bloque
--    spécifiquement la transition "confirmation de réception"
--    (montant_propose -> null) si l'auteur n'est pas le gérant DE CE
--    secteur précis — defense in depth, même schéma que
--    avant_update_besoin/empecher_suppression_besoin_valide sur besoins.
--    Générique par construction (compare juste profiles.secteur à
--    budgets.secteur_id) : couvre tout secteur, y compris ceux créés après
--    coup depuis Paramètres, sans modification supplémentaire.
--
-- 2) notifier_budget() notifiait déjà l'équipe du secteur à la confirmation,
--    mais pas l'administration — corrigé pour fan-out vers pau/ge/directeur/
--    super_admin en plus, avec la notification push navigateur automatique
--    (déjà câblée sur tout insert dans notifications, voir
--    migration_push_notifications.sql).

create or replace function public.reserver_confirmation_au_gerant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.statut_validation = 'en_attente'
     and new.statut_validation is null
     and new.montant is not distinct from old.montant_propose
     and not exists (
       select 1 from public.profiles
       where id = auth.uid() and role = 'gerant' and secteur = new.secteur_id
     )
  then
    raise exception 'Seul le gérant du secteur concerné peut confirmer la réception du budget.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_reserver_confirmation_au_gerant
before update on public.budgets
for each row execute function public.reserver_confirmation_au_gerant();

create or replace function public.notifier_budget()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_secteur_nom text;
  v_auteur_nom text;
  v_montant numeric;
  v_est_confirmation boolean;
  v_nouvelle_proposition boolean;
  v_allocation_directe boolean;
  r record;
begin
  v_est_confirmation := tg_op = 'UPDATE'
    and old.montant_propose is not null
    and new.montant_propose is null
    and new.montant is not distinct from old.montant_propose;

  v_nouvelle_proposition := new.montant_propose is not null
    and (tg_op = 'INSERT' or new.montant_propose is distinct from old.montant_propose);

  v_allocation_directe := not v_est_confirmation and not v_nouvelle_proposition
    and new.montant_propose is null and new.montant > 0
    and (tg_op = 'INSERT' or new.montant is distinct from old.montant);

  if not v_est_confirmation and not v_nouvelle_proposition and not v_allocation_directe then
    return new;
  end if;

  select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;
  select nom into v_auteur_nom from public.profiles where id = auth.uid();

  if v_est_confirmation then
    for r in select id from public.profiles where secteur = new.secteur_id and actif loop
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (r.id, 'success', 'Budget reçu — ' || coalesce(v_secteur_nom, new.secteur_id),
              'Réception de ' || new.montant || ' FCFA confirmée par ' || coalesce(v_auteur_nom, 'le gérant') || '.',
              '/depense/recettes');
    end loop;
    -- Nouveau : l'administration est notifiée que la somme allouée a bien
    -- été réceptionnée par le secteur (message push inclus, cf. en-tête).
    for r in select id from public.profiles where role in ('pau','ge','directeur','super_admin') and actif loop
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (r.id, 'success', 'Budget réceptionné — ' || coalesce(v_secteur_nom, new.secteur_id),
              coalesce(v_auteur_nom, 'Le gérant') || ' confirme avoir reçu ' || new.montant || ' FCFA.',
              '/depense/recettes');
    end loop;
    return new;
  end if;

  v_montant := coalesce(new.montant_propose, new.montant);

  for r in select id from public.profiles where role in ('pau','ge','directeur','super_admin') and actif loop
    insert into public.notifications (destinataire_id, type, titre, message, lien)
    values (r.id, 'info', 'Budget alloué — ' || coalesce(v_secteur_nom, new.secteur_id),
            coalesce(v_auteur_nom, 'Un administrateur') || ' a alloué ' || v_montant || ' FCFA à ' || coalesce(v_secteur_nom, new.secteur_id) || '.',
            '/depense/recettes');
  end loop;

  if v_nouvelle_proposition then
    for r in select id from public.profiles where role = 'gerant' and secteur = new.secteur_id and actif loop
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (r.id, 'warning', 'Budget à confirmer',
              v_montant || ' FCFA alloués à ' || coalesce(v_secteur_nom, new.secteur_id) || ' : confirme la réception.',
              '/depense/recettes');
    end loop;
  end if;

  return new;
end;
$$;
