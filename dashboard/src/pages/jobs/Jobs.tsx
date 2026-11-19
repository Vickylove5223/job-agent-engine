import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, Briefcase, Search } from "lucide-react";
import type { Job, JobSource, JobStatus, WithId } from "@shared/types";
import { useCollection } from "@/lib/db";
import { formatSalary, timeAgo } from "@/lib/format";
import {
  Badge, Button, EmptyState, Input, LoadingBlock, PageHeader, Select, Switch, Table, Tabs, Td, Th, Tr, cx,
} from "@/components/ui";
import { ScoreRing, SourceLabel, StatusBadge, sourceName } from "@/components/domain";
import { JobDrawer } from "./JobDrawer";

type TabKey = "all" | "ready" | "waiting_input" | "needs_tailoring" | "applying" | "applied" | "skipped" | "problems";

const TAB_DEFS: { value: TabKey; label: string; match: (s: JobStatus) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "ready", label: "Ready", match: (s) => s === "ready" },
  { value: "waiting_input", label: "Waiting on you", match: (s) => s === "waiting_input" },
  { value: "needs_tailoring", label: "Tailoring", match: (s) => s === "needs_tailoring" },
  { value: "applying", label: "Applying", match: (s) => s === "applying" },
  { value: "applied", label: "Applied", match: (s) => s === "applied" },
  { value: "skipped", label: "Skipped", match: (s) => s === "skipped" },
  { value: "problems", label: "Problems", match: (s) => s === "blocked" || s === "failed" },
];
const TAB_KEYS = TAB_DEFS.map((t) => t.value);

const PAGE_SIZE = 25;
type SortKey = "found" | "score";

function bestScore(j: Job): number {
  return j.score?.tailored ?? j.score?.master ?? -1;
}

export function Jobs() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const rawStatus = params.get("status") as TabKey | null;
  const tab: TabKey = rawStatus && TAB_KEYS.includes(rawStatus) ? rawStatus : "all";
  const openId = params.get("job");

  const { data: jobs, loading } = useCollection("jobs", { orderBy: "foundAt", desc: true });

  const [source, setSource] = useState<"all" | JobSource>("all");
  const [minScore, setMinScore] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "found", desc: true });
  const [page, setPage] = useState(0);

  const setParam = (key: string, value: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: key === "q" },
    );
  };

  // Reset to first page whenever the filtered set changes shape.
  useEffect(() => setPage(0), [q, tab, source, minScore, remoteOnly, sort]);

  const sources = useMemo(() => Array.from(new Set(jobs.map((j) => j.source))).sort(), [jobs]);

  // Everything except the status tab — used for tab counts.
  const baseFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (needle && !`${j.title} ${j.company} ${j.location}`.toLowerCase().includes(needle)) return false;
      if (source !== "all" && j.source !== source) return false;
      if (minScore && bestScore(j) < minScore) return false;
      if (remoteOnly && !j.remote) return false;
      return true;
    });
  }, [jobs, q, source, minScore, remoteOnly]);

  const counts = useMemo(() => {
    const c = {} as Record<TabKey, number>;
    for (const t of TAB_DEFS) c[t.value] = baseFiltered.filter((j) => t.match(j.status)).length;
    return c;
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    const match = TAB_DEFS.find((t) => t.value === tab)!.match;
    const list = baseFiltered.filter((j) => match(j.status));
    const dir = sort.desc ? -1 : 1;
    return [...list].sort((a, b) => {
      const r = sort.key === "score" ? bestScore(a) - bestScore(b) : (a.foundAt ?? "").localeCompare(b.foundAt ?? "");
      return r * dir;
    });
  }, [baseFiltered, tab, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const openJob = jobs.find((j) => j.id === openId) ?? null;
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));

  const header = (
    <PageHeader
      title="Jobs"
      description="Every job the agent found, scored against your resume."
    />
  );

  if (loading) return <>{header}<LoadingBlock /></>;

  if (!jobs.length) {
    return (
      <>
        {header}
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={<Briefcase className="size-8" />}
            title="No jobs yet"
            description="Matching jobs from your job sites appear here as soon as the agent finds them, already scored against your resume."
            action={<Button onClick={() => navigate("/settings")}>Review search settings</Button>}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      <Tabs
        tabs={TAB_DEFS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] }))}
        value={tab}
        onChange={(v) => setParam("status", v === "all" ? null : v)}
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-center lg:gap-3">
        <div className="relative sm:col-span-2 lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={q}
            onChange={(e) => setParam("q", e.target.value || null)}
            placeholder="Search title, company, location"
            className="pl-9"
            aria-label="Search jobs"
          />
        </div>
        <Select value={source} onChange={(e) => setSource(e.target.value as "all" | JobSource)} className="lg:w-44" aria-label="Source">
          <option value="all">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{sourceName(s)}</option>)}
        </Select>
        <Select value={String(minScore)} onChange={(e) => setMinScore(Number(e.target.value))} className="lg:w-36" aria-label="Minimum score">
          <option value="0">Any score</option>
          {[60, 70, 80, 90].map((n) => <option key={n} value={n}>{n}+</option>)}
        </Select>
        <div className="flex items-center h-9 lg:ml-1">
          <Switch checked={remoteOnly} onChange={setRemoteOnly} label="Remote only" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        {!filtered.length ? (
          <EmptyState
            icon={<Search className="size-7" />}
            title="No matching jobs"
            description="Try a different tab, clearing the search, or loosening the filters."
          />
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <ul className="md:hidden divide-y divide-border">
              {pageRows.map((j) => (
                <li key={j.id}>
                  <button type="button" onClick={() => setParam("job", j.id)} className="w-full text-left px-4 py-3.5 flex gap-3 hover:bg-surface-2 cursor-pointer">
                    <div className="shrink-0 pt-0.5"><ScoreCell job={j} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{j.title}</div>
                          <div className="text-sm text-muted truncate">{j.company}</div>
                        </div>
                        <StatusBadge status={j.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <SourceLabel source={j.source} />
                        <span className="truncate max-w-[12rem]">{j.location || "—"}</span>
                        {j.remote && <Badge tone="green">Remote</Badge>}
                        {j.salary && <span>{formatSalary(j.salary)}</span>}
                        <span className="text-faint">{timeAgo(j.foundAt)}</span>
                        {j.sample && <Badge>Sample</Badge>}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th className="w-24"><SortHeader label="Score" active={sort.key === "score"} desc={sort.desc} onClick={() => toggleSort("score")} /></Th>
                    <Th>Role</Th>
                    <Th>Source</Th>
                    <Th>Location</Th>
                    <Th>Salary</Th>
                    <Th>Status</Th>
                    <Th><SortHeader label="Found" active={sort.key === "found"} desc={sort.desc} onClick={() => toggleSort("found")} /></Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((j) => (
                    <Tr key={j.id} onClick={() => setParam("job", j.id)}>
                      <Td><ScoreCell job={j} /></Td>
                      <Td className="max-w-[22rem]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{j.title}</span>
                          {j.sample && <Badge>Sample</Badge>}
                        </div>
                        <div className="text-muted truncate">{j.company}</div>
                      </Td>
                      <Td className="whitespace-nowrap"><SourceLabel source={j.source} /></Td>
                      <Td className="max-w-[14rem]">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{j.location || "—"}</span>
                          {j.remote && <Badge tone="green">Remote</Badge>}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">{formatSalary(j.salary)}</Td>
                      <Td><StatusBadge status={j.status} /></Td>
                      <Td className="whitespace-nowrap text-muted">{timeAgo(j.foundAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
              <span>
                {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <Button size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</Button>
                <Button size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <JobDrawer job={openJob} onClose={() => setParam("job", null)} />
    </>
  );
}

function ScoreCell({ job }: { job: WithId<Job> }) {
  return (
    <div className="flex items-center gap-1.5">
      <ScoreRing score={job.score?.master} />
      {job.score?.tailored !== undefined && (
        <span className="text-xs font-medium text-accent-strong tabular-nums" title="Score with tailored resume">→ {job.score.tailored}</span>
      )}
    </div>
  );
}

function SortHeader({ label, active, desc, onClick }: { label: string; active: boolean; desc: boolean; onClick: () => void }) {
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <button type="button" onClick={onClick} className={cx("inline-flex items-center gap-1 cursor-pointer hover:text-text", !active && "text-text")}>
      {label}
      <Icon className={cx("size-3.5", active ? "text-text" : "text-faint")} />
    </button>
  );
}
