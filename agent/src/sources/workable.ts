// Workable public widget API: https://apply.workable.com/api/v1/widget/accounts/{slug}
//
// applyMethod is "external": ApplyMethod has no "workable" member and there is no dedicated
// Workable applier yet. The form at `application_url` (apply.workable.com/j/{shortcode}/apply)
// is a stable, login-free single page, so a Workable applier could target it later.
import type { JobSource, RawJob } from "../contracts";
import { boardsFor } from "./companies";
import { titleMatches } from "./filter";
import { fetchJson, htmlToText, looksRemote, newestFirst, pool, toIso, type ScanContext } from "./util";

interface WorkableJob {
  title: string;
  shortcode: string;
  telecommuting?: boolean;
  url: string;
  application_url?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  locations?: { country?: string; countryCode?: string; city?: string; region?: string; hidden?: boolean }[];
  description?: string;
}

export const workable: JobSource = {
  id: "workable",
  async fetch(ctx) {
    const c = ctx as ScanContext;
    const boards = boardsFor(ctx.settings).filter((b) => b.ats === "workable");
    const perBoard = await pool(
      boards,
      4,
      async (b) => {
        const data = await fetchJson<{ name?: string; jobs?: WorkableJob[] }>(
          `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(b.slug)}?details=true`,
        );
        return (data.jobs ?? [])
          .filter((j) => titleMatches(j.title, ctx.settings.roles))
          .map((j): RawJob => {
            const locs = (j.locations ?? []).filter((l) => !l.hidden).map((l) => [l.city, l.country].filter(Boolean).join(", "));
            if (!locs.length) locs.push([j.city, j.country].filter(Boolean).join(", "));
            const location = [...new Set(locs.filter(Boolean))].join("; ");
            return {
              source: "workable",
              externalId: `${b.slug}:${j.shortcode}`,
              title: j.title.trim(),
              company: data.name?.trim() || b.name,
              location: j.telecommuting && !looksRemote(location) ? `Remote; ${location}` : location,
              remote: !!j.telecommuting,
              url: j.url,
              applyUrl: j.application_url ?? `${j.url}/apply`,
              applyMethod: "external",
              description: htmlToText(j.description),
              postedAt: toIso(j.published_on ?? j.created_at),
            };
          });
      },
      (b, e) => c.onError?.(`workable/${b.slug}: ${(e as Error).message}`),
    );
    return newestFirst(perBoard.flat(), ctx.limit);
  },
};
