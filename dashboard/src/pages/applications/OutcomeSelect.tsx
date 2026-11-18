import { useState } from "react";
import type { Outcome } from "@shared/types";
import { Select, cx } from "@/components/ui";
import { logActivity, updateDocument } from "@/lib/db";
import { OUTCOMES, OUTCOME_LABEL, type AppRow } from "./shared";

export async function setOutcome(app: AppRow, outcome: Outcome) {
  if (outcome === app.outcome) return;
  await updateDocument("applications", app.id, { outcome });
  const what = app.job ? `${app.job.title} at ${app.job.company}` : app.id;
  await logActivity("info", "outcome_changed", `Outcome for ${what} set to ${OUTCOME_LABEL[outcome]}`, app.id);
}

/** Inline outcome dropdown; clicks don't bubble to the row. */
export function OutcomeSelect({ app, className }: { app: AppRow; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Select
      value={app.outcome}
      disabled={busy}
      aria-label="Outcome"
      className={cx("h-8 w-auto min-w-32 text-[13px]", className)}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        setBusy(true);
        try {
          await setOutcome(app, e.target.value as Outcome);
        } finally {
          setBusy(false);
        }
      }}
    >
      {OUTCOMES.map((o) => (
        <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>
      ))}
    </Select>
  );
}
