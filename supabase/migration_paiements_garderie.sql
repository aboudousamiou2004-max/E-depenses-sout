-- Migration : Enfants + Paiements — E-GARDERIE. Porté (simplifié) depuis
-- termitiere-platform/src/modules/garderie/{Enfants.jsx,Paiements.jsx,logic.js},
-- à la demande explicite de l'utilisateur (2026-08-17). E-GARDERIE n'avait
-- aucune donnée spécifique dans ce projet — uniquement le trio générique
-- Dashboard/Facturation/Dépenses.
--
-- Retenu : le moteur de revenu récurrent — un enfant, un tarif, un
-- historique de paiements par mois, détection des impayés.
-- Volontairement écarté (opérationnel, pas financier) : cantine, personnel,
-- incidents, présences, tâches — aucun n'a de dimension monétaire directe.

create table public.garderie_enfants (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null default '',
  date_naissance date,
  type_abonnement text not null default 'mensuel' check (type_abonnement in ('mensuel','annuel','court_sejour')),
  tarif numeric not null default 0,
  statut text not null default 'actif' check (statut in ('actif','suspendu','sorti')),
  cree_par uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.garderie_paiements (
  id uuid primary key default gen_random_uuid(),
  enfant_id uuid not null references public.garderie_enfants(id) on delete cascade,
  mois text not null, -- 'YYYY-MM'
  montant numeric not null check (montant >= 0),
  date date not null,
  mode_paiement text not null default 'espece' check (mode_paiement in ('espece','mobile','virement','cheque')),
  created_at timestamptz not null default now()
);

alter table public.garderie_enfants enable row level security;
alter table public.garderie_paiements enable row level security;

create policy "garderie enfants lisibles" on public.garderie_enfants for select using (public.has_module('garderie'));
create policy "garderie enfants créés" on public.garderie_enfants for insert with check (public.has_module('garderie'));
create policy "garderie enfants modifiables" on public.garderie_enfants for update using (public.has_module('garderie')) with check (public.has_module('garderie'));
create policy "garderie enfants supprimables" on public.garderie_enfants for delete using (public.has_module('garderie'));

create policy "garderie paiements lisibles" on public.garderie_paiements for select using (public.has_module('garderie'));
create policy "garderie paiements créés" on public.garderie_paiements for insert with check (public.has_module('garderie'));
create policy "garderie paiements supprimables" on public.garderie_paiements for delete using (public.has_module('garderie'));

grant select, insert, update, delete on public.garderie_enfants to authenticated;
grant select, insert, delete on public.garderie_paiements to authenticated;

create or replace function public.journaliser_garderie_paiement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom text; v_role text; v_enfant text;
begin
  select nom, role into v_nom, v_role from public.profiles where id = auth.uid();
  select (nom || ' ' || prenom) into v_enfant from public.garderie_enfants where id = new.enfant_id;
  insert into public.journal (user_id, user_nom, role, module, action, details)
  values (auth.uid(), v_nom, v_role, 'E-GARDERIE', 'Paiement enregistré', coalesce(v_enfant, '') || ' — ' || new.montant || ' FCFA (' || new.mois || ')');
  return new;
end;
$$;

create trigger trg_journaliser_garderie_paiement
after insert on public.garderie_paiements
for each row execute function public.journaliser_garderie_paiement();
