// RemoteOK public API: https://remoteok.com/api — first element is legal/metadata.
// Their terms ask API users to link back to Remote OK as the source.
import type { JobSource, RawJob } from "../contracts";
import { titleMatches } from "./filter";
import { fetchJson, htmlToText, newestFirst, resolveApply, toIso } from "./util";

interface RemoteOkJob {
  id?: string;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  apply_url?: string;
  url?: string;
  salary_min?: number;
  salary_max?: number;
}

export const remoteok: JobSource = {
  id: "remoteok",
  async fetch(ctx) {
    const data = await fetchJson<RemoteOkJob[]>("https://remoteok.com/api", { "User-Agent": "JobAgent/0.1" });
    const jobs: RawJob[] = [];
    for (const j of data.slice(1)) {
      if (!j.id || !j.position || !titleMatches(j.position, ctx.settings.roles)) continue;
      const url = j.url ?? `https://remoteok.com/remote-jobs/${j.slug ?? j.id}`;
      jobs.push({
        source: "remoteok",
        externalId: String(j.id),
        title: htmlToText(j.position),
        company: htmlToText(j.company) || "Unknown",
        location: j.location?.trim() || "Worldwide",
        remote: true,
        url,
        ...resolveApply(j.apply_url ?? url, j.description),
        description: htmlToText(j.description),
        postedAt: toIso(j.date ?? j.epoch),
        salary: j.salary_max || j.salary_min ? { min: j.salary_min || undefined, max: j.salary_max || undefined, currency: "USD" } : undefined,
      });
    }
    return newestFirst(jobs, ctx.limit);
  },
};
