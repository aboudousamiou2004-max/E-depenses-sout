import { motion } from "framer-motion";
import GlassCard from "./GlassCard";

export default function StatTile({ icon: Icon, label, value, trend, tone = "#0A84FF", className = "", onClick }) {
  return (
    <GlassCard
      className={`p-5 flex flex-col justify-between ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: `${tone}1f`, color: tone }}
        >
          {Icon && <Icon size={20} strokeWidth={2.2} />}
        </div>
        {trend !== undefined && (
          <span
            className={`text-xs font-bold tracking-tight px-2 py-1 rounded-full ${
              trend >= 0 ? "text-[#1a7d34] bg-[#30D158]/15" : "text-[#b3241b] bg-[#FF453A]/15"
            }`}
          >
            {trend >= 0 ? "+" : ""}
            {(trend * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="tabular text-[28px] leading-none font-bold tracking-tight text-ink"
        >
          {value}
        </motion.p>
        <p className="mt-1.5 text-[13px] text-ink-soft font-medium">{label}</p>
      </div>
    </GlassCard>
  );
}
