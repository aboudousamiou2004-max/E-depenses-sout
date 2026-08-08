import NotificationBell from "./NotificationBell";
import PeriodeFilter from "./PeriodeFilter";

export default function TopBarSimple({ title, subtitle, accent = "#0A84FF" }) {
  return (
    <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-[13.5px] text-ink-soft font-medium mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodeFilter />
        <NotificationBell />
        <div className="hidden sm:block w-2 h-8 rounded-full" style={{ background: accent }} />
      </div>
    </div>
  );
}
