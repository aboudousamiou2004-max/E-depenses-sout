-- Correctif : suppression d'un secteur de test impossible depuis Paramètres.
--
-- Cause : `motifs_suppression.secteur_id` référence `secteurs(id)` sans
-- `on delete`, donc RESTRICT par défaut. Or `confirmerSuppression` (côté
-- client) enregistre TOUJOURS le motif AVANT d'appeler la suppression du
-- secteur lui-même — la ligne d'audit qu'on vient de créer référence donc le
-- secteur qu'on essaie de supprimer dans la foulée, et PostgreSQL bloque
-- (erreur 23503) dès la toute première tentative, même sur un secteur de
-- test sans aucune autre donnée réelle rattachée.
--
-- Correctif : `on delete set null` — l'audit garde son motif et le libellé
-- de l'élément (capturés au moment du clic, indépendants de la ligne
-- supprimée), seul le lien vers le secteur devenu inexistant est vidé.
-- Les vraies données (dépenses, recettes, budgets, catégories, profils
-- rattachés...) continuent, elles, de bloquer la suppression normalement —
-- seul ce blocage auto-infligé par l'audit est corrigé.

alter table public.motifs_suppression drop constraint if exists motifs_suppression_secteur_id_fkey;
alter table public.motifs_suppression
  add constraint motifs_suppression_secteur_id_fkey
  foreign key (secteur_id) references public.secteurs(id) on delete set null;
