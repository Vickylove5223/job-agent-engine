// Design-system primitives. Pages build on these; keep page-specific widgets in the page folder.
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Info, Loader2, X } from "lucide-react";

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

// ---------- Button ----------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:opacity-90 border border-primary",
  secondary: "bg-surface text-text border border-border-strong hover:bg-surface-2",
  ghost: "text-muted hover:text-text hover:bg-surface-2 border border-transparent",
  danger: "bg-surface text-danger border border-border-strong hover:bg-danger-soft",
  accent: "bg-accent text-[#0c0d0d] border border-accent hover:opacity-90",
};
export function Button({
  variant = "secondary", size = "md", icon, loading, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: ReactNode; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------- Layout blocks ----------
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bordered container — the console's main grouping element. */
export function Panel({ children, className, title, actions, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx("rounded-lg border border-border bg-surface", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-8">
      <h2 className="text-lg font-semibold">{children}</h2>
      {actions}
    </div>
  );
}

/** Metric tile row like the console usage box. */
export function StatGroup({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 rounded-lg border border-border divide-x divide-y lg:divide-y-0 divide-border">{children}</div>;
}
export function Stat({ label, value, hint, info }: { label: string; value: ReactNode; hint?: ReactNode; info?: string }) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
        {label}
        {info && <span title={info}><Info className="size-3.5 text-faint" /></span>}
      </div>
      <div className="mt-1.5 text-2xl font-medium tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <div className="font-medium">{title}</div>
      {description && <p className="text-muted text-sm mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-4 animate-spin text-muted", className)} />;
}
export function LoadingBlock() {
  return <div className="flex justify-center py-16"><Spinner className="size-5" /></div>;
}

// ---------- Badge ----------
export type Tone = "neutral" | "green" | "blue" | "amber" | "red" | "indigo";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  green: "bg-accent-soft text-accent-strong border-transparent",
  blue: "bg-info-soft text-info border-transparent",
  amber: "bg-warning-soft text-warning border-transparent",
  red: "bg-danger-soft text-danger border-transparent",
  indigo: "bg-indigo-soft text-indigo border-transparent",
};
export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ---------- Form controls ----------
const control = "w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-text placeholder:text-faint focus:outline-none focus:border-text";
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(control, "h-9", className)} />;
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(control, "py-2 min-h-24 resize-y", className)} />;
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={cx(control, "h-9 pr-8", className)}>{children}</select>;
}
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-[13px] font-medium mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-faint mt-1">{hint}</span>}
    </label>
  );
}
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("inline-flex items-center gap-2.5 select-none", disabled ? "opacity-50" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-accent" : "bg-border-strong")}
      >
        <span className={cx("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

/** Comma/Enter separated tag input. */
export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border-strong bg-surface p-1.5 min-h-9">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-surface-2 border border-border px-2 py-0.5 text-[13px]">
          {t}
          <button type="button" className="text-faint hover:text-text cursor-pointer" onClick={() => onChange(value.filter((x) => x !== t))}><X className="size-3" /></button>
        </span>
      ))}
      <input
        className="flex-1 min-w-32 bg-transparent px-1.5 text-sm outline-none placeholder:text-faint"
        placeholder={placeholder}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          if ((e.key === "Enter" || e.key === ",") && el.value.trim()) {
            e.preventDefault();
            const v = el.value.trim();
            if (!value.includes(v)) onChange([...value, v]);
            el.value = "";
          } else if (e.key === "Backspace" && !el.value && value.length) onChange(value.slice(0, -1));
        }}
      />
    </div>
  );
}

// ---------- Tabs ----------
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            "relative px-3 py-2.5 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors",
            value === t.value ? "text-text after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-text" : "text-muted hover:text-text",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Table ----------
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx("text-left font-semibold text-[13px] px-4 py-3 border-b border-border whitespace-nowrap", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("px-4 py-3.5 border-b border-border align-middle", className)}>{children}</td>;
}
export function Tr({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return <tr onClick={onClick} className={cx(onClick && "cursor-pointer hover:bg-surface-2", className)}>{children}</tr>;
}

// ---------- Drawer ----------
export function Drawer({ open, onClose, title, subtitle, children, footer, width = "max-w-2xl" }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className={cx("relative h-full w-full bg-bg border-l border-border flex flex-col", width)}>
        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{title}</h2>
            {subtitle && <div className="text-sm text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-text hover:bg-surface-2 cursor-pointer" aria-label="Close"><X className="size-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="px-6 py-3 border-t border-border flex flex-wrap justify-end gap-2">{footer}</footer>}
      </aside>
    </div>
  );
}
