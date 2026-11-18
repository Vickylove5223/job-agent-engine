import type { JobStatus } from "./types";

// Job status machine — PLAN.md section 5.
const transitions: Record<JobStatus, JobStatus[]> = {
  // "ready" from new/skipped is the user's manual "Apply now" override.
  new: ["scored", "skipped", "waiting_input", "ready"],
  scored: ["ready", "needs_tailoring", "waiting_input", "skipped"],
  needs_tailoring: ["ready", "skipped", "waiting_input", "new"],
  waiting_input: ["new", "skipped"],
  ready: ["applying", "skipped", "new"],
  applying: ["applied", "waiting_input", "blocked", "failed", "ready"],
  applied: [],
  skipped: ["new", "ready"],
  blocked: ["ready", "new", "skipped"],
  failed: ["new", "ready", "skipped"],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return transitions[from].includes(to);
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  new: "New",
  scored: "Scored",
  needs_tailoring: "Tailoring",
  waiting_input: "Waiting on you",
  ready: "Ready",
  applying: "Applying",
  applied: "Applied",
  skipped: "Skipped",
  blocked: "Blocked",
  failed: "Failed",
};
