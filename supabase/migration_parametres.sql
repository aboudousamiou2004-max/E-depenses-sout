-- Migration : panneau Paramètres du module E-DÉPENSES
-- À exécuter dans Supabase SQL Editor (New query), après schema.sql.
-- Ajoute : seuil d'autorisation configurable, catégories de dépense par
-- secteur, et la possibilité de modifier/désactiver un secteur.

-- ----------------------------------------------------------------------------
-- 1. Secteurs : ajout d'un statut actif/inactif + policy de mise à jour
-- ----------------------------------------------------------------------------
alter table public.secteurs add column if not exists actif boolean not null default true;

create policy "modification de secteur réservée aux rôles à accès total" on public.secteurs
  for update using (public.is_full_access()) with check (public.is_full_access());

-- ----------------------------------------------------------------------------
-- 2. Paramètres applicatifs (ligne unique) : seuil d'autorisation
-- ----------------------------------------------------------------------------
create table public.app_config (
  id boolean primary key default true check (id),
  seuil_autorisation numeric not null default 30000
);
insert into public.app_config (id, seuil_autorisation) values (true, 30000);

alter table public.app_config enable row level security;

create policy "lecture des parametres par tous les connectés" on public.app_config
  for select using (auth.role() = 'authenticated');
create policy "modification des parametres reservee aux roles a acces total" on public.app_config
  for update using (public.is_full_access()) with check (public.is_full_access());

-- ----------------------------------------------------------------------------
-- 3. Catégories de dépense, propres à chaque secteur
-- ----------------------------------------------------------------------------
create table public.categories_depense (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now(),
  unique (secteur_id, nom)
);
alter table public.categories_depense enable row level security;

create policy "lecture des categories par tous les connectés" on public.categories_depense
  for select using (auth.role() = 'authenticated');
create policy "gestion des categories reservee aux roles a acces total" on public.categories_depense
  for all using (public.is_full_access()) with check (public.is_full_access());

-- seed : reprend les catégories génériques historiques pour chaque secteur existant
insert into public.categories_depense (secteur_id, nom)
select s.id, c.nom
from public.secteurs s
cross join (values
  ('Matériaux de construction'), ('Main d''œuvre'), ('Carburant'),
  ('Aliments bétail'), ('Vétérinaire & vaccins'), ('Matières premières'), ('Autre')
) as c(nom)
on conflict (secteur_id, nom) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Le trigger de calcul du statut lit désormais le seuil configurable
--    (remplace la constante 30000 codée en dur)
-- ----------------------------------------------------------------------------
create or replace function public.compute_depense_statut()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seuil numeric;
begin
  select seuil_autorisation into v_seuil from public.app_config limit 1;
  new.seuil := coalesce(v_seuil, 30000);
  new.statut := case when new.montant >= new.seuil then 'en_attente' else 'decaissee' end;
  new.cree_par := auth.uid();
  return new;
end;
$$;
