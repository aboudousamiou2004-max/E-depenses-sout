import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Lock, User, ArrowRight, AlertCircle } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import Button from "../components/ui/Button";

export default function Login() {
  const [login, setLogin] = useState("");
  const [error, setError] = useState("");
  const { login: doLogin } = useAuthStore();
  const { users } = useDataStore();
  const navigate = useNavigate();

  function submit(e) {
    e.preventDefault();
    const res = doLogin(login || "admin");
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
          <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] flex items-center justify-center shadow-xl shadow-[#0A84FF]/30 mb-4">
            <Building2 size={28} className="text-white" strokeWidth={2.2} />
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
              <input type="password" placeholder="••••••••" className="bg-transparent outline-none text-[14.5px] text-ink placeholder:text-ink-soft/60 w-full" />
            </div>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-[13px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2">
              <AlertCircle size={15} strokeWidth={2.2} />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full mt-1.5" icon={ArrowRight}>
            Se connecter
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-black/5">
          <p className="text-[11.5px] font-semibold text-ink-soft mb-2.5 text-center uppercase tracking-wide">
            Comptes de démonstration
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {users.map((u) => (
              <button
                key={u.uid}
                onClick={() => setLogin(u.login)}
                className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full bg-black/5 hover:bg-black/10 text-ink-soft hover:text-ink transition-colors"
              >
                {u.login}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
