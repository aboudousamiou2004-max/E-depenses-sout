-- Migration : Projets & Tâches — E-G.PRO. Porté (simplifié) depuis
-- termitiere-platform/src/modules/projet/{Projets,Taches}.jsx, à la demande
-- explicite de l'utilisateur (2026-08-18), qui a choisi le scope
-- "Projets + Tâches" (recommandé, car rattachable aux dépenses) plutôt que
-- l'intégralité de la nav réelle (Planning, Documents, Galerie photos —
-- sans dimension dépenses, hors du scope de cette application).
--
-- Simplifié par rapport à termitiere-platform : pas de collaborateurs
-- multiples, pas de pièces jointes/commentaires/export PDF, pas
-- d'historique de révision du budget/montant (juste la valeur courante).
-- Le mécanisme central conservé : un versement (client sur un projet, ou
-- prestataire sur une tâche) reste rattachable, et un versement de tâche
-- crée directement une dépense réelle (colonnes ajoutées à `depenses`
-- ci-dessous), exactement comme sur la vraie plateforme.

create table public.egpro_projets (
  id uuid primary key default gen_random_uuid(),
  num text not null,
  nom text not null,
  type text not null default 'construction' check (type in ('construction','amenagement','informatique','commercial','evenementiel','autre')),
  statut text not null default 'planification' check (statut in ('planification','en_cours','en_pause','termine','annule')),
  priorite text not null default 'normale' check (priorite in ('basse','normale','haute','urgente')),
  responsable text not null default '',
  budget numeric not null default 0,
  date_debut date,
  date_fin date,
  duree_indeterminee boolean not null default false,
  pour_client boolean not null default true,
  client_nom text not null default '',
  client_telephone text not null default '',
  montant_contrat numeric not null default 0,
  usage_interne text not null default '',
  description text not null default '',
  cree_par uuid references public.profiles(id),
  cree_par_nom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.egpro_taches (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.egpro_projets(id) on delete cascade,
  titre text not null,
  phase text not null default '',
  assignee text not null default '',
  priorite text not null default 'normale' check (priorite in ('basse','normale','haute','urgente')),
  statut text not null default 'a_faire' check (statut in ('a_faire','en_cours','en_revision','bloquee','terminee','annulee')),
  date_debut date,
  echeance date,
  montant_prevu numeric,
  note text not null default '',
  prestataire_nom text not null default '',
  prestataire_metier text not null default '',
  prestataire_telephone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.egpro_versements_client (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.egpro_projets(id) on delete cascade,
  montant numeric not null check (montant >= 0),
  date date not null,
  note text not null default '',
  cree_par_nom text,
  created_at timestamptz not null default now()
);

-- Un versement à un prestataire (saisi depuis une tâche) est une dépense à
-- part entière — elle doit suivre le circuit d'autorisation normal et
-- apparaître dans le volet Dépenses, pas seulement dans la fiche du projet.
alter table public.depenses add column projet_id uuid references public.egpro_projets(id) on delete set null;
alter table public.depenses add column tache_id uuid references public.egpro_taches(id) on delete set null;

alter table public.egpro_projets enable row level security;
alter table public.egpro_taches enable row level security;
alter table public.egpro_versements_client enable row level security;

create policy "egpro projets lisibles" on public.egpro_projets for select using (public.has_module('egpro'));
create policy "egpro projets créés" on public.egpro_projets for insert with check (public.has_module('egpro'));
create policy "egpro projets modifiables" on public.egpro_projets for update using (public.has_module('egpro')) with check (public.has_module('egpro'));
create policy "egpro projets supprimables" on public.egpro_projets for delete using (public.has_module('egpro'));

create policy "egpro taches lisibles" on public.egpro_taches for select using (public.has_module('egpro'));
create policy "egpro taches créées" on public.egpro_taches for insert with check (public.has_module('egpro'));
create policy "egpro taches modifiables" on public.egpro_taches for update using (public.has_module('egpro')) with check (public.has_module('egpro'));
create policy "egpro taches supprimables" on public.egpro_taches for delete using (public.has_module('egpro'));

create policy "egpro versements client lisibles" on public.egpro_versements_client for select using (public.has_module('egpro'));
create policy "egpro versements client créés" on public.egpro_versements_client for insert with check (public.has_module('egpro'));
create policy "egpro versements client supprimables" on public.egpro_versements_client for delete using (public.has_module('egpro'));

grant select, insert, update, delete on public.egpro_projets to authenticated;
grant select, insert, update, delete on public.egpro_taches to authenticated;
grant select, insert, delete on public.egpro_versements_client to authenticated;

create or replace function public.journaliser_egpro_projet()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_action := case tg_op when 'INSERT' then 'Projet créé'
                          when 'UPDATE' then 'Projet modifié'
                          when 'DELETE' then 'Projet supprimé' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-G.PRO', v_action, coalesce(new.num, old.num, '') || ' — ' || coalesce(new.nom, old.nom, ''));
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_egpro_projet
after insert or update or delete on public.egpro_projets
for each row execute function public.journaliser_egpro_projet();
