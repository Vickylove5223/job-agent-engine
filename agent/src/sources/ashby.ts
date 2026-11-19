// Ashby job boards.
//
// The official posting API (https://api.ashbyhq.com/posting-api/job-board/{slug}) embeds every
// description, which is 8–15 MB for large boards and times out on slower connections. So we:
//   1. list titles via the public jobs-page GraphQL endpoint (the one jobs.ashbyhq.com itself uses,
//      ~100 KB), keep titles matching the user's roles, then fetch only those postings' details;
//   2. fall back to the official posting API when the GraphQL call fails.
import type { JobSource, RawJob } from "../contracts";
import { boardsFor } from "./companies";
import { titleMatches } from "./filter";
import { USER_AGENT, fetchJson, htmlToText, looksRemote, newestFirst, parseSalaryText, pool, toIso, truncate, type ScanContext } from "./util";

const GQL = "https://jobs.ashbyhq.com/api/non-user-graphql";
const TIMEOUT = 15_000;

async function gql<T>(op: string, query: string, variables: Record<string, string>): Promise<T> {
  const res = await fetch(`${GQL}?op=${op}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ operationName: op, variables, query }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ashby graphql ${op}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!body.data) throw new Error(`ashby graphql ${op}: ${body.errors?.[0]?.message ?? "no data"}`);
  return body.data;
}

interface GqlListed {
  id: string;
  title: string;
  locationName?: string;
  workplaceType?: string | null;
  secondaryLocations?: { locationName?: string }[];
  compensationTierSummary?: string | null;
}

interface GqlPosting {
  id: string;
  title: string;
  descriptionHtml?: string;
  locationName?: string;
  workplaceType?: string | null;
  publishedDate?: string;
  secondaryLocationNames?: string[];
  compensationTierSummary?: string | null;
}

const LIST_Q = `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
  jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
    jobPostings { id title locationName workplaceType secondaryLocations { locationName } compensationTierSummary }
  }
}`;

const POSTING_Q = `query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
  jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) {
    id title descriptionHtml locationName workplaceType publishedDate secondaryLocationNames compensationTierSummary
  }
}`;

// ---- official posting API (fallback) ----
interface AshbyComp {
  compensationType?: string;
  interval?: string;
  currencyCode?: string;
  minValue?: number | null;
  maxValue?: number | null;
}
interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean;
  workplaceType?: string;
  isListed?: boolean;
  jobUrl: string;
  applyUrl?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  publishedAt?: string;
  compensation?: { summaryComponents?: AshbyComp[] };
}

const isRemote = (workplaceType: string | null | undefined, location: string) =>
  /remote/i.test(workplaceType ?? "") || (!/hybrid|onsite/i.test(workplaceType ?? "") && looksRemote(location));

async function viaGraphql(slug: string, name: string, ctx: ScanContext): Promise<RawJob[]> {
  const list = await gql<{ jobBoard?: { jobPostings?: GqlListed[] } }>("ApiJobBoardWithTeams", LIST_Q, { organizationHostedJobsPageName: slug });
  const postings = list.jobBoard?.jobPostings;
  if (!postings) throw new Error(`ashby board ${slug} not found`);
  const matches = postings.filter((p) => titleMatches(p.title, ctx.settings.roles)).slice(0, ctx.limit);
  return pool(matches, 3, async (listed) => {
    let p: GqlPosting = { ...listed, secondaryLocationNames: listed.secondaryLocations?.map((s) => s.locationName ?? "") };
    try {
      const d = await gql<{ jobPosting?: GqlPosting }>("ApiJobPosting", POSTING_Q, { organizationHostedJobsPageName: slug, jobPostingId: listed.id });
      if (d.jobPosting) p = { ...p, ...d.jobPosting };
    } catch (e) {
      ctx.onError?.(`ashby/${slug}/${listed.id} detail: ${(e as Error).message}`);
    }
    const location = [...new Set([p.locationName, ...(p.secondaryLocationNames ?? [])].filter(Boolean))].join("; ");
    const url = `https://jobs.ashbyhq.com/${slug}/${p.id}`;
    const job: RawJob = {
      source: "ashby",
      externalId: `${slug}:${p.id}`,
      title: p.title.trim(),
      company: name,
      location,
      remote: isRemote(p.workplaceType, location),
      url,
      applyUrl: `${url}/application`,
      applyMethod: "ashby",
      description: htmlToText(p.descriptionHtml),
      postedAt: toIso(p.publishedDate),
      salary: parseSalaryText(p.compensationTierSummary),
    };
    return job;
  });
}

async function viaPostingApi(slug: string, name: string, ctx: ScanContext): Promise<RawJob[]> {
  const data = await fetchJson<{ jobs?: AshbyJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`);
  return (data.jobs ?? [])
    .filter((j) => j.isListed !== false && titleMatches(j.title, ctx.settings.roles))
    .map((j): RawJob => {
      const location = [...new Set([j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean))].join("; ");
      const comp = j.compensation?.summaryComponents?.find((s) => s.compensationType === "Salary" && (!s.interval || /year/i.test(s.interval)) && s.currencyCode);
      return {
        source: "ashby",
        externalId: `${slug}:${j.id}`,
        title: j.title.trim(),
        company: name,
        location,
        remote: isRemote(j.workplaceType, location) || (j.isRemote === true && !/hybrid|onsite/i.test(j.workplaceType ?? "")),
        url: j.jobUrl,
        applyUrl: j.applyUrl ?? j.jobUrl,
        applyMethod: "ashby",
        description: j.descriptionPlain ? truncate(j.descriptionPlain.trim()) : htmlToText(j.descriptionHtml),
        postedAt: toIso(j.publishedAt),
        salary: comp ? { min: comp.minValue ?? undefined, max: comp.maxValue ?? undefined, currency: comp.currencyCode! } : undefined,
      };
    });
}

export const ashby: JobSource = {
  id: "ashby",
  async fetch(ctx) {
    const c = ctx as ScanContext;
    const boards = boardsFor(ctx.settings, "ashby");
    const perBoard = await pool(
      boards,
      4,
      async (b) => {
        try {
          return await viaGraphql(b.slug, b.name, c);
        } catch {
          return await viaPostingApi(b.slug, b.name, c);
        }
      },
      (b, e) => c.onError?.(`ashby/${b.slug}: ${(e as Error).message}`),
    );
    return newestFirst(perBoard.flat(), ctx.limit);
  },
};
