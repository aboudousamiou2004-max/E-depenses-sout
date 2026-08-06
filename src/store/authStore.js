import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useDataStore } from "./dataStore";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      login: (login) => {
        const users = useDataStore.getState().users;
        const found = users.find((u) => u.login === login);
        if (!found) return { ok: false, error: "Identifiant ou mot de passe incorrect" };
        set({ user: found });
        return { ok: true };
      },
      // Recharge le profil depuis le store (utile après modification de ses propres
      // accès pendant que la session est ouverte).
      refresh: () =>
        set((s) => {
          if (!s.user) return {};
          const users = useDataStore.getState().users;
          const found = users.find((u) => u.uid === s.user.uid);
          return found ? { user: found } : {};
        }),
      logout: () => set({ user: null }),
    }),
    { name: "edepenses-auth" }
  )
);
