// Himalayas public API: https://himalayas.app/jobs/api (browse, 20 per page, cursor) and
// https://himalayas.app/jobs/api/search?q= (keyword search, 20 per page, ?page=N).
// The browse feed caps limit at 20 regardless of ?limit=100, so we use keyword search per role
// (3 pages each) and fall back to the newest 100 from the browse feed when no roles are set.
import type { JobSource, RawJob } from "../contracts";
import { titleMatches } from "./filter";
import { fetchJson, htmlToText, newestFirst, pool, resolveApply, toIso, type ScanContext } from "./util";

interface HimalayasJob {
  title: string;
  excerpt?: string;
  companyName: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string | null;
  currency?: string | null;
  seniority?: string[];
  locationRestrictions?: string[];
  description?: string;
  pubDate?: number;
  applicationLink: string;
  guid: string;
}

interface HimalayasPage {
  jobs?: HimalayasJob[];
  nextCursor?: string | null;
}

const PAGES_PER_ROLE = 3;

export const himalayas: JobSource = {
  id: "himalayas",
  async fetch(ctx) {
    const c = ctx as ScanContext;
    const roles = ctx.settings.roles.filter((r) => r.trim());
    let pages: HimalayasPage[];
    if (roles.length) {
      const urls = roles.flatMap((r) =>
        Array.from({ length: PAGES_PER_ROLE }, (_, i) => `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(r.trim())}&page=${i + 1}`),
      );
      pages = await pool(urls, 3, (u) => fetchJson<HimalayasPage>(u), (u, e) => c.onError?.(`himalayas ${u}: ${(e as Error).message}`));
    } else {
      pages = [];
      let cursor: string | null | undefined;
      for (let i = 0; i < 5; i++) {
        const page = await fetchJson<HimalayasPage>(`https://himalayas.app/jobs/api?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        pages.push(page);
        cursor = page.nextCursor;
        if (!cursor) break;
      }
    }

    const seen = new Set<string>();
    const jobs: RawJob[] = [];
    for (const j of pages.flatMap((p) => p.jobs ?? [])) {
      if (!j.guid || seen.has(j.guid) || !titleMatches(j.title, roles)) continue;
      seen.add(j.guid);
      const restrictions = j.locationRestrictions ?? [];
      const yearly = !j.salaryPeriod || /annual|year/i.test(j.salaryPeriod);
      jobs.push({
        source: "himalayas",
        externalId: j.guid.replace(/^https?:\/\/himalayas\.app\/companies\//, ""),
        title: j.title.trim(),
        company: j.companyName.trim(),
        // a long allow-list of countries means "most of the world": keep the full text for the filter
        location: restrictions.length ? restrictions.join(", ") : "Worldwide",
        remote: true,
        url: j.guid,
        ...resolveApply(j.applicationLink, j.description),
        description: htmlToText(j.description || j.excerpt),
        postedAt: toIso(j.pubDate),
        salary:
          yearly && j.currency && (j.minSalary || j.maxSalary)
            ? { min: j.minSalary ?? undefined, max: j.maxSalary ?? undefined, currency: j.currency }
            : undefined,
      });
    }
    return newestFirst(jobs, ctx.limit);
  },
};
