export default function Field({ label, hint, children }) {
  return (
    <label className="block mb-3.5">
      <span className="text-[12.5px] font-semibold text-ink-soft ml-1">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="block text-[11px] text-ink-soft/80 mt-1 ml-1">{hint}</span>}
    </label>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={`glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-soft/60 ${props.className || ""}`}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className="glass w-full rounded-2xl px-3.5 py-2.5 text-[14px] text-ink outline-none cursor-pointer">
      {children}
    </select>
  );
}
