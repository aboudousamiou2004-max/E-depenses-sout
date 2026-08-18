import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2, DatabaseZap } from "lucide-react";
import { useAuthStore } from "./store/authStore";
import { supabaseConfigured } from "./lib/supabaseClient";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./components/layout/AppLayout";
import BusinessRoute from "./components/layout/BusinessRoute";
import ModuleGuard from "./components/ModuleGuard";
import Login from "./pages/Login";
import Portal from "./pages/Portal";
import Dashboard from "./pages/Dashboard";
import Depenses from "./pages/Depenses";
import Recettes from "./pages/Recettes";
import Autorisations from "./pages/Autorisations";
import Analyses from "./pages/Analyses";
import Rentabilite from "./pages/Rentabilite";
import Flux from "./pages/Flux";
import Banque from "./pages/Banque";
import Partenaires from "./pages/Partenaires";
import Journal from "./pages/Journal";
import Parametres from "./pages/Parametres";
import Utilisateurs from "./pages/admin/Utilisateurs";
import BusinessDashboard from "./pages/business/BusinessDashboard";
import BusinessFacturation from "./pages/business/BusinessFacturation";
import BusinessDepenses from "./pages/business/BusinessDepenses";
import StockRouter from "./pages/business/StockRouter";
import SaisieJournaliere from "./pages/business/SaisieJournaliere";
import SanteAnimale from "./pages/business/SanteAnimale";
import Magasin from "./pages/business/Magasin";
import Marge from "./pages/business/Marge";
import LogistiqueDashboard from "./pages/business/LogistiqueDashboard";
import Retour from "./pages/business/Retour";
import ProductionBriques from "./pages/business/ProductionBriques";
import Materiaux from "./pages/business/Materiaux";
import MaterielBriqueterie from "./pages/business/MaterielBriqueterie";
import DossiersFonciers from "./pages/business/DossiersFonciers";
import Projets from "./pages/business/Projets";
import Taches from "./pages/business/Taches";
import Enfants from "./pages/business/Enfants";
import Paiements from "./pages/business/Paiements";
import CantineRepas from "./pages/business/CantineRepas";
import SanteInfirmerie from "./pages/business/SanteInfirmerie";
import AnalysePilotage from "./pages/business/AnalysePilotage";

function Protected({ children }) {
  const { user, status } = useAuthStore();
  // La vérification de session Supabase est asynchrone (contrairement à
  // l'ancien store persisté en localStorage) — tant qu'elle n'est pas résolue,
  // on n'affiche ni le contenu ni une redirection vers /login, pour éviter un
  // flash de la page de connexion à chaque rechargement pour un utilisateur
  // pourtant déjà connecté.
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-ink-soft" strokeWidth={2.2} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Écran affiché si VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sont absentes —
// évite une page blanche silencieuse tant que supabase/README.md n'a pas été suivi.
function ConfigManquante() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center flex flex-col items-center gap-3 rounded-[28px] p-8 bg-white/70 shadow-xl">
        <div className="w-14 h-14 rounded-full bg-[#FF9F0A]/10 flex items-center justify-center text-[#FF9F0A]">
          <DatabaseZap size={26} />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-ink">Configuration Supabase manquante</h1>
        <p className="text-[13.5px] text-ink-soft">
          Il manque <code className="text-[12px] bg-black/5 px-1.5 py-0.5 rounded">VITE_SUPABASE_URL</code> et/ou{" "}
          <code className="text-[12px] bg-black/5 px-1.5 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>. Suivez les
          étapes de <code className="text-[12px] bg-black/5 px-1.5 py-0.5 rounded">supabase/README.md</code>, créez{" "}
          <code className="text-[12px] bg-black/5 px-1.5 py-0.5 rounded">.env.local</code> à la racine du projet, puis relancez le serveur.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!supabaseConfigured) return <ConfigManquante />;
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/portal" element={<Protected><Portal /></Protected>} />
        <Route path="/utilisateurs" element={<Protected><Utilisateurs /></Protected>} />

        <Route
          path="/depense"
          element={
            <Protected>
              <ModuleGuard moduleId="depense">
                <AppLayout />
              </ModuleGuard>
            </Protected>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="depenses" element={<Depenses />} />
          <Route path="recettes" element={<Recettes />} />
          <Route path="autorisations" element={<Autorisations />} />
          <Route path="analyses" element={<Analyses />} />
          <Route path="rentabilite" element={<Rentabilite />} />
          <Route path="flux" element={<Flux />} />
          <Route path="banque" element={<Banque />} />
          <Route path="partenaires" element={<Partenaires />} />
          <Route path="journal" element={<Journal />} />
          <Route path="parametres" element={<Parametres />} />
        </Route>

        <Route
          path="/secteur/:secteurId"
          element={
            <Protected>
              <BusinessRoute />
            </Protected>
          }
        >
          <Route index element={<BusinessDashboard />} />
          <Route path="facturation" element={<BusinessFacturation />} />
          <Route path="depenses" element={<BusinessDepenses />} />
          <Route path="stock" element={<StockRouter />} />
          <Route path="saisie" element={<SaisieJournaliere />} />
          <Route path="sante" element={<SanteAnimale />} />
          <Route path="magasin" element={<Magasin />} />
          <Route path="marge" element={<Marge />} />
          <Route path="analyses" element={<LogistiqueDashboard />} />
          <Route path="retour" element={<Retour />} />
          <Route path="production" element={<ProductionBriques />} />
          <Route path="materiaux" element={<Materiaux />} />
          <Route path="materiel" element={<MaterielBriqueterie />} />
          <Route path="dossiers" element={<DossiersFonciers />} />
          <Route path="projets" element={<Projets />} />
          <Route path="taches" element={<Taches />} />
          <Route path="enfants" element={<Enfants />} />
          <Route path="paiements" element={<Paiements />} />
          <Route path="cantine" element={<CantineRepas />} />
          <Route path="infirmerie" element={<SanteInfirmerie />} />
          <Route path="analyse" element={<AnalysePilotage />} />
        </Route>

        <Route path="/" element={<Navigate to="/portal" replace />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
