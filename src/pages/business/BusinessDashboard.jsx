import { useOutletContext, useNavigate } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import SecteurOverview from "../../components/SecteurOverview";
import CoachDuJour from "../../components/CoachDuJour";

export default function BusinessDashboard() {
  const config = useOutletContext();
  const navigate = useNavigate();

  return (
    <div>
      <TopBarSimple title="Tableau de bord" subtitle={`${config.nom} : vue financière du secteur`} icon={LayoutGrid} accent={config.color} />
      <SecteurOverview
        secteurId={config.secteurId}
        nom={config.nom}
        color={config.color}
        labelRecettes="Dernières factures"
        onVoirDepenses={() => navigate(`${config.path}/depenses`)}
        onVoirRecettes={() => navigate(`${config.path}/facturation`)}
      />
      {config.forfaits && <CoachDuJour secteurId={config.secteurId} accent={config.color} />}
    </div>
  );
}
