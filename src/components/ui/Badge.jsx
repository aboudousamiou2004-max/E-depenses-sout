const TONES = {
  mint: "bg-[#30D158]/15 text-[#1a7d34] ring-1 ring-[#30D158]/30",
  amber: "bg-[#FF9F0A]/15 text-[#9a5f00] ring-1 ring-[#FF9F0A]/30",
  coral: "bg-[#FF453A]/15 text-[#b3241b] ring-1 ring-[#FF453A]/30",
  accent: "bg-[#0A84FF]/15 text-[#0a5cb3] ring-1 ring-[#0A84FF]/30",
  grape: "bg-[#BF5AF2]/15 text-[#7c2ea6] ring-1 ring-[#BF5AF2]/30",
  ink: "bg-black/8 text-ink ring-1 ring-black/10",
};

export default function Badge({ tone = "ink", children, dot = false, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-tight ${TONES[tone]} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
