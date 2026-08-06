import { useOutletContext, useNavigate } from "react-router-dom";
import TopBarSimple from "../../components/layout/TopBarSimple";
import SecteurOverview from "../../components/SecteurOverview";

export default function BusinessDashboard() {
  const config = useOutletContext();
  const navigate = useNavigate();

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
