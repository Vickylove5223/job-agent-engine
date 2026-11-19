// Arbeitnow public job board API (Europe, many listings tagged with visa sponsorship).
// https://www.arbeitnow.com/api/job-board-api — free, no key, ~100 jobs per page.
import type { JobSource, RawJob } from "../contracts";
import { titleMatches } from "./filter";
import { fetchJson, htmlToText, newestFirst, pool, resolveApply, toIso, type ScanContext } from "./util";

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

const PAGES = 6;

export const arbeitnow: JobSource = {
  id: "arbeitnow",
  async fetch(ctx) {
    const c = ctx as ScanContext;
    const roles = ctx.settings.roles.filter((r) => r.trim());
    const urls = Array.from({ length: PAGES }, (_, i) => `https://www.arbeitnow.com/api/job-board-api?page=${i + 1}`);
    const pages = await pool(urls, 3, (u) => fetchJson<{ data?: ArbeitnowJob[] }>(u), (u, e) => c.onError?.(`arbeitnow ${u}: ${(e as Error).message}`));
    const seen = new Set<string>();
    const jobs: RawJob[] = [];
    for (const j of pages.flatMap((p) => p.data ?? [])) {
      if (seen.has(j.slug) || !titleMatches(j.title, roles)) continue;
      seen.add(j.slug);
      const tags = (j.tags ?? []).join(", ");
      const description = [htmlToText(j.description), tags ? `Tags: ${tags}` : ""].filter(Boolean).join("\n\n");
      jobs.push({
        source: "arbeitnow",
        externalId: j.slug,
        title: j.title.trim(),
        company: j.company_name.trim(),
        location: j.location?.trim() || (j.remote ? "Remote" : ""),
        remote: !!j.remote,
        url: j.url,
        ...resolveApply(j.url, j.description),
        description,
        postedAt: toIso(j.created_at ? j.created_at * 1000 : undefined),
      });
    }
    return newestFirst(jobs, ctx.limit);
  },
};
