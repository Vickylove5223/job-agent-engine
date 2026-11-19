// Job scanner entry point: runs the enabled API sources, dedupes, hard-filters.
import type { Settings } from "@shared/types";
import type { JobSource, RawJob } from "../contracts";
import { adzuna } from "./adzuna";
import { arbeitnow } from "./arbeitnow";
import { ashby } from "./ashby";
import { hardFilter } from "./filter";
import { greenhouse } from "./greenhouse";
import { himalayas } from "./himalayas";
import { lever } from "./lever";
import { remoteok } from "./remoteok";
import { remotive } from "./remotive";
import { weworkremotely } from "./weworkremotely";
import { workable } from "./workable";
import type { ScanContext } from "./util";

export { hardFilter, titleMatches } from "./filter";
export { BOARDS, boardsFor } from "./companies";

/** Ordered by preference: when the same job appears twice, the earlier source wins (direct ATS first). */
export const ALL_SOURCES: JobSource[] = [greenhouse, lever, ashby, workable, arbeitnow, himalayas, remotive, weworkremotely, remoteok, adzuna];

export const SOURCE_IDS = ALL_SOURCES.map((s) => s.id);

const SOURCE_CONCURRENCY = 4;
/** Hard cap for one whole source (many boards × 15s per request would otherwise add up). */
const SOURCE_TIMEOUT_MS = 120_000;

export interface ScanResult {
  jobs: RawJob[];
  skipped: { job: RawJob; reason: string }[];
  errors: { source: string; message: string }[];
  /** jobs returned by each source (after its role pre-filter, before dedupe/hard filter) */
  counts: Record<string, number>;
  /** jobs kept per source after dedupe + hard filter */
  kept: Record<string, number>;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(b\.?v\.?|inc\.?|ltd\.?|llc|gmbh|n\.?v\.?|plc|limited)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Enabled sources = settings.enabledSites ∩ implemented ids (adzuna also needs its env keys). */
export function enabledSources(settings: Settings): JobSource[] {
  const enabled = new Set(settings.enabledSites ?? []);
  return ALL_SOURCES.filter((s) => enabled.has(s.id));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took longer than ${ms / 1000}s`)), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

/** Scan every enabled source. Never throws: per-source failures are returned in `errors`. */
export async function scanAll(settings: Settings, opts: { limitPerSource?: number } = {}): Promise<ScanResult> {
  const limit = opts.limitPerSource ?? 100;
  const sources = enabledSources(settings);
  const errors: ScanResult["errors"] = [];
  const counts: Record<string, number> = {};
  const results = new Map<string, RawJob[]>();

  let next = 0;
  const worker = async () => {
    while (next < sources.length) {
      const src = sources[next++];
      const ctx: ScanContext = {
        settings,
        limit,
        onError: (message) => errors.push({ source: src.id, message }),
      };
      try {
        const jobs = await withTimeout(src.fetch(ctx), SOURCE_TIMEOUT_MS, src.id);
        results.set(src.id, jobs);
        counts[src.id] = jobs.length;
      } catch (e) {
        errors.push({ source: src.id, message: (e as Error)?.message ?? String(e) });
        counts[src.id] = 0;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SOURCE_CONCURRENCY, sources.length) }, worker));

  const jobs: RawJob[] = [];
  const skipped: ScanResult["skipped"] = [];
  const kept: Record<string, number> = {};
  const byId = new Set<string>();
  const byCompanyTitle = new Map<string, RawJob>();

  // iterate in ALL_SOURCES order so direct-ATS postings win over aggregator copies
  for (const src of sources) {
    kept[src.id] = 0;
    for (const job of results.get(src.id) ?? []) {
      const idKey = `${job.source}:${job.externalId}`;
      if (byId.has(idKey)) continue;
      byId.add(idKey);
      const ctKey = `${norm(job.company)}|${norm(job.title)}`;
      const dup = byCompanyTitle.get(ctKey);
      if (dup) {
        skipped.push({ job, reason: `duplicate of ${dup.source}:${dup.externalId}` });
        continue;
      }
      const verdict = hardFilter(job, settings);
      if (!verdict.keep) {
        skipped.push({ job, reason: verdict.reason ?? "filtered" });
        continue;
      }
      byCompanyTitle.set(ctKey, job);
      jobs.push(job);
      kept[src.id]++;
    }
  }

  return { jobs, skipped, errors, counts, kept };
}
