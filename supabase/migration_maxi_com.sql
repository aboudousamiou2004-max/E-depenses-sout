-- Migration : MAXI COM — volet « Campagnes », spécifique à ce secteur (voir
-- PRESETS["maxi-com"] dans src/lib/modules.js). Suivi par campagne (client,
-- budget, période, statut) en complément des dépenses/recettes déjà
-- génériques à tous les secteurs — plus fin que la seule liste de
-- dépenses/recettes pour piloter plusieurs projets de communication en
-- parallèle.

create table public.com_campagnes (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  nom text not null,
  client text not null default '',
  budget numeric not null default 0,
  statut text not null default 'a_venir' check (statut in ('a_venir','en_cours','terminee','annulee')),
  date_debut date,
  date_fin date,
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.com_campagnes enable row level security;

create policy "campagnes lisibles selon accès module" on public.com_campagnes for select using (public.has_module(secteur_id));
create policy "campagnes créées selon accès module" on public.com_campagnes for insert with check (public.has_module(secteur_id));
create policy "campagnes modifiables selon accès module" on public.com_campagnes for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));
create policy "campagnes supprimables selon accès module" on public.com_campagnes for delete using (public.has_module(secteur_id));

grant select, insert, update, delete on public.com_campagnes to authenticated;

create or replace function public.journaliser_campagne()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_secteur_nom text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = coalesce(new.secteur_id, old.secteur_id);
  v_action := case tg_op when 'INSERT' then 'Campagne créée'
                          when 'UPDATE' then 'Campagne modifiée'
                          when 'DELETE' then 'Campagne supprimée' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, coalesce(v_secteur_nom, 'MAXI COM'), v_action, coalesce(new.nom, old.nom, ''));
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_campagne
after insert or update or delete on public.com_campagnes
for each row execute function public.journaliser_campagne();
