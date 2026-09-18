// Badges "nouveauté" du menu latéral — combien d'éléments un AUTRE utilisateur a
// ajoutés depuis ma dernière visite de chaque volet. Même principe que
// termitiere-platform (src/shared/nouveautes.js), adapté à Supabase : basé sur
// l'état réel des données déjà chargées dans dataStore.js (pas un journal), donc
// un élément supprimé disparaît aussitôt du calcul.

// Chaque volet suivi précise la collection (déjà dans le store), le champ date de
// création et le champ créateur (uid) à comparer à ma dernière visite. `filtre`
// restreint en plus aux éléments concernés (ex. seulement les dépenses en attente
// pour le badge "Autorisations", alors que "Dépenses" les compte toutes).
export const VOLETS_SUIVIS = {
  depenseDepenses: { collection: "depenses", champDate: "createdAt", champCreateur: "creeParUid" },
  depenseAutorisations: { collection: "depenses", champDate: "createdAt", champCreateur: "creeParUid", filtre: (d) => d.statut === "en_attente" },
  depenseRecettes: { collection: "recettes", champDate: "createdAt", champCreateur: "creeParUid" },
};

// Calcule les badges pour l'utilisateur courant.
// `donnees` : { depenses, recettes, ... } — l'état de useDataStore().
// `vuesVolets` : contenu de vuesVolets (useDataStore().vuesVolets).
export function calculerBadges(donnees, vuesVolets, monUid) {
  const badges = {};
  for (const [cle, cfg] of Object.entries(VOLETS_SUIVIS)) {
    const vuBrut = vuesVolets.find((v) => v.userId === monUid && v.section === cle)?.vu || null;
    const vu = vuBrut ? new Date(vuBrut).getTime() : 0;
    let items = donnees[cfg.collection] || [];
    if (cfg.filtre) items = items.filter(cfg.filtre);
    badges[cle] = items.filter((it) => {
      const date = it[cfg.champDate];
      const creePar = it[cfg.champCreateur];
      if (!date || !creePar || creePar === monUid) return false;
      return new Date(date).getTime() > vu;
    }).length;
  }
  return badges;
}
