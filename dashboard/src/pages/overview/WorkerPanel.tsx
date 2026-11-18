import { useEffect, useState, type ReactNode } from "react";
import type { Job, SessionState, Settings, WithId, WorkerStatus } from "@shared/types";
import { Badge, Panel, type Tone } from "@/components/ui";
import { isOnline, timeAgo } from "@/lib/format";

const sessionTone: Record<SessionState, Tone> = { ok: "green", logged_out: "red", checkpoint: "red", unknown: "neutral" };
const sessionLabel: Record<SessionState, string> = { ok: "Signed in", logged_out: "Logged out", checkpoint: "Checkpoint", unknown: "Unknown" };

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function remaining(iso: string, now: number) {
  const s = Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-b-0">
      <span className="text-sm text-muted shrink-0">{label}</span>
      <div className="min-w-0 text-sm text-right">{children}</div>
    </div>
  );
}

export function WorkerPanel({ worker, settings, jobs }: { worker: WithId<WorkerStatus> | null; settings: Settings | null; jobs: WithId<Job>[] }) {
  const now = useNow();
  const online = isOnline(worker?.heartbeatAt);
  const currentJob = worker?.currentJobId ? jobs.find((j) => j.id === worker.currentJobId) : undefined;
  const paused = !!settings?.paused;
  const blocked = (["linkedin", "indeed"] as const)
    .map((site) => ({ site, until: worker?.blockedUntil?.[site] }))
    .filter((b): b is { site: "linkedin" | "indeed"; until: string } => !!b.until && new Date(b.until).getTime() > now);

  return (
    <Panel
      title="Agent service"
      actions={
        <Badge tone={online ? "green" : "neutral"} dot>
          {online ? "Online" : "Offline"}
        </Badge>
      }
    >
      <Row label="State">
        <span className="font-medium capitalize">{online ? worker?.state ?? "idle" : "offline"}</span>
      </Row>
      <Row label="Agent">
        {paused ? <Badge tone="amber">Paused</Badge> : <Badge tone="green">Running</Badge>}
      </Row>
      <Row label="Current job">
        {currentJob ? (
          <span className="block truncate" title={`${currentJob.title} · ${currentJob.company}`}>
            {currentJob.title} <span className="text-muted">· {currentJob.company}</span>
          </span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </Row>
      <Row label="LinkedIn">
        <Badge tone={sessionTone[worker?.sessions?.linkedin ?? "unknown"]}>{sessionLabel[worker?.sessions?.linkedin ?? "unknown"]}</Badge>
      </Row>
      <Row label="Indeed">
        <Badge tone={sessionTone[worker?.sessions?.indeed ?? "unknown"]}>{sessionLabel[worker?.sessions?.indeed ?? "unknown"]}</Badge>
      </Row>
      {blocked.map((b) => (
        <Row key={b.site} label={`${b.site === "linkedin" ? "LinkedIn" : "Indeed"} cooldown`}>
          <span className="tabular-nums text-warning font-medium">{remaining(b.until, now)}</span>
        </Row>
      ))}
      <Row label="Last heartbeat">
        <span className="text-muted">{timeAgo(worker?.heartbeatAt)}</span>
      </Row>
      {worker?.version && (
        <Row label="Version">
          <span className="font-mono text-xs text-muted">{worker.version}</span>
        </Row>
      )}

      {!online && (
        <div className="mt-4 rounded-md border border-border bg-surface-2 px-3.5 py-3 text-sm text-muted">
          Waiting for the agent service. It runs in the cloud with hosted browsers — once it's live it checks in here, starts finding jobs and applies for you. Your settings are saved.
        </div>
      )}
      {online && paused && (
        <div className="mt-4 rounded-md bg-warning-soft px-3.5 py-3 text-sm text-warning">
          The agent is paused. Turn on “Agent running” at the top to continue applying.
        </div>
      )}
    </Panel>
  );
}
