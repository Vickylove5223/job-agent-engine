import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Application, Job, Settings, WithId } from "@shared/types";
import { Panel } from "@/components/ui";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function PipelinePanel({ jobs, applications, settings }: {
  jobs: WithId<Job>[]; applications: WithId<Application>[]; settings: Settings | null;
}) {
  const tailor = settings?.thresholds?.tailor ?? 60;

  const stages = useMemo(() => {
    const found = jobs.length;
    const matched = jobs.filter((j) => (j.score?.master ?? -1) >= tailor).length;
    const ready = jobs.filter((j) => j.status === "ready" || j.status === "applying" || j.status === "applied").length;
    const applied = Math.max(jobs.filter((j) => j.status === "applied").length, applications.length);
    return [
      { label: "Found", value: found },
      { label: "Matched", value: matched, hint: `score ≥ ${tailor}` },
      { label: "Ready / tailored", value: ready },
      { label: "Applied", value: applied },
    ];
  }, [jobs, applications, tailor]);
  const max = Math.max(1, ...stages.map((s) => s.value));

  const perDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of applications) {
      if (!a.submittedAt) continue;
      const k = dayKey(new Date(a.submittedAt));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const out: { day: string; count: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      out.push({ day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: counts.get(dayKey(d)) ?? 0 });
    }
    return out;
  }, [applications]);
  const anyApplied = perDay.some((d) => d.count > 0);

  return (
    <Panel title="Pipeline">
      <div className="space-y-3">
        {stages.map((s) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span className="text-muted">
                {s.label}
                {s.hint && <span className="ml-1.5 text-xs text-faint">{s.hint}</span>}
              </span>
              <span className="font-medium tabular-nums">{s.value}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${s.value === 0 ? 0 : Math.max(2, (s.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[13px] font-medium text-muted">Applications, last 14 days</div>
          <div className="text-xs text-faint tabular-nums">{perDay.reduce((n, d) => n + d.count, 0)} total</div>
        </div>
        <div className="h-36 relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perDay} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fill: "var(--text-faint)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--text-faint)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--text)" }}
                labelStyle={{ color: "var(--text-muted)" }}
                formatter={(v) => [v, "Applications"]}
              />
              <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
          {!anyApplied && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-faint pointer-events-none">
              No applications yet
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
