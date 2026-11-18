import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { COUNTRIES } from "@shared/sites";
import { cx } from "@/components/ui";

/** Searchable multi-select of countries with removable chips. */
export function CountryPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(s) || c.code.toLowerCase() === s) : COUNTRIES;
  }, [q]);
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  return (
    <div className="rounded-lg border border-border-strong bg-surface">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border p-2">
          {value.map((code) => {
            const c = COUNTRIES.find((x) => x.code === code);
            return (
              <span key={code} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-border pl-2 pr-1 py-0.5 text-[13px]">
                <span>{c?.flag}</span>
                {c?.name ?? code}
                <button type="button" onClick={() => toggle(code)} className="rounded-full p-0.5 text-faint hover:text-text cursor-pointer" aria-label={`Remove ${c?.name ?? code}`}>
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // Enter picks the first match instead of submitting the step.
            if (e.key === "Enter" && q.trim()) {
              e.preventDefault();
              if (list[0]) toggle(list[0].code);
              setQ("");
            }
          }}
          placeholder="Search countries"
          className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>
      <ul className="max-h-60 overflow-y-auto py-1">
        {list.map((c) => {
          const on = value.includes(c.code);
          return (
            <li key={c.code}>
              <button type="button" onClick={() => toggle(c.code)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2 cursor-pointer">
                <span className={cx("grid size-4 shrink-0 place-items-center rounded border", on ? "border-primary bg-primary text-primary-fg" : "border-border-strong")}>
                  {on && <Check className="size-3" />}
                </span>
                <span>{c.flag}</span>
                <span className="flex-1">{c.name}</span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="px-3 py-3 text-sm text-faint">No countries match “{q}”.</li>}
      </ul>
    </div>
  );
}
