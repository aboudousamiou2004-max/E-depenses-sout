import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SECTEURS, BUDGETS, DEPENSES, RECETTES, JOURNAL, USERS, seuilApprobation } from "../data/seed";

// Basé sur crypto.randomUUID (pas un compteur de session) car cet état est
// persisté en localStorage : un compteur remis à zéro à chaque rechargement
// entrerait en collision avec des identifiants déjà enregistrés.
const nextId = (p) => `${p}_${crypto.randomUUID()}`;

export const useDataStore = create(
  persist(
    (set, get) => ({
      secteurs: SECTEURS,
      budgets: BUDGETS,
      depenses: DEPENSES,
      recettes: RECETTES,
      journal: JOURNAL,
      users: USERS,
      notifications: [],

      // Notification interne (cloche) — chaque ligne cible un seul destinataire
      // (uid). Pas de push navigateur réel ici (pas de backend/service worker
      // dans cette démo statique) : c'est l'équivalent en-app du système de
      // notifications de la vraie plateforme.
      addNotification: (payload) =>
        set((s) => ({
          notifications: [{ id: nextId("notif"), lu: false, timestamp: new Date().toISOString(), ...payload }, ...s.notifications],
        })),

      marquerNotificationLue: (id) =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, lu: true } : n)) })),

      marquerToutesNotificationsLues: (destinataireUid) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.destinataireUid === destinataireUid ? { ...n, lu: true } : n)),
        })),

      // Ajoute un utilisateur avec les modules auxquels il a accès — même principe
      // que sur la vraie plateforme (un profil + une liste de modules autorisés).
      addUser: (payload, auteur) => {
        const uid = nextId("u");
        const utilisateur = {
          uid,
          login: payload.login.trim(),
          nom: payload.nom.trim(),
          role: payload.role,
          secteur: payload.secteur || null,
          modules: payload.modules || [],
        };
        set((s) => ({ users: [...s.users, utilisateur] }));
        get().addJournal({
          userNom: auteur?.nom || "Utilisateur",
          role: auteur?.role || "admin",
          module: "E-DÉPENSES",
          action: "Ajout utilisateur",
          details: `${utilisateur.nom} (${utilisateur.login}) — accès : ${utilisateur.modules.join(", ") || "aucun module spécifique"}`,
        });
        return utilisateur;
      },

      modifierAccesUtilisateur: (uid, modules, auteur) => {
        set((s) => ({ users: s.users.map((u) => (u.uid === uid ? { ...u, modules } : u)) }));
        const u = get().users.find((x) => x.uid === uid);
        get().addJournal({
          userNom: auteur?.nom || "Utilisateur",
          role: auteur?.role || "admin",
          module: "E-DÉPENSES",
          action: "Modification accès",
          details: `${u?.nom || uid} — accès : ${modules.join(", ") || "aucun module spécifique"}`,
        });
      },

      addJournal: (entry) =>
        set((s) => ({
          journal: [{ id: nextId("j"), timestamp: new Date().toISOString(), ...entry }, ...s.journal],
        })),

      // Ajoute un nouveau secteur d'activité — disponible aussitôt dans tous les
      // sélecteurs (filtre, formulaires de dépense/recette) puisqu'ils lisent tous
      // `secteurs` depuis ce store.
      addSecteur: (payload, user) => {
        const base = (payload.nom || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "secteur";
        const existants = get().secteurs.map((s) => s.id);
        let id = base;
        let n = 2;
        while (existants.includes(id)) id = `${base}-${n++}`;
        const secteur = { id, nom: payload.nom, label: payload.label || payload.nom, color: payload.color || "#0A84FF" };
        set((s) => ({ secteurs: [...s.secteurs, secteur] }));
        get().addJournal({
          userNom: user?.nom || "Utilisateur",
          role: user?.role || "admin",
          module: "E-DÉPENSES",
          action: "Ajout secteur",
          details: `Nouveau secteur créé : ${secteur.nom}`,
        });
        return secteur;
      },

      addDepense: (payload, user) => {
        const seuil = seuilApprobation();
        const statut = payload.montant >= seuil ? "en_attente" : "decaissee";
        const dep = { id: nextId("dep"), statut, seuil, creeParUid: user?.uid || null, ...payload };
        set((s) => ({ depenses: [dep, ...s.depenses] }));
        get().addJournal({
          userNom: user?.nom || "Utilisateur",
          role: user?.role || "agent",
          module: "E-DÉPENSES",
          action: "Saisie dépense",
          details: `${payload.categorie} — ${payload.secteurId} — ${payload.montant.toLocaleString("fr-FR")} FCFA`,
        });

        // Dépense au-dessus du seuil : PAU et GE reçoivent la demande d'autorisation
        // (avec son motif), et le demandeur reçoit une confirmation d'envoi.
        if (statut === "en_attente") {
          const secteur = get().secteurs.find((s) => s.id === payload.secteurId);
          const motif = payload.description?.trim() || "Aucun motif renseigné";
          get()
            .users.filter((u) => u.role === "pau" || u.role === "ge")
            .forEach((approbateur) => {
              get().addNotification({
                destinataireUid: approbateur.uid,
                type: "warning",
                titre: `Demande d'autorisation — ${secteur?.nom || payload.secteurId}`,
                message: `${payload.categorie} · ${dep.montant.toLocaleString("fr-FR")} FCFA · ${motif}`,
                lien: "/depense/autorisations",
              });
            });
          if (user?.uid) {
            get().addNotification({
              destinataireUid: user.uid,
              type: "info",
              titre: "Demande envoyée",
              message: `${payload.categorie} · ${dep.montant.toLocaleString("fr-FR")} FCFA — en attente de la décision du PAU ou de la GE.`,
              lien: "/depense/depenses",
            });
          }
        }
        return dep;
      },

      addRecette: (payload, user) => {
        const rec = { id: nextId("rec"), ...payload };
        set((s) => ({ recettes: [rec, ...s.recettes] }));
        get().addJournal({
          userNom: user?.nom || "Utilisateur",
          role: user?.role || "agent",
          module: "E-DÉPENSES",
          action: "Saisie recette",
          details: `${payload.origine} — ${payload.secteurId} — ${payload.montant.toLocaleString("fr-FR")} FCFA`,
        });
        return rec;
      },

      changerStatutDepense: (id, statut, user) => {
        set((s) => ({ depenses: s.depenses.map((d) => (d.id === id ? { ...d, statut } : d)) }));
        const dep = get().depenses.find((d) => d.id === id);
        get().addJournal({
          userNom: user?.nom || "Utilisateur",
          role: user?.role || "pau",
          module: "E-DÉPENSES",
          action: statut === "approuvee" ? "Approbation dépense" : statut === "refusee" ? "Refus dépense" : "Décaissement",
          details: `Dépense ${id} — ${dep ? dep.montant.toLocaleString("fr-FR") : ""} FCFA`,
        });

        // Le secteur demandeur est notifié en retour à chaque étape du circuit.
        if (dep?.creeParUid) {
          const montantTxt = dep.montant.toLocaleString("fr-FR");
          const infos = {
            approuvee: { type: "success", titre: "Dépense approuvée", message: `${dep.categorie} · ${montantTxt} FCFA — approuvée par ${user?.nom || "le PAU/GE"}, décaissement possible.` },
            refusee: { type: "danger", titre: "Dépense refusée", message: `${dep.categorie} · ${montantTxt} FCFA — refusée par ${user?.nom || "le PAU/GE"}.` },
            decaissee: { type: "success", titre: "Dépense décaissée", message: `${dep.categorie} · ${montantTxt} FCFA — décaissement effectué.` },
          }[statut];
          if (infos) {
            get().addNotification({ destinataireUid: dep.creeParUid, lien: "/depense/depenses", ...infos });
          }
        }
      },

      setBudget: (secteurId, annee, mois, montant, user) => {
        set((s) => {
          const exists = s.budgets.some((b) => b.secteurId === secteurId && b.annee === annee && b.mois === mois);
          const budgets = exists
            ? s.budgets.map((b) => (b.secteurId === secteurId && b.annee === annee && b.mois === mois ? { ...b, montant } : b))
            : [...s.budgets, { id: nextId("bud"), secteurId, annee, mois, montant }];
          return { budgets };
        });
        get().addJournal({
          userNom: user?.nom || "Utilisateur",
          role: user?.role || "gerant",
          module: "E-DÉPENSES",
          action: "Définition budget",
          details: `${secteurId} — ${mois + 1}/${annee} — ${montant.toLocaleString("fr-FR")} FCFA`,
        });
      },
    }),
    { name: "edepenses-data" }
  )
);
