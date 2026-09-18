-- Migration : badges "nouveauté" dans le menu latéral — un rond avec un chiffre
-- devant un volet dès qu'un AUTRE utilisateur y a ajouté quelque chose depuis ma
-- dernière visite (dépense, apport de budget...), même principe que
-- termitiere-platform (src/shared/nouveautes.js).
--
-- vues_volets mémorise, par utilisateur et par volet suivi, l'instant de ma
-- dernière visite. Le calcul du badge lui-même reste entièrement côté client
-- (voir src/lib/nouveautes.js) : pas de fonction serveur, juste une lecture/
-- écriture de "quand ai-je vu ce volet pour la dernière fois".
create table public.vues_volets (
  user_id uuid not null references public.profiles(id) on delete cascade,
  section text not null,
  vu timestamptz not null default now(),
  primary key (user_id, section)
);

alter table public.vues_volets enable row level security;
grant select, insert, update on public.vues_volets to authenticated;

create policy "chacun lit ses propres vues de volets" on public.vues_volets
  for select using (user_id = auth.uid());

create policy "chacun écrit ses propres vues de volets" on public.vues_volets
  for insert with check (user_id = auth.uid());

create policy "chacun met à jour ses propres vues de volets" on public.vues_volets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
