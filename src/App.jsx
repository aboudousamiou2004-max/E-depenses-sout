import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
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
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
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
