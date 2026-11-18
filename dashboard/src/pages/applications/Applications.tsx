import { useMemo, useState } from "react";
import { Search, Send } from "lucide-react";
import type { Outcome } from "@shared/types";
import { Badge, EmptyState, Input, LoadingBlock, PageHeader, Panel, Stat, StatGroup, Table, Tabs, Td, Th, Tr } from "@/components/ui";
import { ScoreRing } from "@/components/domain";
import { useCollection } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ApplicationDrawer } from "./ApplicationDrawer";
import { OutcomeSelect } from "./OutcomeSelect";
import { SiteChart } from "./SiteChart";
import { OUTCOMES, OUTCOME_LABEL, SITE_LABEL, responseRate, type AppRow } from "./shared";

type Filter = "all" | Outcome;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Role({ row }: { row: AppRow }) {
  return (
    <div className="min-w-0">
      <div className="font-medium truncate flex items-center gap-2">
        <span className="truncate">{row.job?.title ?? "Unknown job"}</span>
        {row.sample && <Badge>Sample</Badge>}
      </div>
      <div className="text-[13px] text-muted truncate">{row.job?.company ?? row.id}</div>
    </div>
  );
}

function ResumeBadge({ used }: { used: AppRow["resumeUsed"] }) {
  return used === "tailored" ? <Badge tone="indigo">Tailored</Badge> : <Badge>Master</Badge>;
}

const scoreOf = (r: AppRow) => r.job?.score?.tailored ?? r.job?.score?.master;

export function Applications() {
  const apps = useCollection("applications", { orderBy: "submittedAt", desc: true });
  const jobs = useCollection("jobs");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows: AppRow[] = useMemo(() => {
    const byId = new Map(jobs.data.map((j) => [j.id, j]));
    return apps.data.map((a) => ({ ...a, job: byId.get(a.id) }));
  }, [apps.data, jobs.data]);

  const stats = useMemo(() => {
    const now = Date.now();
    const week = rows.filter((r) => now - new Date(r.submittedAt).getTime() < WEEK_MS).length;
    const interviews = rows.filter((r) => r.outcome === "interview" || r.outcome === "offer").length;
    return { total: rows.length, week, interviews, rate: responseRate(rows) };
  }, [rows]);

  const counts = useMemo(() => {
    const c = { all: rows.length } as Record<Filter, number>;
    for (const o of OUTCOMES) c[o] = rows.filter((r) => r.outcome === o).length;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.outcome !== filter) return false;
      if (!needle) return true;
      return `${r.job?.title ?? ""} ${r.job?.company ?? ""}`.toLowerCase().includes(needle);
    });
  }, [rows, filter, q]);

  const open = openId ? rows.find((r) => r.id === openId) ?? null : null;
  const loading = apps.loading || jobs.loading;

  return (
    <div>
      <PageHeader title="Applications" description="Every application the agent submitted for you." />

      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Send className="size-6" />}
            title="No applications yet — the agent applies to jobs marked Ready."
            description="Once the agent submits an application it appears here with the answers it sent and a screenshot."
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          <StatGroup>
            <Stat label="Total submitted" value={stats.total} />
            <Stat label="This week" value={stats.week} hint="Last 7 days" />
            <Stat label="Interviews" value={stats.interviews} hint="Interview or offer" />
            <Stat
              label="Response rate"
              value={stats.rate === null ? "—" : `${stats.rate}%`}
              info="Interviews, offers and rejections divided by all applications."
            />
          </StatGroup>

          <SiteChart rows={rows} />

          <div>
            <Tabs<Filter>
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: "all", label: "All", count: counts.all },
                ...OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o], count: counts[o] })),
              ]}
            />
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or company" className="pl-9" />
            </div>

            <Panel padded={false}>
              {visible.length === 0 ? (
                <EmptyState title="No matching applications" description="Try another outcome tab or clear the search." />
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Submitted</Th>
                          <Th>Role</Th>
                          <Th>Site</Th>
                          <Th>Resume</Th>
                          <Th>Cover letter</Th>
                          <Th>Score</Th>
                          <Th>Outcome</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r) => (
                          <Tr key={r.id} onClick={() => setOpenId(r.id)}>
                            <Td className="whitespace-nowrap text-muted">{formatDate(r.submittedAt)}</Td>
                            <Td className="max-w-72"><Role row={r} /></Td>
                            <Td className="whitespace-nowrap">{SITE_LABEL[r.site]}</Td>
                            <Td><ResumeBadge used={r.resumeUsed} /></Td>
                            <Td className="text-muted">{r.coverLetterUsed ? "Yes" : "No"}</Td>
                            <Td><ScoreRing score={scoreOf(r)} /></Td>
                            <Td><OutcomeSelect app={r} /></Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>

                  {/* Mobile cards */}
                  <ul className="md:hidden divide-y divide-border">
                    {visible.map((r) => (
                      <li key={r.id} className="p-4 cursor-pointer hover:bg-surface-2" onClick={() => setOpenId(r.id)}>
                        <div className="flex items-start justify-between gap-3">
                          <Role row={r} />
                          <ScoreRing score={scoreOf(r)} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                          <span>{formatDate(r.submittedAt)}</span>
                          <span>{SITE_LABEL[r.site]}</span>
                          <ResumeBadge used={r.resumeUsed} />
                          {r.coverLetterUsed && <span>Cover letter</span>}
                        </div>
                        <div className="mt-3">
                          <OutcomeSelect app={r} className="w-full" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>
        </div>
      )}

      <ApplicationDrawer app={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
