import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Activity as ActivityIcon, ArrowRight, MessageCircleQuestion, Sparkles } from "lucide-react";
import type { Site } from "@shared/types";
import { Badge, Button, EmptyState, LoadingBlock, PageHeader, Panel, Stat, StatGroup, Table, Td, Th, Tr } from "@/components/ui";
import { ActivityRow, ScoreRing, SourceLabel, StatusBadge } from "@/components/domain";
import { useCollection, useDoc } from "@/lib/db";
import { isToday } from "@/lib/format";
import { PipelinePanel } from "./PipelinePanel";
import { WorkerPanel } from "./WorkerPanel";

const SITE_LABEL: Record<Site, string> = { linkedin: "LinkedIn", indeed: "Indeed", ats: "ATS" };
const SITES: Site[] = ["linkedin", "indeed", "ats"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function Overview() {
  const navigate = useNavigate();
  const { data: jobs, loading: jobsLoading } = useCollection("jobs");
  const { data: questions } = useCollection("questions");
  const { data: applications } = useCollection("applications");
  const { data: activity, loading: activityLoading } = useCollection("activity", { orderBy: "ts", desc: true, limit: 10 });
  const { data: settings } = useDoc("settings", "main");
  const { data: worker } = useDoc("workerStatus", "main");

  const openQuestions = useMemo(
    () => questions.filter((q) => q.status === "open").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [questions],
  );

  const stats = useMemo(() => {
    const foundToday = jobs.filter((j) => isToday(j.foundAt)).length;
    const waitingJobs = jobs.filter((j) => j.status === "waiting_input").length;
    const cutoff = Date.now() - WEEK_MS;
    const recentScores = jobs
      .filter((j) => j.score && new Date(j.foundAt).getTime() >= cutoff)
      .map((j) => j.score!.master);
    const avgScore = recentScores.length ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : null;

    const caps = settings?.dailyCaps;
    const capTotal = caps ? SITES.reduce((n, s) => n + (caps[s] ?? 0), 0) : null;
    const workerApplied = worker?.appliedToday;
    const appliedFromWorker = workerApplied ? SITES.reduce((n, s) => n + (workerApplied[s] ?? 0), 0) : 0;
    const appliedFromApps = applications.filter((a) => isToday(a.submittedAt)).length;
    const appliedToday = workerApplied ? Math.max(appliedFromWorker, appliedFromApps) : appliedFromApps;
    const appliedHint = workerApplied
      ? SITES.map((s) => `${SITE_LABEL[s]} ${workerApplied[s] ?? 0}${caps ? `/${caps[s] ?? 0}` : ""}`).join(" · ")
      : "From submitted applications";

    return { foundToday, waitingJobs, avgScore, capTotal, appliedToday, appliedHint };
  }, [jobs, applications, settings, worker]);

  const topMatches = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "ready" || j.status === "applying" || j.status === "needs_tailoring")
        .sort((a, b) => (b.score?.master ?? -1) - (a.score?.master ?? -1))
        .slice(0, 5),
    [jobs],
  );

  const openJob = (id: string) => navigate(`/jobs?job=${encodeURIComponent(id)}`);
  const waitingCount = openQuestions.length + stats.waitingJobs;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Your agent's activity at a glance."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/jobs")}>View jobs</Button>
            {openQuestions.length > 0 && (
              <Button variant="primary" icon={<MessageCircleQuestion className="size-4" />} onClick={() => navigate("/questions")}>
                Answer questions ({openQuestions.length})
              </Button>
            )}
          </>
        }
      />

      <StatGroup>
        <Stat label="Jobs found today" value={jobsLoading ? "—" : stats.foundToday} hint={`${jobs.length} in pipeline`} />
        <Stat
          label="Applied today"
          value={
            <span>
              {stats.appliedToday}
              {stats.capTotal !== null && <span className="text-faint text-lg"> / {stats.capTotal}</span>}
            </span>
          }
          hint={stats.appliedHint}
        />
        <Stat
          label="Waiting on you"
          value={waitingCount}
          hint={`${openQuestions.length} question${openQuestions.length === 1 ? "" : "s"} · ${stats.waitingJobs} job${stats.waitingJobs === 1 ? "" : "s"}`}
        />
        <Stat label="Avg match score" value={stats.avgScore ?? "—"} hint="Jobs found in the last 7 days" />
      </StatGroup>

      {openQuestions.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-warning-soft p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold text-warning">
                <MessageCircleQuestion className="size-4" />
                Needs your input
              </div>
              <p className="text-sm text-muted mt-1">
                The agent is waiting on {openQuestions.length} answer{openQuestions.length === 1 ? "" : "s"} before it can continue.
              </p>
            </div>
            <Button variant="secondary" size="sm" className="self-start" onClick={() => navigate("/questions")}>
              Go to questions <ArrowRight className="size-3.5" />
            </Button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {openQuestions.slice(0, 3).map((q) => (
              <li key={q.id} className="flex gap-2 text-sm">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                <span className="min-w-0 break-words">{q.text}</span>
              </li>
            ))}
            {openQuestions.length > 3 && <li className="text-xs text-muted pl-3.5">+{openQuestions.length - 3} more</li>}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2 items-start">
        {jobsLoading ? (
          <Panel title="Pipeline"><LoadingBlock /></Panel>
        ) : (
          <PipelinePanel jobs={jobs} applications={applications} settings={settings} />
        )}
        <WorkerPanel worker={worker} settings={settings} jobs={jobs} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 items-start">
        <Panel
          title="Top matches"
          padded={false}
          actions={<Button variant="ghost" size="sm" onClick={() => navigate("/jobs")}>View all</Button>}
        >
          {jobsLoading ? (
            <LoadingBlock />
          ) : topMatches.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-6" />}
              title="No matches ready yet"
              description="Jobs that score well and are ready to apply will show up here."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-14">Score</Th>
                  <Th>Role</Th>
                  <Th className="hidden sm:table-cell">Source</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {topMatches.map((j) => (
                  <Tr key={j.id} onClick={() => openJob(j.id)} className="[&:last-child>td]:border-b-0">
                    <Td><ScoreRing score={j.score?.master} /></Td>
                    <Td className="min-w-40">
                      <div className="font-medium flex items-center gap-2">
                        <span className="truncate">{j.title}</span>
                        {j.sample && <Badge>Sample</Badge>}
                      </div>
                      <div className="text-xs text-muted mt-0.5 truncate">{j.company}</div>
                    </Td>
                    <Td className="hidden sm:table-cell whitespace-nowrap"><SourceLabel source={j.source} /></Td>
                    <Td><StatusBadge status={j.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Recent activity"
          padded={false}
        >
          {activityLoading ? (
            <LoadingBlock />
          ) : activity.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon className="size-6" />}
              title="No activity yet"
              description="Everything the agent does will be logged here."
            />
          ) : (
            <div className="px-5">
              {activity.map((e) => (
                <div key={e.id} className="border-b border-border last:border-b-0">
                  <ActivityRow entry={e} compact />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
