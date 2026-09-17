-- Migration : élargit la notification de validation d'une dépense — à la
-- demande explicite de l'utilisateur (2026-09-17) : « tous qui ont accès à
-- ce module voient aussi l'alerte sur le dashboard » + « l'admin ou le
-- membre de la direction qui a validé reçoit aussi une notification disant
-- qu'il vient de valider une demande à la hauteur de ... ».
--
-- Jusqu'ici trg_notifier_statut_depense (schema.sql) ne notifiait QUE
-- l'auteur de la dépense (new.cree_par) à chaque changement de statut.
-- Cette version garde ce comportement pour refusee/decaissee, et AJOUTE,
-- uniquement à l'approbation ('approuvee') :
--  1. Une notification à tout le personnel actif rattaché au secteur
--     (public.profiles.secteur = new.secteur_id), pas seulement l'auteur.
--  2. Une notification de confirmation à la personne qui vient de valider
--     (auth.uid()), avec le montant validé.
create or replace function public.notifier_statut_depense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text;
  v_titre text;
  v_message text;
  v_auteur_nom text;
  v_secteur_nom text;
  r record;
begin
  if new.cree_par is null or old.statut = new.statut then
    return new;
  end if;
  select nom into v_auteur_nom from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = new.secteur_id;

  if new.statut = 'approuvee' then
    v_type := 'success'; v_titre := 'Dépense approuvée';
    v_message := new.categorie || ' · ' || new.montant || ' FCFA — approuvée par ' || coalesce(v_auteur_nom, 'le PAU/GE') || ', décaissement possible.';
  elsif new.statut = 'refusee' then
    v_type := 'danger'; v_titre := 'Dépense refusée';
    v_message := new.categorie || ' · ' || new.montant || ' FCFA — refusée par ' || coalesce(v_auteur_nom, 'le PAU/GE') || '.';
  elsif new.statut = 'decaissee' then
    v_type := 'success'; v_titre := 'Dépense décaissée';
    v_message := new.categorie || ' · ' || new.montant || ' FCFA — décaissement effectué.';
  else
    return new;
  end if;

  insert into public.notifications (destinataire_id, type, titre, message, lien)
  values (new.cree_par, v_type, v_titre, v_message, '/depense/depenses');

  if new.statut = 'approuvee' then
    for r in
      select id from public.profiles
      where secteur = new.secteur_id and actif and id is distinct from new.cree_par
    loop
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (r.id, v_type, v_titre, v_message, '/depense/depenses');
    end loop;

    if auth.uid() is not null then
      insert into public.notifications (destinataire_id, type, titre, message, lien)
      values (
        auth.uid(), 'success', 'Validation effectuée',
        'Vous venez de valider une demande de ' || new.montant || ' FCFA (' || new.categorie || ') pour ' || coalesce(v_secteur_nom, new.secteur_id) || '.',
        '/depense/autorisations'
      );
    end if;
  end if;

  return new;
end;
$$;
