-- E-BRIQUETERIE — volet Matériel : équipement de l'exploitation qui peut
-- sortir en location (distinct du parc de MAXI LOGISTIQUE — chaque secteur
-- garde son propre référentiel, même convention que agro_materiel). À la
-- demande explicite de l'utilisateur (2026-08-18), avec les volets
-- Production et Matériaux (restructuration de l'ancien Stock de briques en
-- 3 pages dédiées).
--
-- Bug corrigé au passage : referentiel_matieres n'avait qu'un droit SELECT
-- (jamais INSERT) — impossible d'ajouter une nouvelle matière première
-- depuis l'interface malgré le nouveau volet Matériaux qui le permet.

create table public.briqueterie_materiel (
  id text primary key,
  nom text not null,
  cat text,
  unite text not null default 'unités',
  cout_achat numeric not null default 0,
  tarif_location numeric not null default 0,
  init_quantite numeric not null default 0
);

create table public.briqueterie_mouvements_materiel (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  article_id text not null references public.briqueterie_materiel(id),
  type text not null check (type in ('achat','sortie')),
  quantite numeric not null check (quantite > 0),
  motif text not null default '',
  agent_id uuid references public.profiles(id),
  agent_nom text,
  created_at timestamptz not null default now()
);

create view public.v_briqueterie_materiel with (security_invoker = true) as
select
  r.id as article_id,
  greatest(0, r.init_quantite + coalesce(sum(
    case m.type when 'achat' then m.quantite when 'sortie' then -m.quantite else 0 end
  ), 0)) as solde
from public.briqueterie_materiel r
left join public.briqueterie_mouvements_materiel m on m.article_id = r.id
group by r.id, r.init_quantite;

alter table public.briqueterie_materiel enable row level security;
alter table public.briqueterie_mouvements_materiel enable row level security;

create policy "briqueterie materiel lisible" on public.briqueterie_materiel for select using (public.has_module('briqueterie'));
create policy "briqueterie materiel modifiable" on public.briqueterie_materiel for insert with check (public.has_module('briqueterie'));
create policy "briqueterie mouvements materiel lisibles" on public.briqueterie_mouvements_materiel for select using (public.has_module('briqueterie'));
create policy "briqueterie mouvements materiel créés" on public.briqueterie_mouvements_materiel for insert with check (public.has_module('briqueterie'));

grant select, insert on public.briqueterie_materiel to authenticated;
grant select, insert on public.briqueterie_mouvements_materiel to authenticated;
grant select on public.v_briqueterie_materiel to authenticated;

-- referentiel_matieres : ajoute le droit INSERT manquant.
create policy "referentiel matieres modifiable" on public.referentiel_matieres for insert with check (public.has_module('briqueterie'));
grant insert on public.referentiel_matieres to authenticated;
