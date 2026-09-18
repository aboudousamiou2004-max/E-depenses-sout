-- Migration : corrige deux failles trouvées par l'audit RLS du 2026-09-17.
--
-- 1) ÉLÉVATION DE PRIVILÈGES À L'INSCRIPTION (critique)
--    handle_new_user() faisait confiance à role/modules/actif/secteur envoyés
--    dans raw_user_meta_data lors de l'inscription (supabase.auth.signUp()).
--    Or signUp() est un point d'entrée PUBLIC, accessible avec la seule clé
--    anon (visible dans le bundle JS livré au navigateur) — n'importe qui
--    pouvait donc créer directement un compte 'super_admin' avec accès à
--    tous les modules, sans jamais passer par l'écran "Ajouter un
--    utilisateur" ni par la policy UPDATE de profiles (qui, elle, est bien
--    protégée par is_full_access()).
--
--    Correctif : l'inscription ne crée plus jamais qu'un compte inerte —
--    rôle 'agent', aucun module, désactivé. Le rôle/modules/secteur/statut
--    réels ne sont appliqués QU'ENSUITE, via une UPDATE authentifiée
--    (voir addUser() dans src/store/dataStore.js), qui passe par la policy
--    "profils modifiables par les rôles à accès total" — donc seulement si
--    l'appelant est réellement admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, login, nom, role, secteur, poste, telephone, actif, modules)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'login', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'nom', ''),
    'agent',
    null,
    '',
    '',
    false,
    '{}'
  );
  return new;
end;
$$;

-- 2) BUDGETS MODIFIABLES PAR N'IMPORTE QUEL RÔLE AYANT ACCÈS AU MODULE
--    Les policies INSERT/UPDATE/DELETE de budgets ne vérifiaient que
--    has_module(secteur_id), sans is_approbateur() — un simple agent
--    pouvait donc allouer/gonfler/supprimer le budget de son secteur, ce
--    qui compromet le circuit d'autorisation (seul le dépassement de
--    budget le déclenche désormais, voir migration_suppression_seuil_fixe.sql).
--
--    Attention : le GÉRANT du secteur doit garder le droit de confirmer la
--    réception d'un budget proposé (validerReceptionBudget dans
--    dataStore.js) — une vraie UPDATE sur cette table, distincte du droit
--    d'allouer/réviser librement (réservé aux approbateurs). La policy
--    UPDATE autorise donc les deux cas séparément ; INSERT/DELETE restent
--    réservés aux approbateurs (créer/supprimer un budget n'est jamais un
--    acte du gérant).
drop policy if exists "budgets créés selon accès module" on public.budgets;
create policy "budgets créés par les approbateurs selon accès module" on public.budgets
  for insert with check (public.is_approbateur() and public.has_module(secteur_id));

drop policy if exists "budgets mis à jour selon accès module" on public.budgets;
create policy "budgets mis à jour par les approbateurs ou confirmés par le gérant du secteur" on public.budgets
  for update using (
    (public.is_approbateur() and public.has_module(secteur_id))
    or (public.current_role_name() = 'gerant' and exists (
      select 1 from public.profiles where id = auth.uid() and secteur = budgets.secteur_id
    ))
  )
  with check (
    (public.is_approbateur() and public.has_module(secteur_id))
    or (public.current_role_name() = 'gerant' and exists (
      select 1 from public.profiles where id = auth.uid() and secteur = budgets.secteur_id
    ))
  );

drop policy if exists "budgets supprimables selon accès module" on public.budgets;
create policy "budgets supprimables par les approbateurs selon accès module" on public.budgets
  for delete using (public.is_approbateur() and public.has_module(secteur_id));
