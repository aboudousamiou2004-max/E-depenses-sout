import { createClient } from "@supabase/supabase-js";

// Client Supabase unique de l'application — la clé "anon" est publique par
// design (elle finit dans le bundle JS livré au navigateur), ce n'est pas un
// secret. La vraie barrière de sécurité, c'est la Row Level Security (RLS)
// définie dans supabase/schema.sql, pas le fait de cacher cette clé.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

// `supabase` reste null tant que la config est absente — App.jsx affiche un
// écran de configuration dédié dans ce cas plutôt que de laisser planter
// l'app en page blanche au premier appel réseau.
export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;

// Domaine synthétique utilisé pour transformer l'« identifiant » affiché dans
// l'UI en e-mail Supabase Auth — voir supabase/schema.sql (handle_new_user)
// et authStore.js.
export const AUTH_EMAIL_DOMAIN = "e-depenses.local";
export const loginToEmail = (login) => `${login.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
