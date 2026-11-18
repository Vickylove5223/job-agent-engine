import type { ReactNode } from "react";
import { Eye, Rocket } from "lucide-react";
import { countryName } from "@shared/sites";
import { Field, Input, Select, cx } from "@/components/ui";
import { JOB_TYPE_OPTIONS, SENIORITY_OPTIONS, WORK_MODE_OPTIONS, formatMoney, labelOf, yearlySalary } from "../draft";
import { Label, type StepProps } from "../bits";

export function StepAutopilot({ draft, set, goTo }: StepProps & { goTo: (step: number) => void }) {
  const salary = yearlySalary(draft);
  const tailor = Math.max(0, draft.applyThreshold - 20);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-surface divide-y divide-border">
        <Row label="You" step={1} goTo={goTo}>
          {draft.fullName}{draft.city || draft.country ? ` · ${[draft.city, draft.country && countryName(draft.country)].filter(Boolean).join(", ")}` : ""}
        </Row>
        <Row label="Resume" step={2} goTo={goTo}>
          {draft.resume ? draft.resume.fileName : <span className="text-warning">Not uploaded yet</span>}
        </Row>
        <Row label="Roles" step={3} goTo={goTo}>
          {draft.roles.join(", ")}
          <span className="text-muted"> · {draft.seniority.map((s) => labelOf(SENIORITY_OPTIONS, s)).join(", ")}</span>
        </Row>
        <Row label="Where" step={4} goTo={goTo}>
          {draft.workModes.map((m) => labelOf(WORK_MODE_OPTIONS, m)).join(", ")}
          {draft.countries.length > 0 && <span className="text-muted"> · {draft.countries.map(countryName).join(", ")}</span>}
          {draft.sponsorship && <span className="text-muted"> · needs sponsorship</span>}
        </Row>
        <Row label="Pay & type" step={5} goTo={goTo}>
          {salary !== null ? `${formatMoney(draft.currency, salary)}+/year` : "Any salary"}
          <span className="text-muted"> · {draft.jobTypes.map((t) => labelOf(JOB_TYPE_OPTIONS, t)).join(", ")}</span>
        </Row>
        <Row label="Job sites" step={6} goTo={goTo}>
          {(draft.enabledSites ?? []).length} sites
        </Row>
      </section>

      <div>
        <Label hint="The most applications the agent sends per day on each kind of site.">Daily application limit</Label>
        <div className="grid grid-cols-3 gap-3">
          <Field label={<span className="text-xs text-muted font-normal">LinkedIn</span>}>
            <Input type="number" min={0} max={100} value={draft.capLinkedin} onChange={(e) => set({ capLinkedin: e.target.value })} />
          </Field>
          <Field label={<span className="text-xs text-muted font-normal">Indeed</span>}>
            <Input type="number" min={0} max={100} value={draft.capIndeed} onChange={(e) => set({ capIndeed: e.target.value })} />
          </Field>
          <Field label={<span className="text-xs text-muted font-normal">Company sites</span>}>
            <Input type="number" min={0} max={200} value={draft.capAts} onChange={(e) => set({ capAts: e.target.value })} />
          </Field>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <Label hint={`Jobs scoring ${draft.applyThreshold}+ get an application. Jobs from ${tailor} get a tailored resume first.`}>Match threshold</Label>
          <span className="text-sm font-semibold tabular-nums">{draft.applyThreshold}</span>
        </div>
        <input
          type="range"
          min={50}
          max={95}
          step={5}
          value={draft.applyThreshold}
          onChange={(e) => set({ applyThreshold: Number(e.target.value) })}
          className="w-full accent-accent-strong cursor-pointer"
          aria-label="Match threshold"
        />
        <div className="flex justify-between text-[11px] text-faint"><span>More applications</span><span>Better matches</span></div>
      </div>

      <Field label="Cover letters" className="max-w-xs">
        <Select value={draft.coverLetter} onChange={(e) => set({ coverLetter: e.target.value as "when_required" | "always" })}>
          <option value="when_required">Only when required</option>
          <option value="always">Always</option>
        </Select>
      </Field>

      <div>
        <Label>How should the agent start?</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice
            on={!draft.paused}
            onClick={() => set({ paused: false })}
            icon={<Rocket className="size-5" />}
            title="Start applying automatically"
            badge="Recommended"
            text="The agent begins finding and applying to matching jobs right away."
          />
          <Choice
            on={draft.paused}
            onClick={() => set({ paused: true })}
            icon={<Eye className="size-5" />}
            title="Start paused — I'll review first"
            text="Jobs are found and scored, but nothing is sent until you press Resume."
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, step, goTo, children }: { label: string; step: number; goTo: (s: number) => void; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="w-24 shrink-0 text-[13px] text-muted">{label}</div>
      <div className="min-w-0 flex-1 text-sm break-words">{children}</div>
      <button type="button" onClick={() => goTo(step)} className="text-[13px] font-medium text-muted hover:text-text underline-offset-2 hover:underline cursor-pointer">
        Edit
      </button>
    </div>
  );
}

function Choice({ on, onClick, icon, title, text, badge }: { on: boolean; onClick: () => void; icon: ReactNode; title: string; text: string; badge?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors cursor-pointer",
        on ? "border-primary bg-surface ring-1 ring-primary" : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className={cx("grid size-9 place-items-center rounded-md", on ? "bg-accent-soft text-accent-strong" : "bg-surface-2 text-muted")}>{icon}</span>
        {badge && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong">{badge}</span>}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-[13px] text-muted">{text}</div>
    </button>
  );
}
