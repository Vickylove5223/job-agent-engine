import { useEffect, useMemo, useState } from "react";
import { Check, Info, Search, X } from "lucide-react";
import type { Settings, WorkMode } from "@shared/types";
import { COUNTRIES, focusFromRoles, recommendSites } from "@shared/sites";
import { Button, Field, TagInput, cx } from "@/components/ui";
import { isRemoteOnly } from "./defaults";
import { PillGroup, SettingsSection, useSection } from "./SettingsSection";

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

export interface WhereDraft {
  countries: string[];
  workModes: WorkMode[];
}

const recommendedIds = (w: WhereDraft, roles: string[]) =>
  recommendSites({ countries: w.countries, remote: w.workModes.includes("remote"), focus: focusFromRoles(roles) }).map((s) => s.id);

/** Searchable country checklist; selected countries show as removable chips. */
function CountryPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const list = COUNTRIES.filter((c) => !query || c.name.toLowerCase().includes(query) || c.code.toLowerCase() === query);
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((x) => x !== code) : [...value, code]);

  return (
    <div className="rounded-md border border-border-strong bg-surface">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border p-2">
          {value.map((code) => {
            const c = COUNTRIES.find((x) => x.code === code);
            return (
              <span key={code} className="inline-flex items-center gap-1.5 rounded bg-surface-2 border border-border px-2 py-0.5 text-[13px]">
                {c?.flag && <span aria-hidden>{c.flag}</span>}
                {c?.name ?? code}
                <button type="button" aria-label={`Remove ${c?.name ?? code}`} className="text-faint hover:text-text cursor-pointer" onClick={() => toggle(code)}>
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-faint shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search countries"
          aria-label="Search countries"
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>
      <ul className="max-h-52 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
        {list.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matching countries.</li>}
        {list.map((c) => {
          const on = value.includes(c.code);
          return (
            <li key={c.code}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(c.code)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-surface-2 cursor-pointer"
              >
                <span className={cx("flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-text bg-primary text-primary-fg" : "border-border-strong")}>
                  {on && <Check className="size-3" />}
                </span>
                <span aria-hidden>{c.flag}</span>
                <span className="truncate">{c.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WhereSection({ settings, onDraftChange, onReviewSites }: {
  settings: Settings;
  onDraftChange: (w: WhereDraft) => void;
  onReviewSites: (siteIds: string[]) => void;
}) {
  const s = useSection(
    { workModes: settings.workModes, countries: settings.countries, locations: settings.locations },
    (d) => ({ ...d, remoteOnly: isRemoteOnly(d.workModes) }),
  );
  const d = s.draft;
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => s.setDraft((p) => ({ ...p, [k]: v }));

  const whereKey = JSON.stringify({ countries: d.countries, workModes: d.workModes });
  useEffect(() => {
    onDraftChange(JSON.parse(whereKey) as WhereDraft);
  }, [whereKey, onDraftChange]);

  // Sites the new countries / work modes bring in that the user doesn't have yet.
  const newSites = useMemo(() => {
    const before = new Set([...recommendedIds(settings, settings.roles), ...settings.enabledSites]);
    return recommendedIds(JSON.parse(whereKey) as WhereDraft, settings.roles).filter((id) => !before.has(id));
  }, [whereKey, settings]);
  const newKey = newSites.join(",");
  const [reviewedKey, setReviewedKey] = useState<string | null>(null);

  const invalid =
    d.workModes.length === 0 ? "Pick at least one work mode."
    : d.countries.length === 0 && !d.workModes.includes("remote") ? "Add a country, or include Remote."
    : null;

  return (
    <SettingsSection
      title="Where you want to work"
      description="Your countries and work modes decide which job sites the agent uses."
      dirty={s.dirty}
      status={s.status}
      error={s.error}
      invalid={invalid}
      onSave={s.save}
      onReset={s.reset}
    >
      <div className="grid gap-5">
        <div>
          <div className="text-[13px] font-medium mb-1.5">Work modes</div>
          <PillGroup options={WORK_MODES} value={d.workModes} onChange={(v) => set("workModes", v)} />
          <p className="text-xs text-faint mt-1">
            {isRemoteOnly(d.workModes) ? "Remote only — remote job boards are included." : d.workModes.includes("remote") ? "Remote boards are included alongside local ones." : "Only jobs you can do in your countries."}
          </p>
        </div>

        <Field label="Countries" hint="Where you can legally work. Each country adds its local job sites.">
          <CountryPicker value={d.countries} onChange={(v) => set("countries", v)} />
        </Field>

        <Field label="Cities or regions" hint="Optional. Narrows on-site and hybrid jobs, e.g. Lagos, London.">
          <TagInput value={d.locations} onChange={(v) => set("locations", v)} placeholder="Add a city" />
        </Field>

        {newSites.length > 0 && (
          <div className="flex flex-col gap-3 rounded-md bg-info-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-info">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>
                {reviewedKey === newKey
                  ? `Turned on ${newSites.length} site${newSites.length === 1 ? "" : "s"} in Job sites — save both sections to apply.`
                  : `${newSites.length} new job site${newSites.length === 1 ? "" : "s"} match${newSites.length === 1 ? "es" : ""} your locations.`}
              </span>
            </div>
            <Button
              size="sm"
              className="self-start sm:self-auto"
              onClick={() => {
                setReviewedKey(newKey);
                onReviewSites(newSites);
              }}
            >
              Review sites
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
