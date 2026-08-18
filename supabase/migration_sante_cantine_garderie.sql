-- E-GARDERIE — Santé & Infirmerie et Cantine & Repas, à la demande
-- explicite de l'utilisateur (2026-08-18) qui a choisi ces deux volets
-- (+ Analyse & Pilotage, sans nouvelle table) parmi ceux du vrai portail,
-- en écartant Tâches et Besoins (aucun lien financier).
--
-- Simplifié par rapport à termitiere-platform/src/modules/garderie/
-- {Incidents.jsx,Cantine.jsx} : pas de niveaux d'alarme (0-3) sur les
-- incidents (juste gravité + résolu), pas de carnet de vaccination (PEV
-- complet — trop lourd pour ce projet), pas de suivi horaire d'entrée/
-- sortie infirmerie. La cantine reste un menu du jour + décompte d'appétit
-- par enfant (pas de distinction menu/spécial/apporté comme sur la
-- plateforme).

create table public.garderie_incidents (
  id uuid primary key default gen_random_uuid(),
  enfant_id uuid not null references public.garderie_enfants(id) on delete cascade,
  type text not null check (type in ('accident','maladie','allergie','fugue','conflit','autre')),
  gravite text not null default 'faible' check (gravite in ('faible','moyen','grave')),
  date date not null,
  description text not null default '',
  mesures_prises text not null default '',
  parent_prevenu boolean not null default false,
  resolu boolean not null default false,
  cree_par uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.garderie_soins (
  id uuid primary key default gen_random_uuid(),
  enfant_id uuid not null references public.garderie_enfants(id) on delete cascade,
  type text not null check (type in ('medicament','temperature','bobo','vaccination','visite','autre')),
  date date not null,
  description text not null default '',
  temperature numeric,
  medicament text not null default '',
  dosage text not null default '',
  autorisation_parent boolean not null default false,
  parent_prevenu boolean not null default false,
  a_suivre boolean not null default false,
  notes text not null default '',
  cree_par uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.garderie_menus (
  date date primary key,
  petit_dejeuner text not null default '',
  dejeuner text not null default '',
  gouter text not null default ''
);

create table public.garderie_repas (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  enfant_id uuid not null references public.garderie_enfants(id) on delete cascade,
  appetit text not null default 'bien' check (appetit in ('bien','peu','refus')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (date, enfant_id)
);

alter table public.garderie_incidents enable row level security;
alter table public.garderie_soins enable row level security;
alter table public.garderie_menus enable row level security;
alter table public.garderie_repas enable row level security;

create policy "garderie incidents lisibles" on public.garderie_incidents for select using (public.has_module('garderie'));
create policy "garderie incidents créés" on public.garderie_incidents for insert with check (public.has_module('garderie'));
create policy "garderie incidents modifiables" on public.garderie_incidents for update using (public.has_module('garderie'));

create policy "garderie soins lisibles" on public.garderie_soins for select using (public.has_module('garderie'));
create policy "garderie soins créés" on public.garderie_soins for insert with check (public.has_module('garderie'));
create policy "garderie soins modifiables" on public.garderie_soins for update using (public.has_module('garderie'));

create policy "garderie menus lisibles" on public.garderie_menus for select using (public.has_module('garderie'));
create policy "garderie menus modifiables" on public.garderie_menus for insert with check (public.has_module('garderie'));
create policy "garderie menus mis à jour" on public.garderie_menus for update using (public.has_module('garderie'));

create policy "garderie repas lisibles" on public.garderie_repas for select using (public.has_module('garderie'));
create policy "garderie repas créés" on public.garderie_repas for insert with check (public.has_module('garderie'));
create policy "garderie repas modifiables" on public.garderie_repas for update using (public.has_module('garderie'));

grant select, insert, update on public.garderie_incidents to authenticated;
grant select, insert, update on public.garderie_soins to authenticated;
grant select, insert, update on public.garderie_menus to authenticated;
grant select, insert, update on public.garderie_repas to authenticated;
