-- Migration : Dashboard MAXI AGRO complet (indicateurs + graphiques), porté
-- depuis termitiere-platform/src/modules/agro/Dashboard.jsx, à la demande
-- explicite de l'utilisateur (2026-08-18, fidèle à 100%).
--
-- Le taux de létalité et le taux de morbidité ont besoin d'un décompte
-- journalier des animaux MALADES par espèce — volontairement laissé de côté
-- lors de la construction de la Saisie journalière (simplification assumée
-- à l'époque). Cette table comble ce manque : une ligne par (espèce, date),
-- comme EF Initial/Final, mise à jour depuis Saisie journalière.

create table public.agro_malades (
  espece_id text not null references public.referentiel_animaux(id),
  date date not null,
  quantite integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (espece_id, date)
);

alter table public.agro_malades enable row level security;

create policy "agro malades lisible" on public.agro_malades for select using (public.has_module('agro'));
create policy "agro malades modifiable" on public.agro_malades for insert with check (public.has_module('agro'));
create policy "agro malades mise a jour" on public.agro_malades for update using (public.has_module('agro')) with check (public.has_module('agro'));

grant select, insert, update on public.agro_malades to authenticated;
