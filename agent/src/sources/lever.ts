// Lever public postings API: https://github.com/lever/postings-api
// Boards live either on api.lever.co or (EU tenants) api.eu.lever.co.
import type { JobSource, RawJob } from "../contracts";
import { boardsFor } from "./companies";
import { titleMatches } from "./filter";
import { HttpError, fetchJson, htmlToText, looksRemote, newestFirst, pool, toIso, type ScanContext } from "./util";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  country?: string;
  categories?: { location?: string; allLocations?: string[]; commitment?: string; team?: string };
  descriptionPlain?: string;
  description?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

async function postings(slug: string, euFirst: boolean): Promise<LeverPosting[]> {
  const hosts = euFirst ? ["api.eu.lever.co", "api.lever.co"] : ["api.lever.co", "api.eu.lever.co"];
  let lastErr: unknown;
  for (const host of hosts) {
    try {
      return await fetchJson<LeverPosting[]>(`https://${host}/v0/postings/${encodeURIComponent(slug)}?mode=json`);
    } catch (e) {
      lastErr = e;
      if (!(e instanceof HttpError && e.status === 404)) throw e;
    }
  }
  throw lastErr;
}

export const lever: JobSource = {
  id: "lever",
  async fetch(ctx) {
    const c = ctx as ScanContext;
    const boards = boardsFor(ctx.settings, "lever");
    const perBoard = await pool(
      boards,
      4,
      async (b) => {
        const list = await postings(b.slug, !!b.eu);
        return list
          .filter((p) => titleMatches(p.text, ctx.settings.roles))
          .map((p): RawJob => {
            const locs = p.categories?.allLocations?.length ? p.categories.allLocations : [p.categories?.location ?? ""];
            const location = [...new Set(locs.filter(Boolean))].join("; ");
            const lists = (p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
            const description = htmlToText(
              [p.descriptionPlain ?? htmlToText(p.description), lists, p.additionalPlain].filter(Boolean).join("\n\n").replace(/\n/g, "<br>"),
            );
            const sr = p.salaryRange;
            const yearly = !sr?.interval || /year|annual/i.test(sr.interval);
            return {
              source: "lever",
              externalId: `${b.slug}:${p.id}`,
              title: p.text.trim(),
              company: b.name,
              location,
              remote: p.workplaceType === "remote" || looksRemote(location),
              url: p.hostedUrl,
              applyUrl: p.applyUrl ?? `${p.hostedUrl}/apply`,
              applyMethod: "lever",
              description,
              postedAt: toIso(p.createdAt),
              salary: sr && sr.currency && yearly && (sr.min || sr.max) ? { min: sr.min, max: sr.max, currency: sr.currency } : undefined,
            };
          });
      },
      (b, e) => c.onError?.(`lever/${b.slug}: ${(e as Error).message}`),
    );
    return newestFirst(perBoard.flat(), ctx.limit);
  },
};
