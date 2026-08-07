import { useParams, Navigate } from "react-router-dom";
import { useDataStore } from "../../store/dataStore";
import { modulesMetier } from "../../lib/modules";
import ModuleGuard from "../ModuleGuard";
import BusinessLayout from "./BusinessLayout";

// Point d'entrée unique de tous les modules métiers — remplace les anciennes
// routes statiques une par une (/agro, /logistique, ...) par une seule route
// dynamique (/secteur/:secteurId). Le module est reconstruit à partir de la
// table `secteurs` (Supabase) : un secteur ajouté depuis Paramètres devient
// ainsi immédiatement accessible ici, sans changement de code ni déploiement.
export default function BusinessRoute() {
  const { secteurId } = useParams();
  const { secteurs, loaded } = useDataStore();

  const config = modulesMetier(secteurs).find((m) => m.id === secteurId);

  if (!config) {
    // Secteur inexistant, ou pas encore chargé (chargerTout est asynchrone) —
    // le second cas se résorbe de lui-même dès que la requête répond.
    if (!loaded) return null;
    return <Navigate to="/portal" replace />;
  }

  return (
    <ModuleGuard moduleId={config.id}>
      <BusinessLayout config={config} />
    </ModuleGuard>
  );
}
