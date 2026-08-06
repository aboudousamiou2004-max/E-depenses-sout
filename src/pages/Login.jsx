import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import Button from "../components/ui/Button";

export default function Login() {
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuthStore();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await doLogin(login, pass);
    setLoading(false);
    if (!res.ok) return setError(res.error);
    navigate("/portal");
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="mesh-bg">
        <div className="blob" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong rounded-[32px] w-[420px] p-9"
      >
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-xl mb-4 border-4 border-[#7A1128] overflow-hidden">
            <img src="/logo_termitiere.png" alt="Logo" className="w-full h-full object-contain p-1.5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">E-DÉPENSES</h1>
          <p className="text-[13.5px] text-ink-soft font-medium mt-1">
            Système de pilotage financier — LA TERMITIÈRE
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <label className="block">
            <span className="text-[12.5px] font-semibold text-ink-soft ml-1">Identifiant</span>
            <div className="mt-1.5 glass rounded-2xl px-3.5 py-3 flex items-center gap-2.5">
              <User size={16} className="text-ink-soft" strokeWidth={2.2} />
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="ex : admin"
                className="bg-transparent outline-none text-[14.5px] text-ink placeholder:text-ink-soft/60 w-full"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[12.5px] font-semibold text-ink-soft ml-1">Mot de passe</span>
            <div className="mt-1.5 glass rounded-2xl px-3.5 py-3 flex items-center gap-2.5">
              <Lock size={16} className="text-ink-soft" strokeWidth={2.2} />
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                className="bg-transparent outline-none text-[14.5px] text-ink placeholder:text-ink-soft/60 w-full"
              />
            </div>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-[13px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2">
              <AlertCircle size={15} strokeWidth={2.2} />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full mt-1.5" icon={loading ? Loader2 : ArrowRight} disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
