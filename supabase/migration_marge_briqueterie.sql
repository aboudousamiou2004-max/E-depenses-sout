-- Migration : Marge & Bénéfice — E-BRIQUETERIE. Porté depuis
-- termitiere-platform/src/modules/evenementiel/{Marge.jsx,logic.js}, à la
-- demande explicite de l'utilisateur (2026-08-17) : la briqueterie suit déjà
-- ses ventes (recettes) mais n'a aucune idée de ce qu'elles coûtent à
-- produire — cette migration comble ce trou.
--
-- Formule (identique à termitiere-platform) : coût matériel d'UNE brique =
-- prix d'un sac de ciment ÷ rendement du type (nombre de briques produites
-- avec un sac). Bénéfice = recette − (quantité vendue × coût matériel).
--
-- Contrairement à un ajout de `cout_achat` sur `referentiel_matieres` (plus
-- complexe : il faudrait un « recette » de fabrication par type de brique,
-- qui n'existe pas dans ce projet), on réutilise le calcul déjà éprouvé de
-- termitiere-platform, basé sur un prix de référence du sac de ciment
-- (paramétrable) et un rendement par type — pas de nouvelle table de recette
-- de fabrication à inventer.
--
-- Les ventes de briques existent déjà dans `journal_briques` (action='vente',
-- avec type_id + quantite) — aucune nouvelle table de vente nécessaire, la
-- vue Marge se calcule directement dessus.

alter table public.types_briques add column if not exists rendement numeric not null default 0;

create policy "types briques modifiables" on public.types_briques
  for update using (public.has_module('briqueterie')) with check (public.has_module('briqueterie'));
grant update on public.types_briques to authenticated;

create table public.briqueterie_config (
  id text primary key default 'defaut',
  prix_sac_ciment numeric not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.briqueterie_config (id, prix_sac_ciment) values ('defaut', 0);

alter table public.briqueterie_config enable row level security;
create policy "briqueterie config lisible" on public.briqueterie_config for select using (public.has_module('briqueterie'));
create policy "briqueterie config modifiable" on public.briqueterie_config for update using (public.has_module('briqueterie')) with check (public.has_module('briqueterie'));
grant select, update on public.briqueterie_config to authenticated;
