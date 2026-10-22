import { motion } from "framer-motion";

// Mélange une couleur hex avec du blanc (facteur > 0) ou du noir (facteur < 0).
function nuance(hex, facteur) {
  const h = (hex || "#0A84FF").replace("#", "");
  const plein = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(plein, 16) || 0;
  const cible = facteur >= 0 ? 255 : 0;
  const t = Math.abs(facteur);
  const c = (v) => Math.round(v + (cible - v) * t);
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

// Icône en relief : tuile dégradée avec reflet brillant, épaisseur (ombre
// pleine sous la tuile) et ombre portée colorée, qui s'incline vers la
// souris au survol. `flotte` ajoute un léger mouvement de lévitation continu.
export default function Icone3D({ icon: Icon, color = "#0A84FF", size = 44, flotte = false, className = "" }) {
  const fonce = nuance(color, -0.38);
  const clair = nuance(color, 0.32);
  const epaisseur = Math.max(3, Math.round(size / 9));
  return (
    <div className={`shrink-0 ${className}`} style={{ perspective: 500, width: size, height: size + epaisseur }}>
      <motion.div
        whileHover={{ rotateX: -14, rotateY: 16, scale: 1.08 }}
        animate={flotte ? { y: [0, -3, 0] } : { y: 0 }}
        transition={flotte ? { y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" }, default: { type: "spring", stiffness: 260, damping: 18 } } : { type: "spring", stiffness: 260, damping: 18 }}
        className="relative flex items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.3,
          background: `linear-gradient(150deg, ${clair} 0%, ${color} 46%, ${nuance(color, -0.14)} 100%)`,
          boxShadow: [
            `0 ${epaisseur}px 0 ${fonce}`,
            `0 ${epaisseur + 8}px ${Math.round(size * 0.42)}px -${Math.round(size * 0.08)}px ${color}99`,
            "inset 0 2px 1px rgba(255,255,255,0.6)",
            "inset 0 -3px 6px rgba(0,0,0,0.16)",
          ].join(", "),
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[10%] top-[6%] h-[44%] rounded-[inherit]"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)", borderRadius: size * 0.26 }}
        />
        {Icon && (
          <Icon
            size={Math.round(size * 0.5)}
            strokeWidth={2.4}
            color="#fff"
            className="relative"
            style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.28))" }}
          />
        )}
      </motion.div>
    </div>
  );
}
