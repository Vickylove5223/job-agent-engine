import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, Check, Download, ExternalLink, FileText, Loader2, Mail, MessageCircleQuestion, Play, RotateCcw, Send, X } from "lucide-react";
import type { Gap, Job, JobStatus, Resume, WithId } from "@shared/types";
import { canTransition } from "@shared/status";
import { logActivity, nowIso, updateDocument, useCollection, useDoc } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";
import { Badge, Button, Drawer, EmptyState, LoadingBlock, Tabs, cx, type Tone } from "@/components/ui";
import { ScoreRing, SourceLabel, StatusBadge, getSourceInfo } from "@/components/domain";

type Section = "overview" | "resume" | "cover" | "application";

function cleanUrl(url?: string, company?: string): string {
  if (!url) return "";
  // Fix known ATS mismatches or broken seeds
  if (/greenhouse\.io\/posthog/i.test(url) || (company && /posthog/i.test(company) && /greenhouse/i.test(url))) {
    return "https://jobs.ashbyhq.com/posthog";
  }
  if (/greenhouse\.io\/linear/i.test(url) || (company && /linear/i.test(company) && /greenhouse/i.test(url))) {
    return "https://jobs.ashbyhq.com/linear";
  }
  if (/greenhouse\.io\/supabase/i.test(url) || (company && /supabase/i.test(company) && /greenhouse/i.test(url))) {
    return "https://jobs.ashbyhq.com/supabase";
  }
  if (/greenhouse\.io\/automattic/i.test(url)) {
    return "https://automattic.com/work-with-us/";
  }
  return url;
}

export function JobDrawer({ job, onClose }: { job: WithId<Job> | null; onClose: () => void }) {
  const [section, setSection] = useState<Section>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);

  // Reset inner tab when a different job opens.
  if (job && job.id !== lastId) {
    setLastId(job.id);
    setSection("overview");
  }
  if (!job) return null;

  const isCurrentlyApplying = job.status === "applying";

  const act = async (key: string, to: JobStatus, patch: Partial<Job>, message: string) => {
    setBusy(key);
    try {
      await updateDocument("jobs", job.id, { ...patch, status: to, updatedAt: nowIso() });
      await logActivity("info", "manual", message, job.id);
    } finally {
      setBusy(null);
    }
  };

  const s = job.status;
  const canSkip = canTransition(s, "skipped");
  const canRetry = canTransition(s, "new") && (s === "blocked" || s === "failed" || s === "skipped" || s === "waiting_input");
  const canApply = canTransition(s, "ready");
  const label = `${job.title} at ${job.company}`;

  const footer = canSkip || canRetry || canApply ? (
    <>
      {canSkip && (
        <Button variant="danger" icon={<X className="size-4" />} loading={busy === "skip"} disabled={!!busy}
          onClick={() => act("skip", "skipped", { skipReason: "Skipped by you" }, `Skipped ${label}`)}>
          Skip
        </Button>
      )}
      {canRetry && (
        <Button icon={<RotateCcw className="size-4" />} loading={busy === "retry"} disabled={!!busy}
          onClick={() => act("retry", "new", { attempts: 0, error: "", skipReason: "" }, `Retry requested for ${label}`)}>
          Retry
        </Button>
      )}
      {canApply && (
        <Button variant="primary" icon={isCurrentlyApplying ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} loading={busy === "apply" || isCurrentlyApplying} disabled={!!busy || isCurrentlyApplying}
          onClick={() => act("apply", "ready", { error: "", skipReason: "" }, `Queued for the agent: ${job.title} at ${job.company}`)}>
          {isCurrentlyApplying ? "Applying..." : "Apply now"}
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-3xl"
      title={job.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{job.company}</span>
          <span className="text-faint">·</span>
          <span>{job.location || "—"}</span>
          <span className="text-faint">·</span>
          <SourceLabel source={job.source} url={getSourceInfo(job).url} />
          <span className="text-faint">·</span>
          <span>posted {timeAgo(job.postedAt ?? job.foundAt)}</span>
        </span>
      }
      footer={footer}
    >
      {isCurrentlyApplying && (
        <div className="mb-5 rounded-lg border border-accent/40 bg-accent-soft/30 p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-bold text-accent-strong flex items-center gap-1.5 uppercase tracking-wider">
              <Loader2 className="size-3.5 animate-spin text-accent" /> Application in progress
            </span>
            <span className="text-xs font-semibold text-text">In progress</span>
          </div>
          <div className="text-sm font-semibold text-text">
            The agent is filling in this application in a hosted browser.
          </div>
          <div className="text-xs text-muted font-mono mt-1">
            It is marked Applied only after the employer confirms the submission.
          </div>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <ScoreRing score={job.score?.master} size={52} />
          <div className="text-xs text-muted leading-tight">Master<br />resume</div>
        </div>
        {job.score?.tailored !== undefined && (
          <div className="flex items-center gap-3">
            <ScoreRing score={job.score.tailored} size={52} />
            <div className="text-xs text-muted leading-tight">Tailored<br />resume</div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={job.status} />
          {job.remote && <Badge tone="green">Remote</Badge>}
          {job.sample && <Badge>Sample</Badge>}
        </div>
        <div className="flex flex-wrap gap-3 sm:ml-auto text-sm">
          {job.url && (
            <a href={cleanUrl(job.url, job.company)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:underline">
              Open posting <ExternalLink className="size-3.5" />
            </a>
          )}
          {job.applyUrl && job.applyUrl !== job.url && (
            <a href={cleanUrl(job.applyUrl, job.company)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-muted hover:text-text hover:underline">
              Apply page <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      <Tabs<Section>
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "resume", label: "Resume" },
          { value: "cover", label: "Cover letter" },
          { value: "application", label: "Application" },
        ]}
        value={section}
        onChange={setSection}
      />

      {section === "overview" && <Overview job={job} />}
      {section === "resume" && <ResumeSection job={job} />}
      {section === "cover" && <CoverSection job={job} />}
      {section === "application" && <ApplicationSection job={job} />}
    </Drawer>
  );
}

// ---------- shared bits ----------
function Block({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("mb-6", className)}>
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}

function PdfDownload({ base64, fileName, label }: { base64: string; fileName: string; label: string }) {
  return (
    <a href={`data:application/pdf;base64,${base64}`} download={fileName}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-[13px] font-medium hover:bg-surface-2">
      <Download className="size-4" /> {label}
    </a>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "job";
}

// ---------- Overview ----------
const gapTone: Record<Gap["kind"], { tone: Tone; label: string }> = {
  wording: { tone: "neutral", label: "Wording" },
  missing_fact: { tone: "amber", label: "Needs your answer" },
  true_gap: { tone: "red", label: "Real gap" },
};

function Overview({ job }: { job: WithId<Job> }) {
  const { data: questions } = useCollection("questions");
  const linked = questions.filter((q) => q.status === "open" && (q.jobIds?.includes(job.id) || job.questionIds?.includes(q.id)));
  const [expanded, setExpanded] = useState(false);
  const reasons = job.score?.reasons ?? [];
  const gaps = job.gaps ?? [];
  const longDesc = (job.description ?? "").length > 1200;

  return (
    <div>
      {(job.error || job.skipReason) && (
        <div className="mb-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger flex gap-2.5">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0 break-words">
            {job.skipReason && <div><span className="font-medium">Skipped:</span> {job.skipReason}</div>}
            {job.error && <div><span className="font-medium">Error:</span> {job.error}</div>}
          </div>
        </div>
      )}

      <Block title="Why it matches">
        {reasons.length ? (
          <ul className="space-y-1.5 text-sm">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2"><Check className="size-4 shrink-0 mt-0.5 text-accent-strong" /><span>{r}</span></li>
            ))}
          </ul>
        ) : <p className="text-sm text-faint">Not scored yet.</p>}
      </Block>

      {gaps.length > 0 && (
        <Block title="Gaps">
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {gaps.map((g, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">{g.item}</span>
                <Badge tone={gapTone[g.kind]?.tone ?? "neutral"}>{gapTone[g.kind]?.label ?? g.kind}</Badge>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {linked.length > 0 && (
        <Block title="Open questions">
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {linked.map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex gap-2 min-w-0">
                  <MessageCircleQuestion className="size-4 shrink-0 mt-0.5 text-warning" />
                  <span>{q.text}</span>
                </span>
                <Link to="/questions" className="shrink-0 font-medium text-accent-strong hover:underline">Answer</Link>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Job description">
        {job.description ? (
          <>
            <div className={cx("relative whitespace-pre-line break-words text-sm leading-relaxed", !expanded && longDesc && "max-h-80 overflow-hidden")}>
              {job.description}
              {!expanded && longDesc && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg to-transparent" />}
            </div>
            {longDesc && (
              <button type="button" className="mt-2 text-sm font-medium text-muted hover:text-text cursor-pointer" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </>
        ) : <p className="text-sm text-faint">No description captured.</p>}
      </Block>
    </div>
  );
}

// ---------- Resume ----------
function ResumeSection({ job }: { job: WithId<Job> }) {
  const { data: tailored, loading } = useDoc("resumes", job.id);
  const { data: profile } = useDoc("profile", "main");
  const master = profile?.masterResume?.structured;

  if (loading) return <LoadingBlock />;
  if (!tailored) {
    const willTailor = job.status === "needs_tailoring";
    return (
      <EmptyState
        icon={<FileText className="size-7" />}
        title={willTailor ? "Tailored resume is generated before applying" : "Master resume will be used"}
        description={willTailor
          ? "The agent will rewrite your resume for this role, without inventing facts, before it applies."
          : "No tailored version exists for this job. Your master resume is used as-is."}
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">Tailored {timeAgo(tailored.createdAt)} · score <span className="font-medium text-text">{tailored.score}</span></div>
        {tailored.pdfBase64 && <PdfDownload base64={tailored.pdfBase64} fileName={`resume-${slug(job.company)}.pdf`} label="Download PDF" />}
      </div>

      {tailored.changes?.length > 0 && (
        <Block title="What changed">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {tailored.changes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </Block>
      )}

      <ResumeDiff tailored={tailored.structured} master={master} />
    </div>
  );
}

function ResumeDiff({ tailored, master }: { tailored: Resume; master?: Resume }) {
  const masterBullets = new Set((master?.experience ?? []).flatMap((e) => e.bullets.map((b) => b.trim())));
  const masterSkills = new Set(Object.values(master?.skills ?? {}).flat().map((s) => s.toLowerCase()));
  const summaryChanged = !!master && master.summary?.trim() !== tailored.summary?.trim();

  return (
    <div>
      <Block title="Summary">
        {summaryChanged ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <div className="mb-1 text-xs font-medium text-faint">Master</div>
              <p className="text-sm text-muted">{master!.summary || "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-accent-soft p-3">
              <div className="mb-1 text-xs font-medium text-accent-strong">Tailored</div>
              <p className="text-sm">{tailored.summary || "—"}</p>
            </div>
          </div>
        ) : <p className="text-sm">{tailored.summary || "—"}</p>}
      </Block>

      {Object.keys(tailored.skills ?? {}).length > 0 && (
        <Block title="Skills">
          <div className="space-y-2">
            {Object.entries(tailored.skills).map(([group, items]) => (
              <div key={group} className="text-sm">
                <span className="font-medium">{group}: </span>
                {items.map((s, i) => (
                  <span key={s + i}>
                    <span className={cx(master && !masterSkills.has(s.toLowerCase()) && "rounded bg-accent-soft px-1")}>{s}</span>
                    {i < items.length - 1 && ", "}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Block>
      )}

      {tailored.experience?.length > 0 && (
        <Block title="Experience">
          <div className="space-y-5">
            {tailored.experience.map((e, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <div className="text-sm font-semibold">{e.title} · <span className="font-normal text-muted">{e.company}</span></div>
                  <div className="text-xs text-faint">{e.start} – {e.end}</div>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {e.bullets.map((b, j) => {
                    const changed = !!master && !masterBullets.has(b.trim());
                    return (
                      <li key={j} className={cx("rounded px-2 py-1 text-sm", changed ? "bg-accent-soft" : "text-muted")}>
                        {b}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {master && <p className="mt-3 text-xs text-faint">Highlighted lines differ from your master resume.</p>}
        </Block>
      )}
    </div>
  );
}

// ---------- Cover letter ----------
function CoverSection({ job }: { job: WithId<Job> }) {
  const { data: letter, loading } = useDoc("coverLetters", job.id);
  if (loading) return <LoadingBlock />;
  if (!letter) {
    return (
      <EmptyState
        icon={<Mail className="size-7" />}
        title="No cover letter"
        description="A cover letter is written only when the application asks for one, or always if you enabled that in Settings."
      />
    );
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">Written {timeAgo(letter.createdAt)}</div>
        {letter.pdfBase64 && <PdfDownload base64={letter.pdfBase64} fileName={`cover-letter-${slug(job.company)}.pdf`} label="Download PDF" />}
      </div>
      <div className="whitespace-pre-line break-words rounded-lg border border-border bg-surface p-5 text-[15px] leading-relaxed">
        {letter.text}
      </div>
    </div>
  );
}

// ---------- Application ----------
function ApplicationSection({ job }: { job: WithId<Job> }) {
  const { data: app, loading } = useDoc("applications", job.id);
  if (loading) return <LoadingBlock />;
  if (!app) {
    return (
      <EmptyState
        icon={<Send className="size-7" />}
        title="Not applied yet"
        description="Once the agent submits this application, the answers it gave and a screenshot of the confirmation appear here."
      />
    );
  }
  const siteLabel = app.site === "ats" ? "Company ATS" : app.site === "linkedin" ? "LinkedIn" : "Indeed";
  const sourceInfo = getSourceInfo(job);
  return (
    <div>
      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {[
          ["Submitted", formatDateTime(app.submittedAt)],
          ["Site", sourceInfo.url ? (
            <a href={sourceInfo.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline text-text">
              {siteLabel} ({sourceInfo.label}) <ExternalLink className="size-3 text-muted" />
            </a>
          ) : siteLabel],
          ["Resume", app.resumeUsed === "tailored" ? "Tailored" : "Master"],
          ["Cover letter", app.coverLetterUsed ? "Included" : "None"],
        ].map(([k, v]) => (
          <div key={String(k)} className="bg-surface p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-0.5 text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {app.screenshotJpegBase64 ? (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span><strong>Verified Browser Submission:</strong> Live confirmation screenshot captured directly from the job portal after form submission.</span>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-semibold">Simulated / Demonstration Record:</span> No browser screenshot receipt captured. Real live applications executed by the browser agent capture a live submission screenshot.
          </div>
        </div>
      )}

      {app.notes && <Block title="Notes"><p className="whitespace-pre-line text-sm">{app.notes}</p></Block>}

      <Block title="Answers given">
        {app.answers?.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-4 py-2.5 text-left text-[13px] font-semibold">Question</th>
                  <th className="border-b border-border px-4 py-2.5 text-left text-[13px] font-semibold">Answer</th>
                </tr>
              </thead>
              <tbody>
                {app.answers.map((a, i) => (
                  <tr key={i} className="align-top">
                    <td className="border-b border-border px-4 py-2.5 text-muted">{a.question}</td>
                    <td className="border-b border-border px-4 py-2.5">{a.answer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-faint">No extra questions were asked.</p>}
      </Block>

      {app.screenshotJpegBase64 && (
        <Block title="Confirmation screenshot">
          <img src={`data:image/jpeg;base64,${app.screenshotJpegBase64}`} alt="Application confirmation" className="w-full rounded-lg border border-border" />
        </Block>
      )}
    </div>
  );
}
