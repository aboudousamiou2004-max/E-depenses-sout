-- Migration : comptes rendus de la caisse (bouton « Compte effectué »), à la
-- demande explicite de l'utilisateur (2026-10-31).
--
-- Un compte par jour. `montant` reste NULL tant que le compte suit le total des
-- dépenses de caisse de ce jour (calculé côté application, donc mis à jour
-- automatiquement quand une dépense change) ; une valeur saisie à la main le fige.
--
-- Mêmes règles d'accès que caisse_mouvements : lecture, saisie et modification
-- pour tout utilisateur ayant accès au module E-DÉPENSES, suppression réservée
-- aux rôles à accès total. Script relançable sans risque.

create table if not exists public.caisse_comptes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  montant numeric check (montant is null or montant >= 0),
  note text not null default '',
  cree_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists caisse_comptes_une_par_date on public.caisse_comptes (date);

alter table public.caisse_comptes enable row level security;

drop policy if exists "comptes caisse lisibles selon accès module" on public.caisse_comptes;
create policy "comptes caisse lisibles selon accès module" on public.caisse_comptes
  for select using (public.has_module('depense'));

drop policy if exists "comptes caisse créés selon accès module" on public.caisse_comptes;
create policy "comptes caisse créés selon accès module" on public.caisse_comptes
  for insert with check (public.has_module('depense'));

drop policy if exists "comptes caisse modifiables selon accès module" on public.caisse_comptes;
create policy "comptes caisse modifiables selon accès module" on public.caisse_comptes
  for update using (public.has_module('depense')) with check (public.has_module('depense'));

drop policy if exists "comptes caisse supprimables par les rôles à accès total" on public.caisse_comptes;
create policy "comptes caisse supprimables par les rôles à accès total" on public.caisse_comptes
  for delete using (public.is_full_access());

grant select, insert, update, delete on public.caisse_comptes to authenticated;

-- L'auteur est toujours posé par le serveur.
create or replace function public.renseigner_auteur_caisse_compte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.cree_par := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_renseigner_auteur_caisse_compte on public.caisse_comptes;
create trigger trg_renseigner_auteur_caisse_compte
before insert on public.caisse_comptes
for each row execute function public.renseigner_auteur_caisse_compte();

-- Journal d'audit.
create or replace function public.journaliser_caisse_compte()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_montant numeric; v_date date;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_date := coalesce(new.date, old.date);
  v_montant := coalesce(new.montant, old.montant);
  v_action := case tg_op
    when 'INSERT' then 'Compte de caisse effectué'
    when 'UPDATE' then 'Compte de caisse modifié'
    when 'DELETE' then 'Compte de caisse supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action,
          to_char(v_date, 'DD/MM/YYYY') || ' : ' ||
          case when v_montant is null then 'reste en caisse du jour' else v_montant || ' FCFA' end);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_journaliser_caisse_compte on public.caisse_comptes;
create trigger trg_journaliser_caisse_compte
after insert or update or delete on public.caisse_comptes
for each row execute function public.journaliser_caisse_compte();

notify pgrst, 'reload schema';
