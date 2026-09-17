-- Migration : volet « Transport », partagé par tout secteur avec
-- `transport: true` dans PRESETS (MAXI LOGISTIQUE, E-BRIQUETERIE — voir
-- src/lib/modules.js), table unique filtrée par secteur_id. Suivi
-- opérationnel des courses (client, heure de départ obligatoire, heure
-- d'arrivée optionnelle — renseignée à la main ou via le bouton « Arrivé »,
-- véhicule, chauffeur, statut), en complément de la facturation
-- Prestation/Location déjà générique — ce volet ne crée pas de recette, il
-- ne fait que suivre l'opération.

create table public.logistique_transports (
  id uuid primary key default gen_random_uuid(),
  secteur_id text not null references public.secteurs(id),
  client text not null default '',
  depart time,
  arrivee time,
  vehicule text not null default '',
  chauffeur text not null default '',
  montant numeric not null default 0,
  statut text not null default 'planifie' check (statut in ('planifie','en_cours','termine','annule')),
  date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.logistique_transports enable row level security;

create policy "transports lisibles selon accès module" on public.logistique_transports for select using (public.has_module(secteur_id));
create policy "transports créés selon accès module" on public.logistique_transports for insert with check (public.has_module(secteur_id));
create policy "transports modifiables selon accès module" on public.logistique_transports for update using (public.has_module(secteur_id)) with check (public.has_module(secteur_id));
create policy "transports supprimables selon accès module" on public.logistique_transports for delete using (public.has_module(secteur_id));

grant select, insert, update, delete on public.logistique_transports to authenticated;

create or replace function public.journaliser_transport()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_action text; v_secteur_nom text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select nom into v_secteur_nom from public.secteurs where id = coalesce(new.secteur_id, old.secteur_id);
  v_action := case tg_op when 'INSERT' then 'Course créée'
                          when 'UPDATE' then 'Course modifiée'
                          when 'DELETE' then 'Course supprimée' end;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, coalesce(v_secteur_nom, 'Transport'), v_action,
          coalesce(new.depart, old.depart, '') || ' → ' || coalesce(new.arrivee, old.arrivee, '(en cours)'));
  return coalesce(new, old);
end;
$$;

create trigger trg_journaliser_transport
after insert or update or delete on public.logistique_transports
for each row execute function public.journaliser_transport();

-- Rattachement optionnel d'une dépense à la course qui l'a occasionnée
-- (carburant, péage...) — mentionnée à la création de la course, ou ajoutée
-- ensuite depuis le bouton « + Dépense » sur la ligne de la course (voir
-- src/pages/business/Transport.jsx). Nullable : n'affecte aucune dépense
-- existante ni les dépenses saisies hors de ce volet.
alter table public.depenses add column if not exists transport_id uuid references public.logistique_transports(id) on delete set null;
create index if not exists idx_depenses_transport_id on public.depenses (transport_id) where transport_id is not null;
