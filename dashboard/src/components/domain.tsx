// Domain widgets shared across pages: status badges, score ring, source labels, activity rows.
import type { ActivityEntry, JobSource, JobStatus, Outcome } from "@shared/types";
import { STATUS_LABEL } from "@shared/status";
import { Badge, cx, type Tone } from "./ui";
import { timeAgo } from "@/lib/format";

const statusTone: Record<JobStatus, Tone> = {
  new: "neutral", scored: "neutral", needs_tailoring: "indigo", waiting_input: "amber", ready: "blue",
  applying: "blue", applied: "green", skipped: "neutral", blocked: "red", failed: "red",
};
export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge tone={statusTone[status]} dot className={status === "applying" ? "animate-pulse" : undefined}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const outcomeTone: Record<Outcome, Tone> = { submitted: "neutral", interview: "blue", offer: "green", rejected: "red", ghosted: "neutral" };
export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return <Badge tone={outcomeTone[outcome]}>{outcome[0].toUpperCase() + outcome.slice(1)}</Badge>;
}

/** Circular match score: <60 red, 60–79 amber, ≥80 green. */
export function ScoreRing({ score, size = 36 }: { score?: number; size?: number }) {
  if (score === undefined || score === null) return <span className="text-faint">—</span>;
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--accent-strong)" : score >= 60 ? "var(--warning)" : "var(--danger)";
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} title={`Match score ${score}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums">{score}</span>
    </span>
  );
}

export const SOURCE_LABEL: Record<JobSource, string> = {
  greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", remoteok: "RemoteOK", adzuna: "Adzuna", linkedin: "LinkedIn", indeed: "Indeed",
};
const sourceColor: Record<JobSource, string> = {
  greenhouse: "#3ab549", lever: "#6b7280", ashby: "#5b5bd6", remoteok: "#ff4742", adzuna: "#2f6fed", linkedin: "#0a66c2", indeed: "#2557a7",
};
export function SourceLabel({ source }: { source: JobSource }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="size-2 rounded-sm" style={{ background: sourceColor[source] }} />
      {SOURCE_LABEL[source]}
    </span>
  );
}

const levelColor: Record<ActivityEntry["level"], string> = {
  info: "bg-faint", success: "bg-accent", warn: "bg-warning", error: "bg-danger",
};
export function ActivityRow({ entry, compact }: { entry: ActivityEntry; compact?: boolean }) {
  return (
    <div className={cx("flex items-start gap-3", compact ? "py-2.5" : "py-3")}>
      <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", levelColor[entry.level])} />
      <div className="min-w-0 flex-1">
        <div className={cx("text-sm", entry.level === "error" && "text-danger")}>{entry.message}</div>
        <div className="text-xs text-faint mt-0.5">{entry.type} · {timeAgo(entry.ts)}</div>
      </div>
    </div>
  );
}
