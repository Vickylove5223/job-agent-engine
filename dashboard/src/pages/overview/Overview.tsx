import { useMemo } from "react";
import type { Site } from "@shared/types";
import { LoadingBlock, PageHeader, Panel, Stat, StatGroup } from "@/components/ui";
import { useCollection, useDoc } from "@/lib/db";
import { isToday } from "@/lib/format";
import { PipelinePanel } from "./PipelinePanel";
import { WorkerPanel } from "./WorkerPanel";

const SITE_LABEL: Record<Site, string> = { linkedin: "LinkedIn", indeed: "Indeed", ats: "ATS" };
const SITES: Site[] = ["linkedin", "indeed", "ats"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function Overview() {
  const { data: jobs, loading: jobsLoading } = useCollection("jobs");
  const { data: questions } = useCollection("questions");
  const { data: applications } = useCollection("applications");
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

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Your agent's activity at a glance."
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
          value={openQuestions.length + stats.waitingJobs}
          hint={`${openQuestions.length} question${openQuestions.length === 1 ? "" : "s"} · ${stats.waitingJobs} job${stats.waitingJobs === 1 ? "" : "s"}`}
        />
        <Stat label="Avg match score" value={stats.avgScore ?? "—"} hint="Jobs found in the last 7 days" />
      </StatGroup>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 items-start">
        {jobsLoading ? (
          <Panel title="Pipeline"><LoadingBlock /></Panel>
        ) : (
          <PipelinePanel jobs={jobs} applications={applications} settings={settings} />
        )}
        <WorkerPanel worker={worker} settings={settings} jobs={jobs} />
      </div>
    </div>
  );
}
