// We Work Remotely category RSS feeds, parsed with regex (no XML dependency).
import type { JobSource, RawJob } from "../contracts";
import { titleMatches } from "./filter";
import { decodeEntities, fetchText, htmlToText, newestFirst, pool, resolveApply, toIso, type ScanContext } from "./util";

const BASE = "https://weworkremotely.com/categories";

/** role keyword → WWR category feeds */
const CATEGORY_RULES: [RegExp, string[]][] = [
  [/design|ux|ui\b|visual|graphic|brand|illustrat/i, ["remote-design-jobs"]],
  [/front.?end|react|vue|angular|web developer/i, ["remote-front-end-programming-jobs", "remote-full-stack-programming-jobs"]],
  [/back.?end|api|java\b|python|golang|ruby|php|node/i, ["remote-back-end-programming-jobs", "remote-full-stack-programming-jobs"]],
  [/full.?stack|software|engineer|developer|programmer|wordpress/i, ["remote-full-stack-programming-jobs", "remote-back-end-programming-jobs", "remote-front-end-programming-jobs"]],
  [/devops|sre|site reliability|sysadmin|infrastructure|cloud/i, ["remote-devops-sysadmin-jobs"]],
  [/product manager|product owner|product lead|program manager|project manager/i, ["remote-product-jobs"]],
  [/support|customer success|customer service/i, ["remote-customer-support-jobs"]],
  [/sales|marketing|growth|seo|content|copywrit|social media/i, ["remote-sales-and-marketing-jobs"]],
  [/finance|accountant|legal|management|operations|hr\b|recruit/i, ["remote-management-and-finance-jobs"]],
];

export function wwrCategories(roles: string[]): string[] {
  const cats = new Set<string>();
  for (const r of roles) for (const [re, list] of CATEGORY_RULES) if (re.test(r)) list.forEach((c) => cats.add(c));
  if (!cats.size) cats.add("all-other-remote-jobs");
  return [...cats];
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

export const weworkremotely: JobSource = {
  id: "weworkremotely",
  async fetch(ctx) {
    const c = ctx as ScanContext;
    const roles = ctx.settings.roles;
    const feeds = await pool(
      wwrCategories(roles),
      3,
      (cat) => fetchText(`${BASE}/${cat}.rss`),
      (cat, e) => c.onError?.(`weworkremotely/${cat}: ${(e as Error).message}`),
    );
    const seen = new Set<string>();
    const jobs: RawJob[] = [];
    for (const xml of feeds) {
      for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const rawTitle = decodeEntities(tag(item, "title"));
        // "Company: Job title"
        const idx = rawTitle.indexOf(": ");
        const company = idx > 0 ? rawTitle.slice(0, idx).trim() : "Unknown";
        const title = (idx > 0 ? rawTitle.slice(idx + 2) : rawTitle).replace(/\s*\((remote|anywhere)\)\s*$/i, "").trim();
        const link = decodeEntities(tag(item, "link") || tag(item, "guid"));
        if (!link || seen.has(link) || !titleMatches(title, roles)) continue;
        seen.add(link);
        const region = decodeEntities(tag(item, "region"));
        const country = decodeEntities(tag(item, "country"));
        const descHtml = tag(item, "description");
        jobs.push({
          source: "weworkremotely",
          externalId: link.replace(/^https?:\/\/[^/]+\/remote-jobs\//, ""),
          title,
          company,
          location: [region, country].filter(Boolean).join("; ") || "Anywhere in the World",
          remote: true,
          url: link,
          ...resolveApply(link, descHtml),
          description: htmlToText(descHtml),
          postedAt: toIso(tag(item, "pubDate")),
        });
      }
    }
    return newestFirst(jobs, ctx.limit);
  },
};
