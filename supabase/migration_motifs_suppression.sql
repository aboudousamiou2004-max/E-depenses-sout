-- Migration : motif obligatoire à chaque suppression, dans TOUT le logiciel
-- (à la demande explicite de l'utilisateur, 2026-09-14) : quel que soit
-- l'écran (dépenses, recettes, clients, coachs, transport, abonnements...),
-- cliquer sur Supprimer ouvre désormais une confirmation qui exige un motif
-- texte avant de procéder.
--
-- Choix : une table générique unique plutôt qu'une colonne par table cible.
-- L'élément supprimé disparaît définitivement (suppression physique, comme
-- partout ailleurs dans ce projet) — on ne peut donc pas y accrocher une
-- colonne "motif" après coup. Cette table garde une trace autonome
-- (libellé + montant si pertinent, capturés au moment du clic), indépendante
-- du sort de la ligne supprimée. Le trigger de journalisation existant sur
-- chaque table (ex. "Dépense supprimée") continue de fonctionner tel quel ;
-- ceci s'y ajoute, ça ne le remplace pas.

create table public.motifs_suppression (
  id uuid primary key default gen_random_uuid(),
  table_nom text not null,
  element_label text not null default '',
  motif text not null,
  secteur_id text references public.secteurs(id),
  user_id uuid not null references public.profiles(id),
  user_nom text not null default '',
  role text not null default '',
  created_at timestamptz not null default now()
);

alter table public.motifs_suppression enable row level security;

-- N'importe quel utilisateur connecté peut enregistrer SON motif — il n'y a
-- rien de sensible à protéger côté insert (au pire un motif vide bloqué côté
-- client), et bloquer l'insert bloquerait la suppression elle-même.
create policy "motifs de suppression insérables par l'auteur" on public.motifs_suppression
  for insert with check (auth.uid() = user_id);

-- Lecture réservée aux rôles à accès total (audit) — mêmes rôles que le
-- Journal global.
create policy "motifs de suppression lisibles par les rôles à accès total" on public.motifs_suppression
  for select using (public.is_full_access());

grant select, insert on public.motifs_suppression to authenticated;
