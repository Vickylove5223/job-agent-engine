import type { Job, WithId } from "@shared/types";
import { STATUS_LABEL } from "@shared/status";
import { SOURCE_LABEL } from "@/components/domain";

function cell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV of the given jobs and trigger a client-side download. */
export function downloadJobsCsv(jobs: WithId<Job>[]) {
  const header = [
    "id", "title", "company", "location", "remote", "source", "status", "score", "tailored_score",
    "salary_min", "salary_max", "currency", "found_at", "posted_at", "url",
  ];
  const rows = jobs.map((j) => [
    j.id, j.title, j.company, j.location, j.remote ? "yes" : "no", SOURCE_LABEL[j.source] ?? j.source,
    STATUS_LABEL[j.status] ?? j.status, j.score?.master, j.score?.tailored, j.salary?.min, j.salary?.max,
    j.salary?.currency, j.foundAt, j.postedAt, j.url,
  ]);
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jobs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
