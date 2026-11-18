// Small widgets shared by the wizard steps.
import type { ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { cx } from "@/components/ui";
import type { Draft } from "./draft";

export interface StepProps {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
}

/** Multi-select pill group. */
export function Pills<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cx(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors cursor-pointer",
              on ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface text-text hover:bg-surface-2",
            )}
          >
            {on && <Check className="size-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2">
      <div className="text-[13px] font-medium">{children}</div>
      {hint && <div className="text-xs text-faint mt-0.5">{hint}</div>}
    </div>
  );
}

export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("space-y-5", className)}>{children}</div>;
}

export function Note({ tone = "amber", children }: { tone?: "amber" | "info" | "danger"; children: ReactNode }) {
  const cls = tone === "amber" ? "bg-warning-soft text-warning" : tone === "danger" ? "bg-danger-soft text-danger" : "bg-info-soft text-info";
  return (
    <div className={cx("flex items-start gap-2 rounded-md px-3 py-2.5 text-[13px]", cls)}>
      <TriangleAlert className="size-4 shrink-0 mt-px" />
      <div>{children}</div>
    </div>
  );
}
