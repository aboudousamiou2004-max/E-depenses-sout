import { motion } from "framer-motion";

const VARIANTS = {
  primary: "bg-[#0A84FF] text-white shadow-[0_8px_24px_rgba(10,132,255,0.35)] hover:bg-[#0a74e0]",
  ghost: "bg-black/5 text-ink hover:bg-black/8",
  glass: "glass text-ink hover:bg-white/70",
  danger: "bg-[#FF453A] text-white shadow-[0_8px_24px_rgba(255,69,58,0.3)] hover:bg-[#e63e34]",
  success: "bg-[#30D158] text-white shadow-[0_8px_24px_rgba(48,209,88,0.3)] hover:bg-[#29b84c]",
};

export default function Button({ children, variant = "primary", className = "", icon: Icon, ...rest }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.015 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold tracking-tight transition-colors ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={16} strokeWidth={2.4} />}
      {children}
    </motion.button>
  );
}
