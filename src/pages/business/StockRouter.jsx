import { useOutletContext } from "react-router-dom";
import { PackageX } from "lucide-react";
import GlassCard from "../../components/ui/GlassCard";
import StockMateriel from "./StockMateriel";
import StockBriques from "./StockBriques";
import AgroDashboard from "./AgroDashboard";

// Le « Cheptel » de MAXI AGRO est un volet de LECTURE (indicateurs +
// graphiques, cf. AgroDashboard) — la saisie du cheptel se fait exclusivement
// depuis Saisie journalière (report EF Initial, entrées/sorties du jour).
const STOCK_PAGE = { materiel: StockMateriel, briques: StockBriques, animaux: AgroDashboard };

// Choisit la bonne page de stock selon `config.stock` — la route "stock" est
// désormais générique (un seul chemin pour tous les modules métiers), donc ce
// choix ne peut plus se faire au niveau de la définition des routes.
export default function StockRouter() {
  const config = useOutletContext();
  const StockPage = STOCK_PAGE[config.stock];

  if (!StockPage) {
    return (
      <GlassCard className="p-10 text-center flex flex-col items-center gap-3" hover={false}>
        <PackageX size={26} className="text-ink-soft" />
        <p className="text-[13.5px] text-ink-soft">Ce module ne dispose pas de suivi de stock.</p>
      </GlassCard>
    );
  }

  return <StockPage />;
}
