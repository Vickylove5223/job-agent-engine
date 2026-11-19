// "Find jobs & apply" — asks the cloud agent to run now. The agent (GitHub Actions, every 5 min)
// sees workerStatus.runRequestedAt, searches immediately and applies to jobs at/above the threshold.
import type { Settings, WorkerStatus } from "@shared/types";
import { logActivity, nowIso, updateDocument } from "./db";

export const APPLY_MIN_SCORE = 50;

export async function requestRun(settings: Settings | null, minScore = APPLY_MIN_SCORE) {
  const apply = minScore;
  const tailor = Math.min(settings?.thresholds?.tailor ?? apply - 10, apply - 5);
  await updateDocument("settings", "main", { paused: false, thresholds: { apply, tailor } });
  await updateDocument("workerStatus", "main", { runRequestedAt: nowIso() });
  await logActivity("info", "run_requested", `You asked the agent to search now and apply to jobs scoring ${apply}% or more`);
}

export type RunPhase = "idle" | "queued" | "running";

/** queued: waiting for the cloud agent to pick it up; running: agent checked in after the request. */
export function runPhase(w: WorkerStatus | null | undefined): RunPhase {
  if (!w?.runRequestedAt) return "idle";
  const startedAfter = w.heartbeatAt && w.heartbeatAt > w.runRequestedAt;
  if (!startedAfter) return Date.now() - new Date(w.runRequestedAt).getTime() < 20 * 60_000 ? "queued" : "idle";
  return w.state && w.state !== "idle" && w.state !== "paused" ? "running" : "idle";
}
