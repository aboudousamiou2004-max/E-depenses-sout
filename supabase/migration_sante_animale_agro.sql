-- Migration : Santé animale MAXI AGRO — portée depuis
-- termitiere-platform/src/modules/agro/Sante.jsx (interventions
-- vaccination/traitement, stock de vaccins/produits, rendez-vous de suivi,
-- bilan), à la demande explicite de l'utilisateur (2026-08-17). Domaine
-- entièrement nouveau, pas de table existante à réutiliser ici.

create table public.agro_vaccins (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  type text not null default 'Vaccin',
  quantite integer not null default 0,
  unite text not null default 'unités',
  seuil_alerte integer not null default 0,
  peremption date,
  note text not null default '',
  cree_par_nom text,
  created_at timestamptz not null default now()
);

create table public.agro_sante (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  espece_id text not null references public.referentiel_animaux(id),
  espece_nom text not null default '',
  type text not null check (type in ('vaccination','traitement','deparasitage','autre')),
  produit text not null default '',
  produit_stock_id uuid references public.agro_vaccins(id),
  quantite_utilisee integer not null default 0,
  dosage text not null default '',
  veterinaire text not null default '',
  nombre_animaux integer not null default 1,
  animaux_ids text not null default '',
  prochain_rdv date,
  rdv_note text not null default '',
  rdv_fait boolean not null default false,
  description text not null default '',
  cree_par uuid references public.profiles(id),
  cree_par_nom text,
  created_at timestamptz not null default now()
);

alter table public.agro_vaccins enable row level security;
alter table public.agro_sante enable row level security;

create policy "agro vaccins lisibles" on public.agro_vaccins for select using (public.has_module('agro'));
create policy "agro vaccins créés" on public.agro_vaccins for insert with check (public.has_module('agro'));
create policy "agro vaccins modifiables" on public.agro_vaccins for update using (public.has_module('agro')) with check (public.has_module('agro'));
create policy "agro vaccins supprimables" on public.agro_vaccins for delete using (public.has_module('agro'));

create policy "agro sante lisible" on public.agro_sante for select using (public.has_module('agro'));
create policy "agro sante créée" on public.agro_sante for insert with check (public.has_module('agro'));
create policy "agro sante modifiable" on public.agro_sante for update using (public.has_module('agro')) with check (public.has_module('agro'));
create policy "agro sante supprimable" on public.agro_sante for delete using (public.has_module('agro'));

grant select, insert, update, delete on public.agro_vaccins to authenticated;
grant select, insert, update, delete on public.agro_sante to authenticated;

create or replace function public.journaliser_agro_sante()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  v_action := case tg_op when 'INSERT' then 'Intervention sanitaire enregistrée'
                          when 'UPDATE' then 'Intervention sanitaire modifiée'
                          when 'DELETE' then 'Intervention sanitaire supprimée' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'MAXI AGRO', v_action,
          coalesce(new.espece_nom, old.espece_nom, '') || ' — ' || coalesce(new.produit, old.produit, ''));
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_agro_sante
after insert or update or delete on public.agro_sante
for each row execute function public.journaliser_agro_sante();
