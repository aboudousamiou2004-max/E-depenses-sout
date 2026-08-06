import { motion } from "framer-motion";

const variants = {
  default: "glass",
  strong: "glass-strong",
};

export default function GlassCard({ children, className = "", variant = "default", hover = true, as: As, style, ...rest }) {
  const Comp = As || motion.div;
  const base = `${variants[variant]} rounded-[28px] ${className}`;
  if (Comp === motion.div || As === undefined) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        whileHover={hover ? { y: -3, boxShadow: "0 24px 60px rgba(15,23,42,0.16)" } : undefined}
        className={base}
        style={style}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <Comp className={base} style={style} {...rest}>
      {children}
    </Comp>
  );
}
