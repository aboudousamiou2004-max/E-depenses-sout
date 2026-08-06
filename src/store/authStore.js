import { create } from "zustand";
import { supabase, supabaseConfigured, loginToEmail } from "../lib/supabaseClient";
import { useDataStore } from "./dataStore";
import { useStockStore } from "./stockStore";

// Même mapping snake_case → camelCase que dataStore.js (mapUser) — dupliqué en
// petit ici plutôt qu'importé, pour ne pas créer un couplage entre les deux
// stores au-delà de l'appel explicite à chargerTout()/reset() ci-dessous.
const mapProfil = (r) => ({
  uid: r.id,
  login: r.login,
  nom: r.nom,
  role: r.role,
  secteur: r.secteur,
  poste: r.poste,
  telephone: r.telephone,
  actif: r.actif,
  modules: r.modules || [],
});

// Wrapper autour de supabase.auth — contrairement à l'ancien store persisté en
// localStorage (dont la lecture était synchrone), la vérification de session
// Supabase est réellement asynchrone. `status` distingue explicitement "on ne
// sait pas encore" de "pas connecté", pour que les gardes de route (App.jsx,
// ModuleGuard) attendent la résolution avant de rediriger — sinon on aurait un
// flash de la page de connexion à chaque rechargement, même déjà connecté.
export const useAuthStore = create((set, get) => ({
  user: null,
  status: "loading", // "loading" | "authenticated" | "unauthenticated"

  init: () => {
    if (!supabaseConfigured) return; // App.jsx affiche l'écran de configuration dans ce cas.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) get().chargerProfil(data.session.user.id);
      else set({ status: "unauthenticated" });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) get().chargerProfil(session.user.id);
      else {
        set({ user: null, status: "unauthenticated" });
        useDataStore.getState().reset();
        useStockStore.getState().reset();
      }
    });
  },

  chargerProfil: async (uid) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (error || !data) {
      set({ user: null, status: "unauthenticated" });
      useDataStore.getState().reset();
      useStockStore.getState().reset();
      return;
    }
    set({ user: mapProfil(data), status: "authenticated" });
    useDataStore.getState().chargerTout(uid);
    useStockStore.getState().chargerTout();
  },

  // L'UI garde un champ "Identifiant" — en interne, on le transforme en e-mail
  // synthétique pour utiliser l'authentification e-mail/mot de passe standard
  // de Supabase (voir src/lib/supabaseClient.js et supabase/schema.sql).
  login: async (login, pass) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginToEmail(login || ""),
      password: pass || "",
    });
    if (error) return { ok: false, error: "Identifiant ou mot de passe incorrect" };
    await get().chargerProfil(data.user.id);
    const profil = get().user;
    if (profil && profil.actif === false) {
      await supabase.auth.signOut();
      set({ user: null, status: "unauthenticated" });
      return { ok: false, error: "Ce compte a été désactivé" };
    }
    return { ok: true };
  },

  // Recharge le profil depuis la base (utile après modification de ses propres
  // accès pendant que la session est ouverte).
  refresh: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) await get().chargerProfil(data.session.user.id);
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, status: "unauthenticated" });
  },
}));

useAuthStore.getState().init();
