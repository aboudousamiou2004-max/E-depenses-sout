-- Migration : volet Caisse de E-DÉPENSES, suivi de la caisse courante
-- (alimentations en espèces et dépenses payées par la caisse), à la demande
-- explicite de l'utilisateur (2026-10-19).
--
-- Même principe que le compte bancaire (banque_mouvements) : un solde
-- d'ouverture (une seule ligne `ouverture = true`), puis des mouvements
-- datés dont le solde courant est calculé côté client. Chaque sortie peut
-- être rattachée à un secteur et à une catégorie pour suivre à quoi sert
-- l'argent de la caisse.
--
-- Règles d'accès alignées sur la révision du 2026-09-19 : lecture, saisie et
-- modification pour tout utilisateur ayant accès au module E-DÉPENSES,
-- suppression réservée aux rôles à accès total (is_full_access()).
-- N'oublie pas les GRANT au niveau table : sans eux PostgREST refuse la
-- requête avant même d'évaluer RLS (cf. migration_nouveaux_volets.sql).

create table public.caisse_mouvements (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('entree','sortie')),
  libelle text not null default '',
  secteur_id text references public.secteurs(id) on delete set null,
  categorie text not null default '',
  beneficiaire text not null default '',
  montant numeric not null check (montant >= 0),
  ouverture boolean not null default false,
  piece text not null default '',
  cree_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Au plus un solde d'ouverture, garanti par la base et pas seulement par le client.
create unique index caisse_une_seule_ouverture on public.caisse_mouvements (ouverture) where ouverture;

alter table public.caisse_mouvements enable row level security;

create policy "caisse lisible selon accès module" on public.caisse_mouvements
  for select using (public.has_module('depense'));
create policy "caisse créée selon accès module" on public.caisse_mouvements
  for insert with check (public.has_module('depense'));
create policy "caisse modifiable selon accès module" on public.caisse_mouvements
  for update using (public.has_module('depense')) with check (public.has_module('depense'));
create policy "caisse supprimable par les rôles à accès total" on public.caisse_mouvements
  for delete using (public.is_full_access());

grant select, insert, update, delete on public.caisse_mouvements to authenticated;

-- L'auteur d'un mouvement est toujours posé par le serveur, jamais accepté
-- tel que soumis par le client.
create or replace function public.renseigner_auteur_caisse()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.cree_par := auth.uid();
  return new;
end;
$$;

create trigger trg_renseigner_auteur_caisse
before insert on public.caisse_mouvements
for each row execute function public.renseigner_auteur_caisse();

-- Journal d'audit : chaque mouvement de caisse est tracé automatiquement.
create or replace function public.journaliser_caisse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_type text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_type := coalesce(new.type, old.type);
  v_action := case tg_op
    when 'INSERT' then case when v_type = 'sortie' then 'Dépense de caisse enregistrée' else 'Dotation de caisse enregistrée' end
    when 'UPDATE' then 'Mouvement de caisse modifié'
    when 'DELETE' then 'Mouvement de caisse supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-DÉPENSES', v_action,
          coalesce(new.libelle, old.libelle, '') || ' : ' || coalesce(new.montant, old.montant, 0) || ' FCFA');
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_caisse
after insert or update or delete on public.caisse_mouvements
for each row execute function public.journaliser_caisse();
