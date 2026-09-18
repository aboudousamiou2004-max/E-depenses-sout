import { Grid2x2 } from "lucide-react";
import MobileTabBar from "./MobileTabBar";

// Volets jugés essentiels au suivi/gestion quotidien de chaque secteur — en
// plus du Tableau de bord (toujours inclus) et du bouton « Plus » (ouvre le
// menu complet pour tout le reste). Référencés par le dernier segment de
// leur chemin (`${config.path}/<segment>`), pour rester indépendants de
// l'ordre du tableau NAV construit dans BusinessLayout.jsx. Limité à 2 par
// secteur pour garder la barre lisible sur mobile — à la demande explicite
// de l'utilisateur (2026-08-19).
//
// Basé sur les indicateurs de `config` (forfaits/campagnes/stock/transport),
// pas sur `config.id` : un secteur "succursale" (ex. « MAXI GYM KARA »,
// « MAXI LOGISTIQUE KARA ») a un id slugifié différent du preset de base et
// ne matcherait jamais une table indexée par id — ce bug faisait afficher
// une barre mobile sans AUCUN raccourci pour MAXI GYM et MAXI COM (constaté
// par l'utilisateur, 2026-09-14), corrigé ici en réutilisant les mêmes
// indicateurs déjà fiabilisés pour les succursales dans BusinessLayout.jsx.
function essentielsDeSecteur(config) {
  if (config.forfaits) return ["abonnements", "coachs"]; // MAXI GYM : pointage clients + coachs, l'usage quotidien
  if (config.campagnes) return ["campagnes", "facturation"]; // MAXI COM
  if (config.stock === "animaux") return ["saisie", "facturation"]; // MAXI AGRO
  if (config.stock === "briques") return ["production", "facturation"]; // E-BRIQUETERIE
  if (config.stock === "materiel") return ["transport", "facturation"]; // MAXI LOGISTIQUE
  if (config.foncier) return ["dossiers", "besoins"];
  if (config.garderie) return ["enfants", "paiements"];
  if (config.egpro) return ["projets", "taches"];
  // Secteur générique (créé depuis Paramètres, sans preset dédié — ex. un
  // nouveau module métier ajouté après coup) : mêmes volets génériques que
  // BusinessLayout.jsx lui donne par défaut (Prestations + Dépenses), pour
  // que sa barre mobile ne se limite jamais à Tableau de bord + Plus.
  return ["facturation", "depenses"];
}

// Enrobe MobileTabBar pour BusinessLayout.jsx : calcule les items propres à
// CE secteur (c'est ce qui la rend différente d'un secteur à l'autre) à
// partir du tableau NAV déjà construit — pas de duplication de la logique
// d'accès (stock/garderie/egpro...) déjà présente dans BusinessLayout.jsx.
export default function MobileBottomNav({ config, nav, onOpenMenu }) {
  const dashboard = nav.find((n) => n.end);
  const essentielsSegments = essentielsDeSecteur(config);
  const essentiels = essentielsSegments
    .map((seg) => nav.find((n) => n.to.endsWith(`/${seg}`)))
    .filter(Boolean);
  const items = [dashboard, ...essentiels].filter((it, i, arr) => it && arr.findIndex((x) => x.to === it.to) === i);

  return (
    <MobileTabBar
      items={items}
      accent={config.color}
      pillId={`mobile-nav-pill-${config.id}`}
      menu={{ label: "Plus", icon: Grid2x2, onClick: onOpenMenu }}
    />
  );
}
