import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { accesModule } from "../lib/modules";
import GlassCard from "./ui/GlassCard";
import Button from "./ui/Button";

export default function ModuleGuard({ moduleId, children }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  if (accesModule(user, moduleId)) return children;

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="mesh-bg">
        <div className="blob" />
      </div>
      <GlassCard className="p-10 max-w-md text-center flex flex-col items-center gap-3" hover={false}>
        <div className="w-14 h-14 rounded-full bg-[#FF453A]/10 flex items-center justify-center text-[#FF453A]">
          <ShieldAlert size={26} />
        </div>
        <h2 className="text-lg font-bold tracking-tight text-ink">Accès réservé</h2>
        <p className="text-[13.5px] text-ink-soft">
          Votre profil n'a pas accès à ce module. Contactez un administrateur pour demander l'accès.
        </p>
        <Button icon={ArrowLeft} onClick={() => navigate("/portal")} className="mt-2">Retour au portail</Button>
      </GlassCard>
    </div>
  );
}
