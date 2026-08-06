import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MATERIEL_DEFAUT, BRIQUES_DEFAUT, MATIERES_PREMIERES, ESPECES_DEFAUT, TYPES_MOUVEMENT_ANIMAL } from "../data/stockData";

// Basé sur crypto.randomUUID (pas un compteur de session) car cet état est
// persisté en localStorage : un compteur remis à zéro à chaque rechargement
// entrerait en collision avec des identifiants déjà enregistrés.
const nextId = (p) => `${p}_${crypto.randomUUID()}`;

// Stock initial de démarrage (avant tout mouvement enregistré) — équivalent à
// l'inventaire de reprise du vrai module, ici une simple valeur de départ par article.
// Quantités calibrées pour que la valeur totale du stock (qté × coût d'achat)
// reste sous 1 000 000 FCFA — même contrainte que les montants financiers.
const STOCK_INITIAL_MATERIEL = { tente_10x10: 3, table_ronde: 15, chaise_pliante: 80, sono_pack: 2, projecteur: 8, nappe: 25, assiette: 12 };
const STOCK_INITIAL_MATIERES = { ciment: 80, concasse: 30, sable: 45 };
const STOCK_INITIAL_BRIQUES = {
  b12_creux: { appatam: 400, sechage: 1200, pret: 2200, caillasses: 60 },
  b15_creux: { appatam: 200, sechage: 600, pret: 1200, caillasses: 30 },
  b20_creux: { appatam: 100, sechage: 300, pret: 600, caillasses: 15 },
  b12_plein: { appatam: 0, sechage: 150, pret: 350, caillasses: 10 },
};
const STOCK_INITIAL_ANIMAUX = { ovins: 85, bovins: 32, caprins: 60, poulets: 420, pintades: 140 };

export const useStockStore = create(
  persist(
    (set, get) => ({
      // ---------- MAXI LOGISTIQUE — matériel ----------
      referentielMateriel: MATERIEL_DEFAUT,
      mouvementsMateriel: [],

      // Solde d'un article = stock initial + achats + retours OK - sorties.
      // Les retours cassés/perdus sont tracés mais ne remontent pas dans le solde
      // disponible (fidèle à la logique de la plateforme réelle).
      stockArticle: (articleId) => {
        const init = STOCK_INITIAL_MATERIEL[articleId] || 0;
        const solde = get()
          .mouvementsMateriel.filter((m) => m.articleId === articleId)
          .reduce((acc, m) => {
            if (m.type === "achat" || m.type === "retour_ok") return acc + m.quantite;
            if (m.type === "sortie") return acc - m.quantite;
            return acc;
          }, init);
        return Math.max(0, solde);
      },

      ajouterArticleMateriel: (payload) => {
        const id = nextId("art");
        const article = { id, nom: payload.nom, cat: payload.cat, unite: payload.unite || "unités", coutAchat: Number(payload.coutAchat) || 0 };
        set((s) => ({ referentielMateriel: [...s.referentielMateriel, article] }));
        return article;
      },

      addMouvementMateriel: (payload, user) => {
        const mvt = { id: nextId("mvt"), date: payload.date, articleId: payload.articleId, type: payload.type, quantite: Number(payload.quantite), motif: payload.motif || "", agentNom: user?.nom || "Agent" };
        set((s) => ({ mouvementsMateriel: [mvt, ...s.mouvementsMateriel] }));
        return mvt;
      },

      // ---------- E-BRIQUETERIE — matières premières ----------
      referentielMatieres: MATIERES_PREMIERES,
      mouvementsMatieres: [],

      stockMatiere: (matiereId) => {
        const init = STOCK_INITIAL_MATIERES[matiereId] || 0;
        const solde = get()
          .mouvementsMatieres.filter((m) => m.matiereId === matiereId)
          .reduce((acc, m) => (m.type === "arrivage" ? acc + m.quantite : acc - m.quantite), init);
        return Math.max(0, solde);
      },

      addMouvementMatiere: (payload, user) => {
        const mvt = { id: nextId("mvm"), date: payload.date, matiereId: payload.matiereId, type: payload.type, quantite: Number(payload.quantite), agentNom: user?.nom || "Agent" };
        set((s) => ({ mouvementsMatieres: [mvt, ...s.mouvementsMatieres] }));
        return mvt;
      },

      // ---------- E-BRIQUETERIE — briques (4 états, transitions manuelles) ----------
      typesBriques: BRIQUES_DEFAUT,
      stockBriques: STOCK_INITIAL_BRIQUES,
      journalBriques: [],

      // Production : un lot fraîchement moulé rejoint l'appâtam.
      ajouterProduction: (typeId, quantite, user) => {
        set((s) => ({
          stockBriques: { ...s.stockBriques, [typeId]: { ...s.stockBriques[typeId], appatam: s.stockBriques[typeId].appatam + Number(quantite) } },
          journalBriques: [{ id: nextId("jb"), date: new Date().toISOString().slice(0, 10), typeId, action: "Production", quantite: Number(quantite), agentNom: user?.nom || "Agent" }, ...s.journalBriques],
        }));
      },

      // Transition d'un état vers un autre (appâtam → séchage → prêt), ou casse
      // vers caillasses depuis n'importe quel état.
      transitionBrique: (typeId, de, vers, quantite, user) => {
        set((s) => {
          const etat = s.stockBriques[typeId];
          const qte = Math.min(Number(quantite), etat[de]);
          if (qte <= 0) return {};
          return {
            stockBriques: { ...s.stockBriques, [typeId]: { ...etat, [de]: etat[de] - qte, [vers]: etat[vers] + qte } },
            journalBriques: [{ id: nextId("jb"), date: new Date().toISOString().slice(0, 10), typeId, action: `${de} → ${vers}`, quantite: qte, agentNom: user?.nom || "Agent" }, ...s.journalBriques],
          };
        });
      },

      // Décrémente le stock "prêt" lors d'une vente facturée — appelé depuis
      // BusinessFacturation quand le type est "Vente de briques".
      venteBriques: (typeId, quantite) => {
        set((s) => {
          const etat = s.stockBriques[typeId];
          if (!etat) return {};
          const qte = Math.min(Number(quantite), etat.pret);
          return { stockBriques: { ...s.stockBriques, [typeId]: { ...etat, pret: etat.pret - qte } } };
        });
      },

      // ---------- MAXI AGRO — cheptel (effectif par espèce) ----------
      // Même principe que le vrai module (src/modules/agro) : effectif = report
      // du solde précédent + entrées (achat/naissance) - sorties (vente/décès/perte),
      // ici en cumul de mouvements plutôt qu'en inventaires journaliers verrouillés.
      referentielAnimaux: ESPECES_DEFAUT,
      mouvementsAnimaux: [],

      effectifEspece: (especeId) => {
        const init = STOCK_INITIAL_ANIMAUX[especeId] || 0;
        const solde = get()
          .mouvementsAnimaux.filter((m) => m.especeId === especeId)
          .reduce((acc, m) => acc + m.quantite, init);
        return Math.max(0, solde);
      },

      ajouterEspece: (payload) => {
        const id = nextId("esp");
        const espece = { id, nom: payload.nom, cat: payload.cat };
        set((s) => ({ referentielAnimaux: [...s.referentielAnimaux, espece] }));
        return espece;
      },

      addMouvementAnimal: (payload, user) => {
        const info = TYPES_MOUVEMENT_ANIMAL[payload.type];
        const mvt = {
          id: nextId("mva"),
          date: payload.date,
          especeId: payload.especeId,
          type: payload.type,
          quantite: info.signe * Math.abs(Number(payload.quantite)),
          motif: payload.motif || "",
          agentNom: user?.nom || "Agent",
        };
        set((s) => ({ mouvementsAnimaux: [mvt, ...s.mouvementsAnimaux] }));
        return mvt;
      },
    }),
    { name: "edepenses-stock" }
  )
);
