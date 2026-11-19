import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { Badge, Button, Drawer, Textarea } from "@/components/ui";
import { ScoreRing, SourceLabel } from "@/components/domain";
import { updateDocument } from "@/lib/db";
import { formatDateTime, formatSalary } from "@/lib/format";
import { OutcomeSelect } from "./OutcomeSelect";
import { SITE_LABEL, type AppRow } from "./shared";

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-faint">{label}</div>
      <div className="text-sm mt-0.5 truncate">{children}</div>
    </div>
  );
}

function Notes({ app }: { app: AppRow }) {
  const [text, setText] = useState(app.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = text !== (app.notes ?? "");
  return (
    <div>
      <Textarea
        value={text}
        placeholder="Recruiter name, interview dates, follow-ups…"
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <div className="mt-2 flex items-center justify-end gap-3">
        {saved && !dirty && <span className="inline-flex items-center gap-1 text-xs text-accent-strong"><Check className="size-3.5" />Saved</span>}
        <Button
          size="sm"
          variant="primary"
          disabled={!dirty}
          loading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await updateDocument("applications", app.id, { notes: text });
              setSaved(true);
            } finally {
              setSaving(false);
            }
          }}
        >
          Save notes
        </Button>
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[13px] font-semibold mb-2 mt-6">{children}</h3>;
}

export function ApplicationDrawer({ app, onClose }: { app: AppRow | null; onClose: () => void }) {
  const job = app?.job;
  return (
    <Drawer
      open={!!app}
      onClose={onClose}
      title={job?.title ?? "Application"}
      subtitle={job ? `${job.company} · ${job.location || (job.remote ? "Remote" : "—")}` : app?.id}
      footer={
        app && (
          <>
            {job?.url && (
              <Button icon={<ArrowUpRight className="size-4" />} onClick={() => window.open(/greenhouse\.io\/posthog/i.test(job.url) ? "https://jobs.ashbyhq.com/posthog" : job.url, "_blank", "noopener")}>
                View posting
              </Button>
            )}
            <Button variant="primary" onClick={() => (window.location.hash = `#/jobs?job=${encodeURIComponent(app.id)}`)}>
              Open job details
            </Button>
          </>
        )
      }
    >
      {app && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <OutcomeSelect app={app} />
            <Badge>{app.resumeUsed === "tailored" ? "Tailored resume" : "Master resume"}</Badge>
            {app.coverLetterUsed && <Badge>Cover letter</Badge>}
            {app.sample && <Badge>Sample</Badge>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg border border-border p-4">
            <Meta label="Submitted">{formatDateTime(app.submittedAt)}</Meta>
            <Meta label="Site">{SITE_LABEL[app.site]}</Meta>
            <Meta label="Source">{job ? <SourceLabel source={job.source} /> : "—"}</Meta>
            <Meta label="Salary">{formatSalary(job?.salary)}</Meta>
          </div>

          {job?.score && (
            <>
              <H>Match</H>
              <div className="flex items-start gap-3">
                <ScoreRing score={job.score.tailored ?? job.score.master} size={44} />
                <ul className="text-sm text-muted list-disc pl-4 space-y-0.5">
                  {job.score.reasons.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </>
          )}

          {job?.url && (
            <p className="text-sm mt-4">
              <a href={job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-info hover:underline break-all">
                {job.url}<ArrowUpRight className="size-3.5 shrink-0" />
              </a>
            </p>
          )}

          <H>Answers sent ({app.answers?.length ?? 0})</H>
          {app.answers?.length ? (
            <div className="rounded-lg border border-border divide-y divide-border">
              {app.answers.map((a, i) => (
                <div key={i} className="grid gap-1 sm:grid-cols-2 sm:gap-4 px-4 py-3 text-sm">
                  <div className="text-muted">{a.question}</div>
                  <div className="whitespace-pre-wrap">{a.answer}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-faint">No form questions on this application.</p>
          )}

          {app.screenshotJpegBase64 && (
            <>
              <H>Confirmation screenshot</H>
              <img
                src={`data:image/jpeg;base64,${app.screenshotJpegBase64}`}
                alt="Screenshot taken after submitting"
                className="w-full rounded-lg border border-border"
              />
            </>
          )}

          <H>Notes</H>
          <Notes key={app.id} app={app} />
        </div>
      )}
    </Drawer>
  );
}
