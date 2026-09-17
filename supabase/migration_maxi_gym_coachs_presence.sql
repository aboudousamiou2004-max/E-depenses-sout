-- Migration : MAXI GYM — jours de présence + heure d'arrivée pour les
-- coachs, et pointage de leur arrivée réelle chaque jour (voir capture
-- d'écran fournie par l'utilisateur, 2026-09-14) : un coach a un ou
-- plusieurs jours de présence dans la semaine et une heure d'arrivée
-- attendue ; l'agent le pointe « Arrivé » quand il se présente, et le
-- tableau de bord du secteur affiche les coachs attendus aujourd'hui avec
-- leur statut (attendu / en retard / arrivé à telle heure).

alter table public.gym_coachs add column if not exists jours_presence text[] not null default '{}';
alter table public.gym_coachs add column if not exists heure_arrivee time;

create table public.gym_coach_pointages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.gym_coachs(id) on delete cascade,
  date date not null default current_date,
  heure_reelle time not null,
  created_at timestamptz not null default now(),
  unique (coach_id, date)
);

alter table public.gym_coach_pointages enable row level security;

create policy "pointages coach lisibles selon accès module" on public.gym_coach_pointages for select using (
  exists (select 1 from public.gym_coachs c where c.id = gym_coach_pointages.coach_id and public.has_module(c.secteur_id))
);
create policy "pointages coach créés selon accès module" on public.gym_coach_pointages for insert with check (
  exists (select 1 from public.gym_coachs c where c.id = gym_coach_pointages.coach_id and public.has_module(c.secteur_id))
);
create policy "pointages coach supprimables selon accès module" on public.gym_coach_pointages for delete using (
  exists (select 1 from public.gym_coachs c where c.id = gym_coach_pointages.coach_id and public.has_module(c.secteur_id))
);

grant select, insert, delete on public.gym_coach_pointages to authenticated;

create or replace function public.journaliser_pointage_coach()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_secteur_nom text; v_coach_nom text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select c.nom, s.nom into v_coach_nom, v_secteur_nom
    from public.gym_coachs c join public.secteurs s on s.id = c.secteur_id
    where c.id = new.coach_id;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, coalesce(v_secteur_nom, 'MAXI GYM'), 'Coach pointé',
          coalesce(v_coach_nom, '') || ' : ' || to_char(new.heure_reelle, 'HH24:MI'));
  return new;
end;
$$;

create trigger trg_journaliser_pointage_coach
after insert on public.gym_coach_pointages
for each row execute function public.journaliser_pointage_coach();
