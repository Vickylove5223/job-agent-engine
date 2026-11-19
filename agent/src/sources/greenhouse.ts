// Greenhouse public job board API: https://developers.greenhouse.io/job-board.html
//
// `?content=true` on the list endpoint returns every description at once (2–10 MB for big boards,
// far too slow on modest connections). Instead we list titles only (~100 KB), keep the ones that
// match the user's roles, then fetch each match's detail (which includes the content).
import type { JobSource, RawJob } from "../contracts";
import { boardsFor } from "./companies";
import { titleMatches } from "./filter";
import { fetchJson, htmlToText, looksRemote, newestFirst, parseSalaryText, pool, toIso, type ScanContext } from "./util";

interface GhJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  updated_at?: string;
  first_published?: string;
  company_name?: string;
  content?: string;
  metadata?: { name: string; value: unknown }[] | null;
  pay_input_ranges?: { min_cents?: number; max_cents?: number; currency_type?: string; title?: string }[];
}

const API = "https://boards-api.greenhouse.io/v1/boards";

function salaryFrom(j: GhJob, description: string): RawJob["salary"] {
  const range = j.pay_input_ranges?.find((r) => r.currency_type && (r.min_cents || r.max_cents));
  if (range) {
    return {
      min: range.min_cents ? range.min_cents / 100 : undefined,
      max: range.max_cents ? range.max_cents / 100 : undefined,
      currency: range.currency_type!,
    };
  }
  const line = description.match(/[^\n]*(salary|compensation|pay range|base pay)[^\n]*\n?[^\n]*/i)?.[0];
  return parseSalaryText(line);
}

export const greenhouse: JobSource = {
  id: "greenhouse",
  async fetch(ctx) {
    const c = ctx as ScanContext;
    const boards = boardsFor(ctx.settings, "greenhouse");
    const report = (msg: string) => c.onError?.(`greenhouse/${msg}`);

    // 1) list titles per board
    const lists = await pool(
      boards,
      4,
      async (b) => {
        const data = await fetchJson<{ jobs?: GhJob[] }>(`${API}/${encodeURIComponent(b.slug)}/jobs`);
        return (data.jobs ?? []).filter((j) => titleMatches(j.title, ctx.settings.roles)).map((j) => ({ b, j }));
      },
      (b, e) => report(`${b.slug}: ${(e as Error).message}`),
    );
    const matches = newestFirst(
      lists.flat().map((m) => ({ ...m, postedAt: m.j.first_published ?? m.j.updated_at })),
      ctx.limit,
    );

    // 2) details (content, pay ranges) for the matches only
    return pool(
      matches,
      4,
      async ({ b, j: listed }) => {
        let j = listed;
        try {
          j = { ...listed, ...(await fetchJson<GhJob>(`${API}/${encodeURIComponent(b.slug)}/jobs/${listed.id}?pay_transparency=true`)) };
        } catch (e) {
          report(`${b.slug}/${listed.id} detail: ${(e as Error).message}`);
        }
        const location = j.location?.name?.trim() ?? "";
        const description = htmlToText(j.content);
        const meta = (j.metadata ?? []).map((m) => (typeof m.value === "string" ? m.value : Array.isArray(m.value) ? m.value.join(" ") : "")).join(" ");
        const job: RawJob = {
          source: "greenhouse",
          externalId: `${b.slug}:${j.id}`,
          title: j.title.trim(),
          company: j.company_name?.trim() || b.name,
          location,
          remote: looksRemote(location, meta),
          url: j.absolute_url,
          applyUrl: j.absolute_url,
          applyMethod: "greenhouse",
          description,
          postedAt: toIso(j.first_published ?? j.updated_at),
          salary: salaryFrom(j, description),
        };
        return job;
      },
    );
  },
};
