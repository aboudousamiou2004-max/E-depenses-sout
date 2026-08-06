import { motion } from "framer-motion";

export default function ProgressRing({ value, size = 120, stroke = 12, color = "#0A84FF", track = "rgba(15,23,42,0.08)", label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 1.15);
  const dash = Math.min(pct, 1) * c;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-bold tracking-tight text-ink">{label ?? `${Math.round(value * 100)}%`}</span>
        {sub && <span className="text-[11px] text-ink-soft font-medium mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}
