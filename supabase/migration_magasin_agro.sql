-- MAXI AGRO — Magasin (matériel/machines + aliments/silo) et registre
-- individuel des animaux (bovins/ovins/caprins), à la demande explicite de
-- l'utilisateur (2026-08-18).
--
-- 1) Magasin matériel : même principe que referentiel_materiel/mouvements_materiel
--    (MAXI LOGISTIQUE), mais scopé à 'agro' — tracteur, brouette, pompe, groupe
--    électrogène, etc. Pas de tarif_location (ce n'est pas un parc de location).
-- 2) Magasin aliments (silo) : même principe, pour le stock d'aliments/divers du
--    cheptel (tourteau de maïs, son, sels, gasoil…) — cf.
--    termitiere-platform/src/modules/agro/data.js (ALIMENTS, DIVERS) et
--    Saisie.jsx (onglet « Aliments & Divers »), ici sorti en volet séparé
--    plutôt qu'en onglet de la Saisie journalière (qui reste dédiée au cheptel).
-- 3) Registre individuel : un identifiant par animal (bovins/ovins/caprins
--    uniquement — pas la volaille, jamais identifiée individuellement en usage
--    réel), pour pouvoir désigner PRÉCISÉMENT quel animal sort (vente/décès/
--    perte) ou reçoit un vaccin/traitement, plutôt qu'un simple décompte
--    agrégé par espèce.
--
-- Aucune donnée de démonstration insérée (référentiels vides au départ) —
-- cf. migration_reset_effectifs_agro.sql : l'utilisateur ne veut pas de
-- chiffres fictifs, l'ajout se fait depuis l'interface.

create table public.agro_materiel (
  id text primary key,
  nom text not null,
  cat text,
  unite text not null default 'unités',
  init_quantite numeric not null default 0
);

create table public.agro_mouvements_materiel (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  article_id text not null references public.agro_materiel(id),
  type text not null check (type in ('achat','sortie')),
  quantite numeric not null check (quantite > 0),
  motif text not null default '',
  agent_id uuid references public.profiles(id),
  agent_nom text,
  created_at timestamptz not null default now()
);

create view public.v_agro_materiel with (security_invoker = true) as
select
  r.id as article_id,
  greatest(0, r.init_quantite + coalesce(sum(
    case m.type when 'achat' then m.quantite when 'sortie' then -m.quantite else 0 end
  ), 0)) as solde
from public.agro_materiel r
left join public.agro_mouvements_materiel m on m.article_id = r.id
group by r.id, r.init_quantite;

create table public.agro_aliments (
  id text primary key,
  nom text not null,
  cat text,
  unite text not null default 'kg',
  init_quantite numeric not null default 0
);

create table public.agro_mouvements_aliments (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  article_id text not null references public.agro_aliments(id),
  type text not null check (type in ('achat','sortie')),
  quantite numeric not null check (quantite > 0),
  motif text not null default '',
  agent_id uuid references public.profiles(id),
  agent_nom text,
  created_at timestamptz not null default now()
);

create view public.v_agro_aliments with (security_invoker = true) as
select
  r.id as article_id,
  greatest(0, r.init_quantite + coalesce(sum(
    case m.type when 'achat' then m.quantite when 'sortie' then -m.quantite else 0 end
  ), 0)) as solde
from public.agro_aliments r
left join public.agro_mouvements_aliments m on m.article_id = r.id
group by r.id, r.init_quantite;

create table public.agro_animaux_individuels (
  id uuid primary key default gen_random_uuid(),
  espece_id text not null references public.referentiel_animaux(id),
  identifiant text not null,
  sexe text check (sexe in ('male','femelle')),
  date_entree date not null default current_date,
  statut text not null default 'actif' check (statut in ('actif','vendu','mort','perdu')),
  date_sortie date,
  motif_sortie text,
  notes text,
  created_at timestamptz not null default now(),
  unique (espece_id, identifiant)
);

alter table public.agro_materiel enable row level security;
alter table public.agro_mouvements_materiel enable row level security;
alter table public.agro_aliments enable row level security;
alter table public.agro_mouvements_aliments enable row level security;
alter table public.agro_animaux_individuels enable row level security;

create policy "agro materiel lisible" on public.agro_materiel for select using (public.has_module('agro'));
create policy "agro materiel modifiable" on public.agro_materiel for insert with check (public.has_module('agro'));
create policy "agro mouvements materiel lisibles" on public.agro_mouvements_materiel for select using (public.has_module('agro'));
create policy "agro mouvements materiel créés" on public.agro_mouvements_materiel for insert with check (public.has_module('agro'));

create policy "agro aliments lisibles" on public.agro_aliments for select using (public.has_module('agro'));
create policy "agro aliments modifiables" on public.agro_aliments for insert with check (public.has_module('agro'));
create policy "agro mouvements aliments lisibles" on public.agro_mouvements_aliments for select using (public.has_module('agro'));
create policy "agro mouvements aliments créés" on public.agro_mouvements_aliments for insert with check (public.has_module('agro'));

create policy "agro animaux individuels lisibles" on public.agro_animaux_individuels for select using (public.has_module('agro'));
create policy "agro animaux individuels créés" on public.agro_animaux_individuels for insert with check (public.has_module('agro'));
create policy "agro animaux individuels modifiables" on public.agro_animaux_individuels for update using (public.has_module('agro'));

grant select, insert on public.agro_materiel to authenticated;
grant select, insert on public.agro_mouvements_materiel to authenticated;
grant select on public.v_agro_materiel to authenticated;
grant select, insert on public.agro_aliments to authenticated;
grant select, insert on public.agro_mouvements_aliments to authenticated;
grant select on public.v_agro_aliments to authenticated;
grant select, insert, update on public.agro_animaux_individuels to authenticated;
