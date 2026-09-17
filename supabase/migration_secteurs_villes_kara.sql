-- Migration : MAXI GYM et MAXI LOGISTIQUE existent en réalité à Lomé ET à
-- Kara, chacune avec ses propres données (clients, coachs, stock…), à la
-- demande explicite de l'utilisateur (2026-09-15) : « ses deux secteur on
-- deux poste à KARA et a LOME, donc dupplique les ». Le rattachement d'un
-- secteur « succursale » (ex. « MAXI GYM KARA ») au bon preset (icône,
-- volets) se fait déjà par préfixe de nom (`matchNom` dans
-- src/lib/modules.js) — aucun changement de code n'est nécessaire pour
-- MAXI GYM, dont toutes les tables sont déjà scopées par secteur_id.
--
-- MAXI LOGISTIQUE en revanche partageait un unique stock matériel
-- (`referentiel_materiel` / `mouvements_materiel`), sans notion de secteur —
-- cette migration lui ajoute `secteur_id`, rattache tout l'existant à Lomé
-- (le secteur historique) et laisse Kara démarrer avec un stock vide, comme
-- demandé.
--
-- ⚠️ Étape 1 : le secteur MAXI GYM existant est bien celui de LOMÉ, et le
-- secteur MAXI LOGISTIQUE existant est bien celui de LOMÉ (confirmé par
-- l'utilisateur) — on les renomme (même id, donc tout l'historique
-- dépenses/recettes/budgets reste attaché) et on crée les secteurs KARA.

update public.secteurs set nom = 'MAXI GYM LOMÉ' where nom = 'MAXI GYM';
update public.secteurs set nom = 'MAXI LOGISTIQUE LOMÉ' where nom = 'MAXI LOGISTIQUE';

insert into public.secteurs (id, nom, label, color, actif)
select 'maxi-gym-kara', 'MAXI GYM KARA', label, color, true
from public.secteurs where nom = 'MAXI GYM LOMÉ'
on conflict (id) do nothing;

insert into public.secteurs (id, nom, label, color, actif)
select 'logistique-kara', 'MAXI LOGISTIQUE KARA', label, color, true
from public.secteurs where nom = 'MAXI LOGISTIQUE LOMÉ'
on conflict (id) do nothing;

-- ⚠️ Étape 2 : séparer le stock matériel MAXI LOGISTIQUE par ville, sans
-- perdre l'historique — tout l'existant est rattaché à Lomé.
alter table public.referentiel_materiel add column if not exists secteur_id text references public.secteurs(id);
alter table public.mouvements_materiel add column if not exists secteur_id text references public.secteurs(id);

update public.referentiel_materiel set secteur_id = 'logistique' where secteur_id is null;
update public.mouvements_materiel set secteur_id = 'logistique' where secteur_id is null;

alter table public.referentiel_materiel alter column secteur_id set not null;
alter table public.mouvements_materiel alter column secteur_id set not null;

-- La vue de solde doit désormais exposer secteur_id pour que le client
-- puisse filtrer par secteur (même principe que les autres v_stock_*).
drop view if exists public.v_stock_materiel;
create view public.v_stock_materiel with (security_invoker = true) as
select
  r.id as article_id,
  r.secteur_id,
  greatest(0, r.init_quantite + coalesce(sum(
    case m.type
      when 'achat' then m.quantite
      when 'retour_ok' then m.quantite
      when 'sortie' then -m.quantite
      else 0
    end
  ), 0)) as solde
from public.referentiel_materiel r
left join public.mouvements_materiel m on m.article_id = r.id
group by r.id, r.secteur_id, r.init_quantite;

grant select on public.v_stock_materiel to authenticated;

-- Les policies étaient figées sur le module 'logistique' — désormais que
-- chaque ligne porte son propre secteur_id, la policy doit suivre CE
-- secteur (comme pour logistique_transports), sinon Kara resterait
-- invisible/inaccessible même une fois le module accordé à un utilisateur.
drop policy if exists "referentiel materiel lisible" on public.referentiel_materiel;
drop policy if exists "referentiel materiel modifiable" on public.referentiel_materiel;
drop policy if exists "mouvements materiel lisibles" on public.mouvements_materiel;
drop policy if exists "mouvements materiel créés" on public.mouvements_materiel;

create policy "referentiel materiel lisible" on public.referentiel_materiel for select using (public.has_module(secteur_id));
create policy "referentiel materiel modifiable" on public.referentiel_materiel for insert with check (public.has_module(secteur_id));
create policy "mouvements materiel lisibles" on public.mouvements_materiel for select using (public.has_module(secteur_id));
create policy "mouvements materiel créés" on public.mouvements_materiel for insert with check (public.has_module(secteur_id));

-- Étape 3 (rappel, à faire depuis Paramètres → Utilisateurs, pas en SQL) :
-- donner à chaque gérant/agent l'accès au bon secteur — « maxi-gym-kara »,
-- « maxi-gym » (= Lomé), « logistique-kara » ou « logistique » (= Lomé) —
-- selon sa ville, jamais les deux à la fois si les équipes sont séparées.
