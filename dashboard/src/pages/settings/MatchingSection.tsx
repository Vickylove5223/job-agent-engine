import type { Settings } from "@shared/types";
import { Field, Select } from "@/components/ui";
import { SettingsSection, useSection } from "./SettingsSection";

function Slider({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent-strong cursor-pointer"
      />
      <p className="text-xs text-faint mt-1">{hint}</p>
    </div>
  );
}

export function MatchingSection({ settings }: { settings: Settings }) {
  const s = useSection(settings.thresholds, (d) => ({ thresholds: d }));
  const { apply, tailor } = s.draft;
  const ok = tailor < apply;
  const lo = Math.min(tailor, apply);
  const hi = Math.max(tailor, apply);

  return (
    <SettingsSection
      title="Matching"
      description="Each job gets a 0–100 match score against your resume. These thresholds decide what happens next."
      dirty={s.dirty}
      status={s.status}
      error={s.error}
      invalid={ok ? null : "The tailor threshold must be lower than the apply threshold."}
      onSave={s.save}
      onReset={s.reset}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Slider label="Apply threshold" value={apply} onChange={(v) => s.setDraft((d) => ({ ...d, apply: v }))} hint="At or above this score the job is marked Ready." />
        <Slider label="Tailor threshold" value={tailor} onChange={(v) => s.setDraft((d) => ({ ...d, tailor: v }))} hint="Between this and the apply score, the resume is tailored first." />
      </div>

      <div className="mt-6">
        <div className="flex h-7 w-full overflow-hidden rounded-md border border-border text-[11px] font-medium">
          <div className="flex items-center justify-center bg-surface-2 text-muted" style={{ width: `${lo}%` }}>{lo >= 10 && "Skip"}</div>
          <div className="flex items-center justify-center bg-indigo-soft text-indigo border-x border-border" style={{ width: `${hi - lo}%` }}>{hi - lo >= 10 && "Tailor"}</div>
          <div className="flex items-center justify-center bg-accent-soft text-accent-strong" style={{ width: `${100 - hi}%` }}>{100 - hi >= 10 && "Apply"}</div>
        </div>
        <p className="mt-2 text-[13px] text-muted tabular-nums">
          &lt; {tailor}: skip · {tailor}–{apply - 1}: tailor resume · ≥ {apply}: apply
        </p>
      </div>
    </SettingsSection>
  );
}

export function CoverLetterSection({ settings }: { settings: Settings }) {
  const s = useSection(settings.coverLetter, (d) => ({ coverLetter: d }));
  return (
    <SettingsSection
      title="Cover letters"
      description="Cover letters are written from your resume and facts for each job, never invented."
      dirty={s.dirty}
      status={s.status}
      error={s.error}
      onSave={s.save}
      onReset={s.reset}
    >
      <div className="grid gap-5 sm:grid-cols-2 sm:max-w-xl">
        <Field label="When to write one">
          <Select value={s.draft.mode} onChange={(e) => s.setDraft((d) => ({ ...d, mode: e.target.value as Settings["coverLetter"]["mode"] }))}>
            <option value="when_required">Only when required</option>
            <option value="always">Always</option>
          </Select>
        </Field>
        <Field label="Tone">
          <Select value={s.draft.tone} onChange={(e) => s.setDraft((d) => ({ ...d, tone: e.target.value as Settings["coverLetter"]["tone"] }))}>
            <option value="professional">Professional</option>
            <option value="warm">Warm</option>
            <option value="concise">Concise</option>
          </Select>
        </Field>
      </div>
    </SettingsSection>
  );
}
