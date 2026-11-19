// Remotive public API: https://remotive.com/api/remote-jobs (please link back to Remotive as the source)
import { focusFromRoles } from "@shared/sites";
import type { JobSource, RawJob } from "../contracts";
import { titleMatches } from "./filter";
import { fetchJson, htmlToText, newestFirst, parseSalaryText, pool, resolveApply, toIso, type ScanContext } from "./util";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

export const remotive: JobSource = {
  id: "remotive",
  async fetch(ctx) {
    const c = ctx as ScanContext;
    const roles = ctx.settings.roles.filter((r) => r.trim());
    const urls = roles.map((r) => `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(r.trim())}`);
    if (focusFromRoles(roles).includes("design")) urls.push("https://remotive.com/api/remote-jobs?category=design");
    if (!urls.length) urls.push("https://remotive.com/api/remote-jobs?limit=200");

    const lists = await pool(urls, 2, (u) => fetchJson<{ jobs?: RemotiveJob[] }>(u), (u, e) => c.onError?.(`remotive ${u}: ${(e as Error).message}`));
    const seen = new Set<number>();
    const jobs: RawJob[] = [];
    for (const j of lists.flatMap((l) => l.jobs ?? [])) {
      if (seen.has(j.id) || !titleMatches(j.title, roles)) continue;
      seen.add(j.id);
      const description = htmlToText(j.description);
      jobs.push({
        source: "remotive",
        externalId: String(j.id),
        title: j.title.trim(),
        company: j.company_name.trim(),
        location: j.candidate_required_location?.trim() || "Worldwide",
        remote: true,
        url: j.url,
        ...resolveApply(j.url, j.description),
        description,
        postedAt: toIso(j.publication_date ? `${j.publication_date}Z` : undefined),
        salary: parseSalaryText(j.salary),
      });
    }
    return newestFirst(jobs, ctx.limit);
  },
};
