-- MAXI LOGISTIQUE — Analyses (rentabilité locative), à la demande de
-- l'utilisateur (2026-08-18).
--
-- Bug découvert au passage : recettes.origine a une contrainte figée sur 4
-- valeurs ('Vente','Prestation','Facturation client','Subvention'), mais
-- BusinessFacturation.jsx écrit depuis le début des libellés dynamiques
-- pour la Location (« Location — X (3j) ») et la Vente de briques
-- (« Vente de briques — Y ») — ces insertions échouaient donc en base
-- (jamais remarqué : la table recettes était encore vide). Contrainte
-- retirée ; origine redevient un libellé libre, cohérent avec l'usage réel.
--
-- Ajoute aussi le lien structuré vers l'article loué (article_id, quantité,
-- jours) sur les recettes de type Location, pour que le futur volet
-- Analyses de MAXI LOGISTIQUE puisse calculer le CA par article et le taux
-- d'utilisation sans reparser le texte d'origine.

alter table public.recettes drop constraint if exists recettes_origine_check;

alter table public.recettes add column article_id text references public.referentiel_materiel(id);
alter table public.recettes add column quantite numeric;
alter table public.recettes add column jours numeric;

-- Second bug trouvé au passage : le formulaire "Nouvelle facture" saisit un
-- client et une description (affichés dans la liste : colonne « Client »),
-- mais addRecette() ne les a jamais insérés — recettes n'a même pas ces
-- colonnes. Toutes les factures existantes affichaient donc "—" en client.
alter table public.recettes add column client text not null default '';
alter table public.recettes add column description text not null default '';
