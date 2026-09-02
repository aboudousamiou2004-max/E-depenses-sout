create table if not exists public.garderie_journaliers (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  nom text not null,
  prenom text not null,
  age_approx text not null default '',
  parent_nom text not null default '',
  parent_contact text not null default '',
  nombre_jours numeric not null default 1,
  apporte_repas boolean not null default false,
  notes text not null default '',
  montant_paye numeric not null default 0,
  mode_paiement text not null default 'espece',
  cree_par uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.garderie_journaliers enable row level security;

create policy "garderie journaliers lisibles" on public.garderie_journaliers for select using (public.has_module('garderie'));
create policy "garderie journaliers créés" on public.garderie_journaliers for insert with check (public.has_module('garderie'));
create policy "garderie journaliers modifiables" on public.garderie_journaliers for update using (public.has_module('garderie')) with check (public.has_module('garderie'));
create policy "garderie journaliers supprimables" on public.garderie_journaliers for delete using (public.has_module('garderie'));

grant select, insert, update, delete on public.garderie_journaliers to authenticated;
