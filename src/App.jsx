import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2, DatabaseZap } from "lucide-react";
import { useAuthStore } from "./store/authStore";
import { supabaseConfigured } from "./lib/supabaseClient";
import AppLayout from "./components/layout/AppLayout";
import BusinessLayout from "./components/layout/BusinessLayout";
import ModuleGuard from "./components/ModuleGuard";
import Login from "./pages/Login";
import Portal from "./pages/Portal";
import Dashboard from "./pages/Dashboard";
import Depenses from "./pages/Depenses";
import Recettes from "./pages/Recettes";
import Autorisations from "./pages/Autorisations";
import Analyses from "./pages/Analyses";
import Flux from "./pages/Flux";
import Journal from "./pages/Journal";
import Utilisateurs from "./pages/admin/Utilisateurs";
import BusinessDashboard from "./pages/business/BusinessDashboard";
import BusinessFacturation from "./pages/business/BusinessFacturation";
import BusinessDepenses from "./pages/business/BusinessDepenses";
import StockMateriel from "./pages/business/StockMateriel";
import StockBriques from "./pages/business/StockBriques";
import StockAnimaux from "./pages/business/StockAnimaux";
import { MODULES_METIER } from "./lib/modules";

const STOCK_PAGE = { materiel: StockMateriel, briques: StockBriques, animaux: StockAnimaux };

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
          <Route path="flux" element={<Flux />} />
          <Route path="journal" element={<Journal />} />
        </Route>

        {MODULES_METIER.map((config) => (
          <Route
            key={config.id}
            path={config.path}
            element={
              <Protected>
                <ModuleGuard moduleId={config.id}>
                  <BusinessLayout config={config} />
                </ModuleGuard>
              </Protected>
            }
          >
            <Route index element={<BusinessDashboard />} />
            <Route path="facturation" element={<BusinessFacturation />} />
            <Route path="depenses" element={<BusinessDepenses />} />
            {config.stock &&
              (() => {
                const StockPage = STOCK_PAGE[config.stock];
                return <Route path="stock" element={<StockPage />} />;
              })()}
          </Route>
        ))}

        <Route path="/" element={<Navigate to="/portal" replace />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
