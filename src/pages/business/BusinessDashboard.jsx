import { useOutletContext, useNavigate } from "react-router-dom";
import TopBarSimple from "../../components/layout/TopBarSimple";
import SecteurOverview from "../../components/SecteurOverview";
import AgroDashboard from "./AgroDashboard";

export default function BusinessDashboard() {
  const config = useOutletContext();
  const navigate = useNavigate();

  // MAXI AGRO a son propre tableau de bord (indicateurs cheptel + graphiques),
  // porté depuis termitiere-platform/src/modules/agro/Dashboard.jsx — même
  // principe que StockRouter.jsx choisissant la bonne page de stock par secteur.
  if (config.stock === "animaux") return <AgroDashboard />;

  return (
    <div>
      <TopBarSimple title="Tableau de bord" subtitle={`${config.nom} — vue financière du secteur`} accent={config.color} />
      <SecteurOverview
        secteurId={config.secteurId}
        nom={config.nom}
        color={config.color}
        labelRecettes="Dernières factures"
        onVoirDepenses={() => navigate(`${config.path}/depenses`)}
        onVoirRecettes={() => navigate(`${config.path}/facturation`)}
      />
    </div>
  );
}
