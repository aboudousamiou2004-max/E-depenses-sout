-- Migration : Dossiers fonciers — E-FONCIER. Porté (simplifié) depuis
-- termitiere-platform/src/modules/foncier/{Dossiers.jsx,logic.js}, à la
-- demande explicite de l'utilisateur (2026-08-17). E-FONCIER n'avait
-- aucune donnée spécifique dans ce projet — uniquement le trio générique
-- Dashboard/Facturation/Dépenses.
--
-- Simplifié par rapport à termitiere-platform : pas de multiples types de
-- dossier avec modèles d'étapes différents (10 types, 8 workflows), pas
-- d'acteurs/pièces jointes, pas de grille d'appréciation de cession — juste
-- le mécanisme central de traçabilité des coûts : un dossier, une liste de
-- frais catégorisés, un total. C'est la partie « importante pour le suivi
-- financier » que l'utilisateur a demandé de retenir en priorité.

create table public.foncier_dossiers (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  type text not null default '',
  commune text not null default '',
  proprietaire text not null default '',
  date_ouverture date not null,
  statut text not null default 'ouvert' check (statut in ('ouvert','en_cours','cloture')),
  notes text not null default '',
  cree_par uuid references public.profiles(id),
  cree_par_nom text,
  created_at timestamptz not null default now()
);

create table public.foncier_frais (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.foncier_dossiers(id) on delete cascade,
  categorie text not null default 'autre' check (categorie in ('honoraires','administratif','transport','notaire','geometre','taxes','autre')),
  libelle text not null default '',
  montant numeric not null check (montant >= 0),
  date date not null,
  created_at timestamptz not null default now()
);

alter table public.foncier_dossiers enable row level security;
alter table public.foncier_frais enable row level security;

create policy "foncier dossiers lisibles" on public.foncier_dossiers for select using (public.has_module('foncier'));
create policy "foncier dossiers créés" on public.foncier_dossiers for insert with check (public.has_module('foncier'));
create policy "foncier dossiers modifiables" on public.foncier_dossiers for update using (public.has_module('foncier')) with check (public.has_module('foncier'));
create policy "foncier dossiers supprimables" on public.foncier_dossiers for delete using (public.has_module('foncier'));

create policy "foncier frais lisibles" on public.foncier_frais for select using (public.has_module('foncier'));
create policy "foncier frais créés" on public.foncier_frais for insert with check (public.has_module('foncier'));
create policy "foncier frais modifiables" on public.foncier_frais for update using (public.has_module('foncier')) with check (public.has_module('foncier'));
create policy "foncier frais supprimables" on public.foncier_frais for delete using (public.has_module('foncier'));

grant select, insert, update, delete on public.foncier_dossiers to authenticated;
grant select, insert, update, delete on public.foncier_frais to authenticated;

create or replace function public.journaliser_foncier_dossier()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_action := case tg_op when 'INSERT' then 'Dossier foncier créé'
                          when 'UPDATE' then 'Dossier foncier modifié'
                          when 'DELETE' then 'Dossier foncier supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-FONCIER', v_action, coalesce(new.numero, old.numero, '') || ' — ' || coalesce(new.commune, old.commune, ''));
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_foncier_dossier
after insert or update or delete on public.foncier_dossiers
for each row execute function public.journaliser_foncier_dossier();
