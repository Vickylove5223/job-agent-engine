// Domain widgets shared across pages: status badges, score ring, source labels, activity rows.
import { ExternalLink } from "lucide-react";
import type { ActivityEntry, JobSource, JobStatus, Outcome } from "@shared/types";
import { STATUS_LABEL } from "@shared/status";
import { JOB_SITES } from "@shared/sites";
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
/** Any site id from the catalog (the scanner uses more sources than the JobSource union). */
export const sourceName = (source: string) =>
  SOURCE_LABEL[source as JobSource] ?? JOB_SITES.find((s) => s.id === source)?.name ?? source;

export function getSourceInfo(job?: { source?: string; company?: string; url?: string; applyUrl?: string }): { label: string; url: string } {
  if (!job) return { label: "", url: "" };
  const src = (job.source || "").toLowerCase();
  const comp = (job.company || "").toLowerCase();
  const rawUrl = job.url || job.applyUrl || "";

  // 1. Check if rawUrl already has a specific board
  if (/jobs\.ashbyhq\.com\/([^/?#]+)/i.test(rawUrl)) {
    const slug = rawUrl.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i)?.[1];
    return { label: "Ashby", url: `https://jobs.ashbyhq.com/${slug}` };
  }
  if (/boards\.greenhouse\.io\/([^/?#]+)/i.test(rawUrl) && !/posthog/i.test(rawUrl)) {
    const slug = rawUrl.match(/boards\.greenhouse\.io\/([^/?#]+)/i)?.[1];
    return { label: "Greenhouse", url: `https://boards.greenhouse.io/${slug}` };
  }
  if (/jobs\.lever\.co\/([^/?#]+)/i.test(rawUrl)) {
    const slug = rawUrl.match(/jobs\.lever\.co\/([^/?#]+)/i)?.[1];
    return { label: "Lever", url: `https://jobs.lever.co/${slug}` };
  }

  // 2. Company specific mappings for known boards
  if (/posthog/i.test(comp)) {
    return { label: "Ashby", url: "https://jobs.ashbyhq.com/posthog" };
  }
  if (/linear/i.test(comp)) {
    return { label: "Ashby", url: "https://jobs.ashbyhq.com/linear" };
  }
  if (/supabase/i.test(comp)) {
    return { label: "Ashby", url: "https://jobs.ashbyhq.com/supabase" };
  }
  if (/canonical/i.test(comp)) {
    return { label: "Greenhouse", url: "https://boards.greenhouse.io/canonical" };
  }
  if (/gitlab/i.test(comp)) {
    return { label: "Greenhouse", url: "https://boards.greenhouse.io/gitlab" };
  }
  if (/elastic/i.test(comp)) {
    return { label: "Greenhouse", url: "https://boards.greenhouse.io/elastic" };
  }
  if (/stripe/i.test(comp)) {
    return { label: "Greenhouse", url: "https://boards.greenhouse.io/stripe" };
  }
  if (/dept/i.test(comp)) {
    return { label: "Greenhouse", url: "https://boards.greenhouse.io/dept" };
  }
  if (/automattic/i.test(comp)) {
    return { label: "Lever", url: "https://automattic.com/work-with-us/" };
  }

  // 3. Fallback by source type
  if (src === "ashby") return { label: "Ashby", url: "https://jobs.ashbyhq.com" };
  if (src === "greenhouse") return { label: "Greenhouse", url: "https://boards.greenhouse.io" };
  if (src === "lever") return { label: "Lever", url: "https://jobs.lever.co" };
  if (src === "remoteok") return { label: "RemoteOK", url: "https://remoteok.com" };
  if (src === "remotive") return { label: "Remotive", url: "https://remotive.com" };
  if (src === "weworkremotely") return { label: "WeWorkRemotely", url: "https://weworkremotely.com" };
  if (src === "linkedin" || src === "linkedin_easy") return { label: "LinkedIn", url: "https://www.linkedin.com/jobs" };
  if (src === "indeed") return { label: "Indeed", url: "https://www.indeed.com" };

  return { label: sourceName(src) || "Source", url: rawUrl || "" };
}

export function SourceLabel({ source, url }: { source: JobSource | string; url?: string }) {
  const content = (
    <span className="inline-flex items-center gap-1.5 text-sm group">
      <span className="size-2 rounded-sm" style={{ background: sourceColor[source as JobSource] ?? "var(--text-faint)" }} />
      <span>{sourceName(source)}</span>
      {url && <ExternalLink className="size-3 text-muted group-hover:text-text opacity-70 transition-opacity" />}
    </span>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center hover:underline text-text"
        title={`Visit source board (${sourceName(source)})`}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </a>
    );
  }

  return content;
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
