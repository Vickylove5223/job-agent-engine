// Adzuna search API (free key): https://developer.adzuna.com/
// Only runs when ADZUNA_APP_ID and ADZUNA_APP_KEY are set.
import type { JobSource, RawJob } from "../contracts";
import { titleMatches } from "./filter";
import { fetchJson, htmlToText, looksRemote, newestFirst, pool, toIso, type ScanContext } from "./util";

/** Adzuna country code (lower case) → currency of its salaries. */
const ADZUNA_COUNTRIES: Record<string, string> = {
  gb: "GBP", us: "USD", ca: "CAD", au: "AUD", de: "EUR", fr: "EUR", in: "INR", za: "ZAR", nl: "EUR", it: "EUR",
  es: "EUR", pl: "PLN", sg: "SGD", br: "BRL", mx: "MXN", nz: "NZD", at: "EUR", ch: "CHF", be: "EUR",
};

interface AdzunaResult {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  redirect_url: string;
  description?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number;
}

export const adzuna: JobSource = {
  id: "adzuna",
  async fetch(ctx) {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) return [];
    const c = ctx as ScanContext;
    const countries = ctx.settings.countries.map((x) => x.toLowerCase()).filter((x) => x in ADZUNA_COUNTRIES);
    const roles = ctx.settings.roles.filter((r) => r.trim());
    const queries = countries.flatMap((cc) => (roles.length ? roles : [""]).map((role) => ({ cc, role })));

    const results = await pool(
      queries,
      3,
      async ({ cc, role }) => {
        const qs = new URLSearchParams({ app_id: appId, app_key: appKey, results_per_page: "50", "content-type": "application/json" });
        if (role) qs.set("what", role.trim());
        const data = await fetchJson<{ results?: AdzunaResult[] }>(`https://api.adzuna.com/v1/api/jobs/${cc}/search/1?${qs}`);
        return (data.results ?? []).map((r) => ({ r, cc }));
      },
      // never echo the key: report only country + role
      (q, e) => c.onError?.(`adzuna/${q.cc} "${q.role}": ${(e as Error).message.replace(/(app_id|app_key)=[^&\s)]+/g, "$1=***")}`),
    );

    const seen = new Set<string>();
    const jobs: RawJob[] = [];
    for (const { r, cc } of results.flat()) {
      const title = htmlToText(r.title);
      if (seen.has(r.id) || !titleMatches(title, roles)) continue;
      seen.add(r.id);
      const location = [r.location?.display_name, r.location?.area?.[0]].filter(Boolean).join(", ");
      const description = htmlToText(r.description);
      const predicted = String(r.salary_is_predicted ?? "0") === "1";
      jobs.push({
        source: "adzuna",
        externalId: `${cc}:${r.id}`,
        title,
        company: r.company?.display_name?.trim() || "Unknown",
        location,
        remote: looksRemote(title, location, description.slice(0, 600)),
        url: r.redirect_url,
        applyUrl: r.redirect_url,
        applyMethod: "external",
        description,
        postedAt: toIso(r.created),
        salary: !predicted && (r.salary_min || r.salary_max) ? { min: r.salary_min, max: r.salary_max, currency: ADZUNA_COUNTRIES[cc] } : undefined,
      });
    }
    return newestFirst(jobs, ctx.limit);
  },
};
