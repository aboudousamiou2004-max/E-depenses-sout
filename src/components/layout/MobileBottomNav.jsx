import { Grid2x2 } from "lucide-react";
import MobileTabBar from "./MobileTabBar";

// Volets jugés essentiels au suivi/gestion quotidien de chaque secteur — en
// plus du Tableau de bord (toujours inclus) et du bouton « Plus » (ouvre le
// menu complet pour tout le reste). Référencés par le dernier segment de
// leur chemin (`${config.path}/<segment>`), pour rester indépendants de
// l'ordre du tableau NAV construit dans BusinessLayout.jsx. Limité à 2 par
// secteur pour garder la barre lisible sur mobile — à la demande explicite
// de l'utilisateur (2026-08-19).
const ESSENTIELS = {
  agro: ["saisie", "facturation"],
  logistique: ["facturation", "stock"],
  briqueterie: ["production", "facturation"],
  foncier: ["dossiers", "besoins"],
  garderie: ["enfants", "paiements"],
  egpro: ["projets", "taches"],
};

// Enrobe MobileTabBar pour BusinessLayout.jsx : calcule les items propres à
// CE secteur (c'est ce qui la rend différente d'un secteur à l'autre) à
// partir du tableau NAV déjà construit — pas de duplication de la logique
// d'accès (stock/garderie/egpro...) déjà présente dans BusinessLayout.jsx.
export default function MobileBottomNav({ config, nav, onOpenMenu }) {
  const dashboard = nav.find((n) => n.end);
  const essentielsSegments = ESSENTIELS[config.id] || [];
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
