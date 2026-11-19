// Curated seed list of company ATS boards so Greenhouse / Lever / Ashby / Workable have something
// to scan before the user adds their own target companies.
//
// Every slug below was verified live on 2026-11-18 against its public API (HTTP 200 with ≥1 job).
// The trailing comment is "<open jobs> [NL jobs] [design jobs]" at verification time, e.g.
// `// 242 · NL 78 · design 2`. Re-verify with: npx tsx src/sources/try.ts --verify-boards
import type { Settings } from "@shared/types";

export type Ats = "greenhouse" | "lever" | "ashby" | "workable";

export interface Board {
  ats: Ats;
  slug: string;
  name: string;
  /** ISO codes of countries where they hire (offices / remote-eligible) */
  countries: string[];
  /** hires fully remote for at least some roles */
  remote: boolean;
  focus?: ("design" | "tech")[];
  /** Lever boards hosted in the EU region (api.eu.lever.co) */
  eu?: boolean;
}

export const BOARDS: Board[] = [
  // ---------------- Netherlands (HQ or significant NL office) ----------------
  { ats: "greenhouse", slug: "adyen", name: "Adyen", countries: ["NL", "US", "GB", "SG", "BR", "AU"], remote: false, focus: ["tech"] }, // 242 · NL 78 · design 2
  { ats: "greenhouse", slug: "dept", name: "DEPT", countries: ["NL", "US", "GB", "DE", "BE", "ES"], remote: true, focus: ["design", "tech"] }, // 193 · NL 32 · design 22
  { ats: "greenhouse", slug: "catawiki", name: "Catawiki", countries: ["NL", "BE", "PT", "DE", "FR", "IT"], remote: true, focus: ["tech", "design"] }, // 30 · NL 17 · design 2
  { ats: "greenhouse", slug: "imc", name: "IMC Trading", countries: ["NL", "US", "AU", "IN", "GB"], remote: false, focus: ["tech"] }, // 153 · NL 23 · design 1
  { ats: "greenhouse", slug: "flowtraders", name: "Flow Traders", countries: ["NL", "US", "SG"], remote: false, focus: ["tech"] }, // 44 · NL 16
  { ats: "greenhouse", slug: "databricks", name: "Databricks", countries: ["NL", "US", "GB", "DE", "IN", "FR"], remote: true, focus: ["tech", "design"] }, // 897 · NL 32 · design 15
  { ats: "greenhouse", slug: "hellofresh", name: "HelloFresh", countries: ["NL", "DE", "US", "CA", "GB"], remote: false, focus: ["tech"] }, // 367 · NL 22 · design 4
  { ats: "greenhouse", slug: "datadog", name: "Datadog", countries: ["NL", "US", "FR", "GB", "IE"], remote: true, focus: ["tech", "design"] }, // 383 · NL 18 · design 10
  { ats: "greenhouse", slug: "celonis", name: "Celonis", countries: ["NL", "DE", "ES", "US", "GB", "IN"], remote: false, focus: ["tech"] }, // 261 · NL 12 · design 3
  { ats: "greenhouse", slug: "elastic", name: "Elastic", countries: ["NL", "US", "CA", "ES", "GB", "DE", "FR"], remote: true, focus: ["tech", "design"] }, // 374 · NL 4 · design 7
  { ats: "greenhouse", slug: "gitlab", name: "GitLab", countries: ["NL", "US", "CA", "GB", "IE", "DE", "IN"], remote: true, focus: ["tech", "design"] }, // 250 · NL 5 · design 2
  { ats: "greenhouse", slug: "jetbrains", name: "JetBrains", countries: ["NL", "US", "DE", "CZ"], remote: true, focus: ["tech"] }, // 10 · NL 5
  { ats: "greenhouse", slug: "mewssystems", name: "Mews", countries: ["NL", "GB", "US", "AU", "CZ"], remote: false, focus: ["tech"] }, // 33 · NL 5
  { ats: "greenhouse", slug: "fourthline", name: "Fourthline", countries: ["NL"], remote: false, focus: ["tech"] }, // 3 · NL 3
  { ats: "greenhouse", slug: "lucidsoftware", name: "Lucid Software", countries: ["NL", "US", "AU"], remote: false, focus: ["tech", "design"] }, // 26 · NL 6
  { ats: "greenhouse", slug: "ebury", name: "Ebury", countries: ["NL", "GB", "ES"], remote: false, focus: ["tech"] }, // 157 · NL 5 · design 3
  { ats: "greenhouse", slug: "typeform", name: "Typeform", countries: ["NL", "DE", "IE", "GB", "US", "ES"], remote: true, focus: ["design", "tech"] }, // 6 · NL 3
  { ats: "greenhouse", slug: "sumup", name: "SumUp", countries: ["NL", "DE", "GB", "BR", "FR"], remote: false, focus: ["tech", "design"] }, // 311 · NL 4 · design 2
  { ats: "greenhouse", slug: "reddit", name: "Reddit", countries: ["NL", "US", "GB", "CA"], remote: true, focus: ["tech", "design"] }, // 147 · NL 6 · design 5
  { ats: "greenhouse", slug: "grafanalabs", name: "Grafana Labs", countries: ["NL", "US", "CA", "ES", "DE", "GB", "SE"], remote: true, focus: ["tech", "design"] }, // 138 · NL 2
  { ats: "greenhouse", slug: "algolia", name: "Algolia", countries: ["NL", "FR", "GB", "US"], remote: true, focus: ["tech"] }, // 28 · NL 2
  { ats: "greenhouse", slug: "contentstack", name: "Contentstack", countries: ["NL", "US", "IN", "PT"], remote: true, focus: ["tech"] }, // 13 · NL 2
  { ats: "greenhouse", slug: "dataiku", name: "Dataiku", countries: ["NL", "US", "FR", "GB"], remote: true, focus: ["tech"] }, // 13 · NL 2
  { ats: "lever", slug: "tomtom", name: "TomTom", countries: ["NL", "ES", "IN", "DE", "PL"], remote: false, focus: ["tech", "design"], eu: true }, // 31 · NL 12 · design 2
  { ats: "ashby", slug: "mollie", name: "Mollie", countries: ["NL", "IT", "PT", "GB", "DE", "FR", "BE"], remote: false, focus: ["tech", "design"] }, // 46 · NL 16 · design 2
  { ats: "ashby", slug: "bynder", name: "Bynder", countries: ["NL", "ES", "GB", "US"], remote: false, focus: ["tech", "design"] }, // 23 · NL 12
  { ats: "ashby", slug: "bitvavo", name: "Bitvavo", countries: ["NL"], remote: false, focus: ["tech"] }, // 15 · Amsterdam HQ
  { ats: "ashby", slug: "airwallex", name: "Airwallex", countries: ["NL", "SG", "US", "GB", "AU"], remote: false, focus: ["tech", "design"] }, // 487 · NL 12 · design 13
  { ats: "ashby", slug: "toogoodtogo", name: "Too Good To Go", countries: ["NL", "DK", "GB", "PL", "US", "FR"], remote: false, focus: ["tech"] }, // 60 · NL 3
  { ats: "ashby", slug: "doctolib", name: "Doctolib", countries: ["NL", "DE", "FR", "IT"], remote: false, focus: ["tech", "design"] }, // 156 · NL 2 · design 4
  { ats: "ashby", slug: "pleo", name: "Pleo", countries: ["NL", "PT", "GB", "DE", "DK"], remote: true, focus: ["tech"] }, // 33 · NL 2
  { ats: "ashby", slug: "mazedesign", name: "Maze", countries: ["NL", "US", "GB", "IE"], remote: true, focus: ["design", "tech"] }, // 8 · NL 1

  // ---------------- Europe / international, strong for product design ----------------
  { ats: "greenhouse", slug: "stripe", name: "Stripe", countries: ["IE", "GB", "US", "SG", "NL", "DE", "FR"], remote: true, focus: ["design", "tech"] }, // 791 · NL 1 · design 37
  { ats: "greenhouse", slug: "figma", name: "Figma", countries: ["US", "GB", "DE", "FR"], remote: false, focus: ["design", "tech"] }, // 143 · design 16
  { ats: "greenhouse", slug: "canonical", name: "Canonical", countries: ["GB", "US", "NL", "DE"], remote: true, focus: ["design", "tech"] }, // 317 · design 39 (home-based worldwide)
  { ats: "greenhouse", slug: "intercom", name: "Intercom", countries: ["IE", "GB", "US"], remote: false, focus: ["design", "tech"] }, // 115 · design 5
  { ats: "greenhouse", slug: "hubspotjobs", name: "HubSpot", countries: ["IE", "US", "GB", "DE"], remote: true, focus: ["design", "tech"] }, // 137 · design 12
  { ats: "greenhouse", slug: "contentful", name: "Contentful", countries: ["DE", "GB", "US"], remote: false, focus: ["tech", "design"] }, // 49 · design 2
  { ats: "greenhouse", slug: "commercetools", name: "commercetools", countries: ["DE", "GB", "US", "NL"], remote: false, focus: ["tech"] }, // 32 · NL 1
  { ats: "ashby", slug: "notion", name: "Notion", countries: ["US", "IE", "GB"], remote: false, focus: ["design", "tech"] }, // 167 · design 5
  { ats: "ashby", slug: "linear", name: "Linear", countries: ["US", "GB", "NL", "DE", "SG"], remote: true, focus: ["design", "tech"] }, // 33 · design 4 (remote Europe)
  { ats: "ashby", slug: "getyourguide", name: "GetYourGuide", countries: ["DE", "CH", "NL"], remote: false, focus: ["design", "tech"] }, // 69 · NL 1 · design 5
  { ats: "ashby", slug: "n8n", name: "n8n", countries: ["DE", "US", "NL"], remote: true, focus: ["design", "tech"] }, // 61 · NL 1 · design 4
  { ats: "ashby", slug: "synthesia", name: "Synthesia", countries: ["GB", "US", "DE"], remote: true, focus: ["design", "tech"] }, // 28 · design 4
  { ats: "ashby", slug: "incident", name: "incident.io", countries: ["GB", "US"], remote: false, focus: ["design", "tech"] }, // 34 · design 2
  { ats: "ashby", slug: "posthog", name: "PostHog", countries: ["GB", "US", "NL", "DE"], remote: true, focus: ["design", "tech"] }, // 9 · design 1 (remote EMEA)
  { ats: "ashby", slug: "supabase", name: "Supabase", countries: ["US", "GB", "NL", "DE"], remote: true, focus: ["tech", "design"] }, // 77 (remote global)
  { ats: "ashby", slug: "alan", name: "Alan", countries: ["FR", "BE", "ES"], remote: true, focus: ["design", "tech"] }, // 136 · design 3
  { ats: "ashby", slug: "qonto", name: "Qonto", countries: ["FR", "ES", "DE", "IT"], remote: false, focus: ["tech"] }, // 50 · NL 1
  { ats: "ashby", slug: "backmarket", name: "Back Market", countries: ["FR", "ES"], remote: false, focus: ["tech", "design"] }, // 32 · design 1
  { ats: "ashby", slug: "frontify", name: "Frontify", countries: ["CH", "GB", "US"], remote: true, focus: ["design"] }, // 14 · design 1
  { ats: "ashby", slug: "snyk", name: "Snyk", countries: ["GB", "US", "PT", "NL"], remote: false, focus: ["tech"] }, // 39 · NL 1
  { ats: "ashby", slug: "elevenlabs", name: "ElevenLabs", countries: ["GB", "US", "PL", "DE"], remote: true, focus: ["tech", "design"] }, // 128
  { ats: "ashby", slug: "oyster", name: "Oyster", countries: ["GB", "ES", "NG", "ZA"], remote: true, focus: ["tech"] }, // 21 (remote EMEA)
  { ats: "workable", slug: "learnworlds", name: "LearnWorlds", countries: ["GR", "CY"], remote: true, focus: ["design", "tech"] }, // 18 · design 6

  // ---------------- United Kingdom ----------------
  { ats: "greenhouse", slug: "monzo", name: "Monzo", countries: ["GB", "IE"], remote: true, focus: ["design", "tech"] }, // 63 · design 4
  { ats: "greenhouse", slug: "deliveroo", name: "Deliveroo", countries: ["GB", "IE", "AE"], remote: false, focus: ["design", "tech"] }, // 182 · design 9
  { ats: "greenhouse", slug: "tide", name: "Tide", countries: ["GB", "IN"], remote: true, focus: ["design", "tech"] }, // 81 · design 5
  { ats: "greenhouse", slug: "gocardless", name: "GoCardless", countries: ["GB", "PT"], remote: false, focus: ["tech"] }, // 28
  { ats: "ashby", slug: "multiverse", name: "Multiverse", countries: ["GB"], remote: false, focus: ["design", "tech"] }, // 24 · design 2
  { ats: "ashby", slug: "attio", name: "Attio", countries: ["GB", "US"], remote: false, focus: ["design", "tech"] }, // 22
  { ats: "ashby", slug: "paddle", name: "Paddle", countries: ["GB", "US"], remote: true, focus: ["tech"] }, // 15
  { ats: "ashby", slug: "lemfi", name: "LemFi", countries: ["GB", "US", "IE", "NG"], remote: false, focus: ["tech"] }, // 25

  // ---------------- United States ----------------
  { ats: "greenhouse", slug: "airbnb", name: "Airbnb", countries: ["US", "CA", "GB"], remote: true, focus: ["design", "tech"] }, // 202 · design 9
  { ats: "greenhouse", slug: "pinterest", name: "Pinterest", countries: ["US", "CA", "GB", "IE"], remote: true, focus: ["design", "tech"] }, // 175 · design 10
  { ats: "greenhouse", slug: "brex", name: "Brex", countries: ["US", "CA", "BR"], remote: false, focus: ["design", "tech"] }, // 266 · design 22
  { ats: "greenhouse", slug: "robinhood", name: "Robinhood", countries: ["US", "CA", "GB"], remote: false, focus: ["design", "tech"] }, // 166 · design 9
  { ats: "greenhouse", slug: "affirm", name: "Affirm", countries: ["US", "CA", "GB", "PL"], remote: true, focus: ["design", "tech"] }, // 227 · design 9
  { ats: "greenhouse", slug: "okta", name: "Okta", countries: ["US", "CA", "IN"], remote: false, focus: ["design", "tech"] }, // 359 · design 17
  { ats: "greenhouse", slug: "duolingo", name: "Duolingo", countries: ["US"], remote: false, focus: ["design", "tech"] }, // 57 · design 6
  { ats: "greenhouse", slug: "mercury", name: "Mercury", countries: ["US"], remote: true, focus: ["design", "tech"] }, // 74 · design 5
  { ats: "greenhouse", slug: "asana", name: "Asana", countries: ["US", "CA", "PL"], remote: false, focus: ["design", "tech"] }, // 114 · design 5
  { ats: "greenhouse", slug: "coinbase", name: "Coinbase", countries: ["US", "GB", "CA"], remote: true, focus: ["design", "tech"] }, // 255 · design 4
  { ats: "greenhouse", slug: "instacart", name: "Instacart", countries: ["US", "CA"], remote: true, focus: ["design", "tech"] }, // 83 · design 4
  { ats: "greenhouse", slug: "gusto", name: "Gusto", countries: ["US"], remote: false, focus: ["design", "tech"] }, // 77 · design 4
  { ats: "greenhouse", slug: "discord", name: "Discord", countries: ["US"], remote: true, focus: ["design", "tech"] }, // 26 · design 3
  { ats: "greenhouse", slug: "vercel", name: "Vercel", countries: ["US", "GB", "DE"], remote: true, focus: ["design", "tech"] }, // 86 · design 2
  { ats: "ashby", slug: "openai", name: "OpenAI", countries: ["US", "GB", "SG", "IE"], remote: false, focus: ["design", "tech"] }, // 838 · design 23
  { ats: "ashby", slug: "ramp", name: "Ramp", countries: ["US", "GB"], remote: true, focus: ["design", "tech"] }, // 181 · design 7
  { ats: "ashby", slug: "perplexity", name: "Perplexity", countries: ["US", "GB"], remote: false, focus: ["design", "tech"] }, // 147 · design 10
  { ats: "ashby", slug: "harvey", name: "Harvey", countries: ["US", "GB", "IE"], remote: false, focus: ["design", "tech"] }, // 388 · design 17
  { ats: "ashby", slug: "vanta", name: "Vanta", countries: ["US", "GB", "IE", "CA"], remote: true, focus: ["design", "tech"] }, // 77 · design 5
  { ats: "ashby", slug: "webflow", name: "Webflow", countries: ["US", "CA", "GB"], remote: true, focus: ["design", "tech"] }, // 29 · design 2
  { ats: "ashby", slug: "plaid", name: "Plaid", countries: ["US", "GB"], remote: true, focus: ["design", "tech"] }, // 142 · design 2

  // ---------------- Nigeria / Africa ----------------
  { ats: "greenhouse", slug: "moniepoint", name: "Moniepoint", countries: ["NG", "GB", "PL", "ES"], remote: true, focus: ["design", "tech"] }, // 69 · design 4
  { ats: "workable", slug: "fairmoney", name: "FairMoney", countries: ["NG", "IN"], remote: false, focus: ["tech"] }, // 59
  { ats: "workable", slug: "kuda", name: "Kuda", countries: ["NG", "ZA"], remote: false, focus: ["tech"] }, // 7
];

export interface TargetCompany {
  ats: Ats;
  slug: string;
  name: string;
  eu?: boolean;
}

/**
 * Boards to scan for these settings: seed boards hiring in one of the user's countries (or
 * remote-friendly boards when the user accepts remote work), plus the user's own target companies.
 * Optionally narrowed to one ATS.
 */
export function boardsFor(settings: Settings, ats?: Ats): TargetCompany[] {
  const countries = (settings.countries ?? []).map((c) => c.toUpperCase());
  const remote = settings.remoteOnly || (settings.workModes ?? []).includes("remote");
  const blocked = (settings.blockedCompanies ?? []).map((b) => b.toLowerCase());
  const out = new Map<string, TargetCompany>();
  for (const b of BOARDS) {
    if (ats && b.ats !== ats) continue;
    if (blocked.includes(b.name.toLowerCase())) continue;
    const fits = !countries.length || b.countries.some((c) => countries.includes(c)) || (remote && b.remote);
    if (fits) out.set(`${b.ats}:${b.slug}`, { ats: b.ats, slug: b.slug, name: b.name, eu: b.eu });
  }
  for (const t of settings.targetCompanies ?? []) {
    if (ats && t.ats !== ats) continue;
    const slug = t.slug.trim().toLowerCase();
    if (!slug) continue;
    out.set(`${t.ats}:${slug}`, { ats: t.ats, slug, name: t.name || slug });
  }
  return [...out.values()];
}
