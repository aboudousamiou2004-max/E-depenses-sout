# Mise en place de Supabase pour E-DÉPENSES

## 1. Créer le projet
Sur [supabase.com](https://supabase.com) → *New Project* → choisir une région → définir un mot de passe de base de données (à conserver, pas utilisé par l'app elle-même) → attendre la fin du provisioning.

## 2. Désactiver la confirmation par e-mail
*Authentication → Providers → Email* → désactiver **"Confirm email"**.
Nécessaire car l'app utilise des adresses synthétiques (`identifiant@e-depenses.local`) qui ne reçoivent jamais de vrai courrier.

## 3. Exécuter le script SQL
*SQL Editor → New query* → coller l'intégralité de [`schema.sql`](./schema.sql) → *Run*.
Ce script crée les tables, les vues, les fonctions, les triggers, active la sécurité par ligne (RLS) et insère les données de référence (secteurs, référentiels de stock). Aucune donnée factice de dépenses/recettes n'est insérée : la base démarre vide sur ces tables.

## 4. Créer le premier compte (super-administrateur)
1. *Authentication → Users → Add user* — e-mail `admin@e-depenses.local`, choisir un vrai mot de passe.
2. Copier l'UUID généré pour ce compte (colonne `UID` de la liste des utilisateurs).
3. Dans *SQL Editor*, exécuter (en remplaçant `<UUID>`) :
   ```sql
   insert into public.profiles (id, login, nom, role, poste, actif)
   values ('<UUID>', 'admin', 'Aboudou MOROU', 'super_admin', 'Super-administrateur', true);
   ```

## 5. Récupérer les identifiants du projet
*Project Settings → API* → copier :
- **Project URL**
- **anon / public key**

⚠️ Ne jamais copier la clé `service_role` dans l'application — elle donne un accès total qui contourne RLS.

## 6. Configurer l'application en local
Créer `.env.local` à la racine du projet (déjà ignoré par git via `*.local`) :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 7. Configurer Netlify (déploiement)
*Site settings → Environment variables* → ajouter les deux mêmes variables → **redéployer** (les variables Vite sont figées au build ; un redeploy sans nouveau build ne suffit pas — utiliser "Trigger deploy → Clear cache and deploy site").

## Pour vérifier que ça marche
- Se connecter avec `admin` / le mot de passe choisi à l'étape 4.
- Créer un secteur, une dépense, un utilisateur — tout doit apparaître immédiatement dans le tableau de bord.
- Aucune donnée ne doit apparaître avant la première connexion : c'est normal, la base démarre vide.
