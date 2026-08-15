-- Migration : suppression d'un utilisateur.
--
-- auth.users n'est pas exposé à PostgREST (schéma non accessible aux rôles
-- anon/authenticated), donc un simple `delete from` client-side est
-- impossible ici, contrairement aux autres suppressions (secteurs,
-- dépenses...). On passe par une fonction SECURITY DEFINER, seule autorisée
-- à toucher auth.users, réservée aux rôles à accès total.
--
-- La suppression de auth.users cascade sur public.profiles
-- (profiles_id_fkey ON DELETE CASCADE), mais PAS sur les tables qui
-- référencent profiles (dépenses, recettes, budgets, journal,
-- notifications, mouvements_* — toutes en NO ACTION) : si l'utilisateur a
-- la moindre trace financière, la suppression échoue avec une violation de
-- clé étrangère (23503), et le client doit alors proposer de désactiver le
-- compte plutôt que de le supprimer — même logique que supprimerSecteur.
create or replace function public.supprimer_utilisateur(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_access() then
    raise exception 'Suppression réservée aux rôles à accès total' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Impossible de supprimer son propre compte' using errcode = '42501';
  end if;
  delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function public.supprimer_utilisateur(uuid) to authenticated;
