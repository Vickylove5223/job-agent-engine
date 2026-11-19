import type { JobType, Seniority, Settings } from "@shared/types";
import { Field, Input, Select, TagInput } from "@/components/ui";
import { PillGroup, SettingsSection, useSection } from "./SettingsSection";

const SENIORITY: { value: Seniority; label: string }[] = (["intern", "junior", "mid", "senior", "lead"] as Seniority[]).map((v) => ({ value: v, label: v }));
const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "contract", label: "Contract" },
  { value: "part_time", label: "Part-time" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Internship" },
  { value: "paid_internship", label: "Paid Internship" },
];
const CURRENCIES = ["USD", "NGN", "GBP", "EUR", "CAD", "AUD", "KES", "ZAR", "GHS", "INR", "AED"];

export function SearchSection({ settings }: { settings: Settings }) {
  const s = useSection(
    {
      roles: settings.roles,
      includeKeywords: settings.includeKeywords,
      excludeKeywords: settings.excludeKeywords,
      seniority: settings.seniority,
      jobTypes: settings.jobTypes,
      minSalary: settings.minSalary,
      currency: settings.currency,
    },
    (d) => d,
  );
  const d = s.draft;
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => s.setDraft((p) => ({ ...p, [k]: v }));

  return (
    <SettingsSection
      title="What to look for"
      description="The scanner keeps jobs that match these roles and filters. Press Enter or comma to add a tag."
      dirty={s.dirty}
      status={s.status}
      error={s.error}
      invalid={d.roles.length === 0 ? "Add at least one role." : null}
      onSave={s.save}
      onReset={s.reset}
    >
      <div className="grid gap-5">
        <Field label="Roles" hint="Job titles to search for, e.g. Frontend Developer.">
          <TagInput value={d.roles} onChange={(v) => set("roles", v)} placeholder="Add a role" />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Include keywords" hint="Boost jobs mentioning these.">
            <TagInput value={d.includeKeywords} onChange={(v) => set("includeKeywords", v)} placeholder="e.g. React" />
          </Field>
          <Field label="Exclude keywords" hint="Skip jobs mentioning these.">
            <TagInput value={d.excludeKeywords} onChange={(v) => set("excludeKeywords", v)} placeholder="e.g. clearance" />
          </Field>
        </div>

        <div>
          <div className="text-[13px] font-medium mb-1.5">Seniority</div>
          <PillGroup options={SENIORITY} value={d.seniority} onChange={(v) => set("seniority", v)} capitalize />
          <p className="text-xs text-faint mt-1">None selected means any level.</p>
        </div>

        <div>
          <div className="text-[13px] font-medium mb-1.5">Job types</div>
          <PillGroup options={JOB_TYPES} value={d.jobTypes} onChange={(v) => set("jobTypes", v)} />
          <p className="text-xs text-faint mt-1">None selected means any type.</p>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 sm:max-w-md items-end">
          <Field label="Minimum salary" hint="Yearly. Leave empty for no minimum.">
            <Input
              type="number"
              min={0}
              value={d.minSalary ?? ""}
              placeholder="No minimum"
              onChange={(e) => set("minSalary", e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label="Currency" className="pb-5">
            <Select value={d.currency} onChange={(e) => set("currency", e.target.value)} className="w-24">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              {!CURRENCIES.includes(d.currency) && <option value={d.currency}>{d.currency}</option>}
            </Select>
          </Field>
        </div>
      </div>
    </SettingsSection>
  );
}
