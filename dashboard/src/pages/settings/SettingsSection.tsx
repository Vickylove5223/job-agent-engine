import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import type { Settings } from "@shared/types";
import { Button, cx } from "@/components/ui";
import { updateDocument } from "@/lib/db";

type Status = "idle" | "saving" | "saved" | "error";

/**
 * Local draft for one settings section. Follows the stored value while the draft is
 * untouched; once edited it keeps the user's draft until saved.
 */
export function useSection<T>(source: T, toPatch: (draft: T) => Partial<Settings>) {
  const srcKey = JSON.stringify(source);
  const [draft, setDraftState] = useState<T>(source);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const baseRef = useRef(srcKey);

  useEffect(() => {
    setDraftState((prev) => (JSON.stringify(prev) === baseRef.current ? (JSON.parse(srcKey) as T) : prev));
    baseRef.current = srcKey;
  }, [srcKey]);

  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const dirty = JSON.stringify(draft) !== srcKey;

  const setDraft = (next: T | ((prev: T) => T)) => {
    setDraftState(next);
    setStatus("idle");
    setError(null);
  };

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      await updateDocument("settings", "main", toPatch(draft));
      setStatus("saved");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  const reset = () => setDraft(JSON.parse(srcKey) as T);

  return { draft, setDraft, dirty, status, error, save, reset };
}

export function SettingsSection({
  id, title, meta, description, children, dirty, status, error, invalid, onSave, onReset, footerNote, tone, hideFooter,
}: {
  id?: string;
  title: string;
  /** small text shown next to the title, e.g. a count */
  meta?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  dirty?: boolean;
  status?: Status;
  error?: string | null;
  /** Validation message; disables Save while set. */
  invalid?: string | null;
  onSave?: () => void;
  onReset?: () => void;
  footerNote?: ReactNode;
  tone?: "danger";
  hideFooter?: boolean;
}) {
  return (
    <section id={id} className={cx("scroll-mt-6 rounded-lg border bg-surface", tone === "danger" ? "border-danger" : "border-border")}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className={cx("text-[17px] font-semibold", tone === "danger" && "text-danger")}>{title}</h2>
          {meta && <span className="text-[13px] text-muted tabular-nums">{meta}</span>}
        </div>
        {description && <p className="text-sm text-muted mt-1 max-w-2xl">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
      {!hideFooter && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 sm:px-6 py-3 rounded-b-lg">
          <div className="text-[13px] min-h-5">
            {invalid ? (
              <span className="text-danger">{invalid}</span>
            ) : error ? (
              <span className="text-danger">{error}</span>
            ) : status === "saved" && !dirty ? (
              <span className="inline-flex items-center gap-1 text-accent-strong"><Check className="size-3.5" />Saved</span>
            ) : dirty ? (
              <span className="text-muted">Unsaved changes</span>
            ) : (
              <span className="text-faint">{footerNote}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dirty && onReset && <Button size="sm" variant="ghost" onClick={onReset}>Cancel</Button>}
            <Button size="sm" variant="primary" disabled={!dirty || !!invalid} loading={status === "saving"} onClick={onSave}>
              Save
            </Button>
          </div>
        </footer>
      )}
    </section>
  );
}

/** Number input bound to a number (empty → null for nullable fields). */
export function numberFrom(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Multi-select pill row (toggle buttons). */
export function PillGroup<T extends string>({ options, value, onChange, capitalize }: {
  options: { value: T; label: ReactNode }[];
  value: T[];
  onChange: (v: T[]) => void;
  capitalize?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            className={cx(
              "h-8 rounded-full border px-3.5 text-[13px] font-medium cursor-pointer transition-colors",
              capitalize && "capitalize",
              on ? "border-text bg-primary text-primary-fg" : "border-border-strong text-muted hover:text-text hover:bg-surface-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
