import { useState } from "react";
import type { Settings, Site } from "@shared/types";
import { Field, Input, Switch, cx } from "@/components/ui";
import { logActivity, updateDocument } from "@/lib/db";
import { SettingsSection, numberFrom, useSection } from "./SettingsSection";

const SITES: { key: Site; label: string }[] = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "indeed", label: "Indeed" },
  { key: "ats", label: "Company ATS" },
];

function PauseToggle({ paused }: { paused: boolean }) {
  const [busy, setBusy] = useState(false);
  const running = !paused;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", running ? "bg-accent" : "bg-faint")} />
        <div>
          <div className="font-semibold">{running ? "Running" : "Paused"}</div>
          <p className="text-sm text-muted mt-0.5">
            {running
              ? "The agent applies to Ready jobs within your daily caps. Scanning and scoring continue either way."
              : "No applications are submitted. Jobs keep being found and scored so they're ready when you resume."}
          </p>
          <p className="text-xs text-faint mt-1">Takes effect immediately.</p>
        </div>
      </div>
      <div className="scale-125 origin-left sm:origin-right shrink-0 pl-1 sm:pl-0">
        <Switch
          checked={running}
          disabled={busy}
          onChange={async (v) => {
            setBusy(true);
            try {
              await updateDocument("settings", "main", { paused: !v });
              await logActivity("info", v ? "agent_resumed" : "agent_paused", v ? "Agent resumed from Settings" : "Agent paused from Settings");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
}

export function AgentSection({ settings }: { settings: Settings }) {
  const s = useSection(
    { dailyCaps: settings.dailyCaps, pacingMinutes: settings.pacingMinutes },
    (d) => d,
  );
  const { dailyCaps, pacingMinutes } = s.draft;
  const invalid =
    Object.values(dailyCaps).some((n) => n < 0) ? "Daily caps can't be negative."
    : pacingMinutes.min < 0 ? "Pacing can't be negative."
    : pacingMinutes.min > pacingMinutes.max ? "Minimum pacing must be less than or equal to maximum."
    : null;

  return (
    <SettingsSection
      title="Agent"
      description="Pause or resume automatic applying, and control how many applications go out per day and how fast."
      dirty={s.dirty}
      status={s.status}
      error={s.error}
      invalid={invalid}
      onSave={s.save}
      onReset={s.reset}
      footerNote="Caps reset at midnight in your time zone."
    >
      <PauseToggle paused={settings.paused} />

      <div className="mt-6">
        <div className="text-[13px] font-semibold mb-2">Daily caps</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SITES.map(({ key, label }) => (
            <Field key={key} label={label} hint="applications / day">
              <Input
                type="number"
                min={0}
                value={dailyCaps[key]}
                onChange={(e) => s.setDraft((d) => ({ ...d, dailyCaps: { ...d.dailyCaps, [key]: numberFrom(e.target.value) } }))}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="text-[13px] font-semibold mb-2">Pacing between applications</div>
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <Field label="Minimum" hint="minutes">
            <Input
              type="number"
              min={0}
              value={pacingMinutes.min}
              onChange={(e) => s.setDraft((d) => ({ ...d, pacingMinutes: { ...d.pacingMinutes, min: numberFrom(e.target.value) } }))}
            />
          </Field>
          <Field label="Maximum" hint="minutes">
            <Input
              type="number"
              min={0}
              value={pacingMinutes.max}
              onChange={(e) => s.setDraft((d) => ({ ...d, pacingMinutes: { ...d.pacingMinutes, max: numberFrom(e.target.value) } }))}
            />
          </Field>
        </div>
        <p className="text-xs text-faint mt-2">The agent waits a random time in this range so activity looks human.</p>
      </div>
    </SettingsSection>
  );
}
