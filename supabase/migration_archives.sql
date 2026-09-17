-- Migration : volet Archives — à la demande explicite de l'utilisateur
-- (2026-09-15) : « on peut supprimer un module mais ses actions et
-- mouvements restent dans les archives » + « où va se loger toutes les
-- actions, les dépenses de plus de 1 an ».
--
-- Table générique (comme motifs_suppression) plutôt qu'une table par type de
-- donnée archivée : stocke un instantané JSON de la ligne d'origine
-- (dépense, recette ou entrée de journal), indépendant du sort de la ligne
-- vivante — le secteur qui l'a produite peut ensuite être réellement
-- supprimé sans rien perdre.
create table public.archives (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('depense', 'recette', 'journal')),
  secteur_nom text not null default '',
  date_origine date,
  motif text not null default '' check (motif in ('suppression_module', 'anciennete')),
  data jsonb not null,
  archived_by uuid references public.profiles(id),
  archived_by_nom text not null default '',
  created_at timestamptz not null default now()
);

create index archives_date_origine_idx on public.archives (date_origine);
create index archives_type_idx on public.archives (type);

alter table public.archives enable row level security;

-- Lecture et écriture réservées aux rôles à accès total (audit sensible,
-- mêmes rôles que le Journal global).
create policy "archives lisibles par les rôles à accès total" on public.archives
  for select using (public.is_full_access());
create policy "archives insérables par les rôles à accès total" on public.archives
  for insert with check (public.is_full_access());

grant select, insert on public.archives to authenticated;
