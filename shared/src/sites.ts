// Catalog of job sites the agent can monitor / apply on, by region.
// Used by onboarding (recommend sites for the user's locations), Settings, and the scanner/worker.
//
// apply:
//   "auto"     – the worker can submit applications on this site for the user
//   "assisted" – the agent monitors listings and applies when the posting leads to a
//                supported company form (Greenhouse, Lever, Ashby, Workable); otherwise it
//                queues the job for the user
//   "monitor"  – alerts only; the user applies themselves
// kind:
//   "api"      – public API/feed, scanned in the cloud every 30 min
//   "browser"  – searched by the local worker in the user's logged-in browser

export type ApplySupport = "auto" | "assisted" | "monitor";
export type SiteKind = "api" | "browser";

export interface JobSite {
  id: string;
  name: string;
  url: string;
  /** ISO 3166-1 alpha-2 country codes, or "REMOTE" (remote boards) / "GLOBAL" (works everywhere) */
  regions: string[];
  kind: SiteKind;
  apply: ApplySupport;
  needsLogin: boolean;
  /** job categories the site is especially strong in; empty = general */
  focus?: string[];
  note?: string;
}

export const JOB_SITES: JobSite[] = [
  // ---------- Global ----------
  { id: "linkedin", name: "LinkedIn", url: "https://www.linkedin.com/jobs", regions: ["GLOBAL"], kind: "browser", apply: "auto", needsLogin: true, note: "Easy Apply jobs are submitted for you. Keep the daily limit low to protect your account." },
  { id: "indeed", name: "Indeed", url: "https://www.indeed.com", regions: ["GLOBAL"], kind: "browser", apply: "auto", needsLogin: true, note: "Jobs with “Apply with Indeed” are submitted for you; others open the company site." },
  { id: "greenhouse", name: "Greenhouse company boards", url: "https://www.greenhouse.com", regions: ["GLOBAL"], kind: "api", apply: "auto", needsLogin: false, note: "Thousands of tech companies hire through Greenhouse. No login needed." },
  { id: "lever", name: "Lever company boards", url: "https://www.lever.co", regions: ["GLOBAL"], kind: "api", apply: "auto", needsLogin: false },
  { id: "ashby", name: "Ashby company boards", url: "https://www.ashbyhq.com", regions: ["GLOBAL"], kind: "api", apply: "auto", needsLogin: false },
  { id: "workable", name: "Workable company boards", url: "https://jobs.workable.com", regions: ["GLOBAL"], kind: "api", apply: "auto", needsLogin: false },
  { id: "glassdoor", name: "Glassdoor", url: "https://www.glassdoor.com/Job", regions: ["GLOBAL"], kind: "browser", apply: "monitor", needsLogin: true },
  { id: "wellfound", name: "Wellfound (startups)", url: "https://wellfound.com/jobs", regions: ["GLOBAL", "US"], kind: "browser", apply: "assisted", needsLogin: true, focus: ["startup"] },
  { id: "dribbble", name: "Dribbble Jobs", url: "https://dribbble.com/jobs", regions: ["GLOBAL", "REMOTE"], kind: "browser", apply: "assisted", needsLogin: false, focus: ["design"] },
  { id: "behance", name: "Behance Jobs", url: "https://www.behance.net/joblist", regions: ["GLOBAL", "REMOTE"], kind: "browser", apply: "monitor", needsLogin: true, focus: ["design"] },
  { id: "arbeitnow", name: "Arbeitnow", url: "https://www.arbeitnow.com", regions: ["DE", "NL", "AT", "CH", "BE", "FR", "ES", "IT", "PL", "IE", "SE", "DK", "PT", "GB"], kind: "api", apply: "assisted", needsLogin: false, note: "European jobs, many tagged with visa sponsorship." },
  { id: "adzuna", name: "Adzuna", url: "https://www.adzuna.com", regions: ["GB", "US", "CA", "AU", "DE", "FR", "IN", "ZA", "NL", "IT", "ES", "PL", "SG", "BR", "MX", "NZ", "AT", "CH", "BE"], kind: "api", apply: "assisted", needsLogin: false, note: "Large aggregator. Needs a free API key on the scanner." },

  // ---------- Remote ----------
  { id: "remoteok", name: "RemoteOK", url: "https://remoteok.com", regions: ["REMOTE"], kind: "api", apply: "assisted", needsLogin: false },
  { id: "weworkremotely", name: "We Work Remotely", url: "https://weworkremotely.com", regions: ["REMOTE"], kind: "api", apply: "assisted", needsLogin: false },
  { id: "remotive", name: "Remotive", url: "https://remotive.com", regions: ["REMOTE"], kind: "api", apply: "assisted", needsLogin: false },
  { id: "himalayas", name: "Himalayas", url: "https://himalayas.app/jobs", regions: ["REMOTE"], kind: "api", apply: "assisted", needsLogin: false },
  { id: "workingnomads", name: "Working Nomads", url: "https://www.workingnomads.com/jobs", regions: ["REMOTE"], kind: "api", apply: "assisted", needsLogin: false },
  { id: "jobspresso", name: "Jobspresso", url: "https://jobspresso.co", regions: ["REMOTE"], kind: "browser", apply: "monitor", needsLogin: false },

  // ---------- Africa ----------
  { id: "jobberman", name: "Jobberman", url: "https://www.jobberman.com", regions: ["NG", "GH"], kind: "browser", apply: "assisted", needsLogin: true, note: "Nigeria's and Ghana's largest job board." },
  { id: "myjobmag", name: "MyJobMag", url: "https://www.myjobmag.com", regions: ["NG", "GH", "KE", "ZA"], kind: "browser", apply: "assisted", needsLogin: false },
  { id: "hotnigerianjobs", name: "Hot Nigerian Jobs", url: "https://www.hotnigerianjobs.com", regions: ["NG"], kind: "browser", apply: "monitor", needsLogin: false, note: "Most listings ask you to apply by email — alerts only." },
  { id: "brightermonday", name: "BrighterMonday", url: "https://www.brightermonday.co.ke", regions: ["KE", "UG", "TZ"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "fuzu", name: "Fuzu", url: "https://www.fuzu.com", regions: ["KE", "UG", "NG"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "careers24", name: "Careers24", url: "https://www.careers24.com", regions: ["ZA"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "pnet", name: "PNet", url: "https://www.pnet.co.za", regions: ["ZA"], kind: "browser", apply: "assisted", needsLogin: true },

  // ---------- North America ----------
  { id: "ziprecruiter", name: "ZipRecruiter", url: "https://www.ziprecruiter.com", regions: ["US", "CA"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "dice", name: "Dice", url: "https://www.dice.com", regions: ["US"], kind: "browser", apply: "assisted", needsLogin: true, focus: ["tech"] },
  { id: "builtin", name: "Built In", url: "https://builtin.com/jobs", regions: ["US"], kind: "browser", apply: "assisted", needsLogin: false, focus: ["tech"] },
  { id: "usajobs", name: "USAJOBS", url: "https://www.usajobs.gov", regions: ["US"], kind: "api", apply: "monitor", needsLogin: true, note: "US government jobs; usually require US citizenship." },
  { id: "jobbank", name: "Job Bank Canada", url: "https://www.jobbank.gc.ca", regions: ["CA"], kind: "browser", apply: "monitor", needsLogin: false },

  // ---------- UK & Europe ----------
  { id: "reed", name: "Reed", url: "https://www.reed.co.uk", regions: ["GB"], kind: "api", apply: "assisted", needsLogin: true },
  { id: "totaljobs", name: "Totaljobs", url: "https://www.totaljobs.com", regions: ["GB"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "cvlibrary", name: "CV-Library", url: "https://www.cv-library.co.uk", regions: ["GB"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "stepstone", name: "StepStone", url: "https://www.stepstone.de", regions: ["DE", "AT", "BE", "NL"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "xing", name: "XING", url: "https://www.xing.com/jobs", regions: ["DE", "AT", "CH"], kind: "browser", apply: "monitor", needsLogin: true },
  { id: "wttj", name: "Welcome to the Jungle", url: "https://www.welcometothejungle.com", regions: ["FR", "ES", "GB", "US"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "iamexpat", name: "IamExpat Jobs", url: "https://www.iamexpat.nl/career/jobs-netherlands", regions: ["NL"], kind: "browser", apply: "assisted", needsLogin: false, note: "English-speaking jobs in the Netherlands, many offering visa sponsorship." },
  { id: "undutchables", name: "Undutchables", url: "https://undutchables.nl/vacancies", regions: ["NL"], kind: "browser", apply: "monitor", needsLogin: false, note: "Recruiter for international (non-Dutch-speaking) professionals." },
  { id: "magnetme", name: "Magnet.me", url: "https://magnet.me", regions: ["NL", "GB"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "nationalevacaturebank", name: "Nationale Vacaturebank", url: "https://www.nationalevacaturebank.nl", regions: ["NL"], kind: "browser", apply: "monitor", needsLogin: false, note: "Mostly Dutch-language jobs." },
  { id: "eures", name: "EURES (EU job mobility)", url: "https://eures.europa.eu", regions: ["DE", "FR", "NL", "IE", "ES", "IT", "PL", "PT", "BE", "AT", "SE", "DK", "FI"], kind: "browser", apply: "monitor", needsLogin: false },

  // ---------- Middle East & Asia-Pacific ----------
  { id: "bayt", name: "Bayt", url: "https://www.bayt.com", regions: ["AE", "SA", "QA", "KW", "EG"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "gulftalent", name: "GulfTalent", url: "https://www.gulftalent.com", regions: ["AE", "SA", "QA", "KW", "OM", "BH"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "naukri", name: "Naukri", url: "https://www.naukri.com", regions: ["IN"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "foundit", name: "foundit", url: "https://www.foundit.in", regions: ["IN", "SG", "AE"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "seek", name: "SEEK", url: "https://www.seek.com.au", regions: ["AU", "NZ"], kind: "browser", apply: "assisted", needsLogin: true },
  { id: "mycareersfuture", name: "MyCareersFuture", url: "https://www.mycareersfuture.gov.sg", regions: ["SG"], kind: "browser", apply: "monitor", needsLogin: true },
];

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬" }, { code: "GH", name: "Ghana", flag: "🇬🇭" }, { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" }, { code: "EG", name: "Egypt", flag: "🇪🇬" }, { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" }, { code: "RW", name: "Rwanda", flag: "🇷🇼" },
  { code: "US", name: "United States", flag: "🇺🇸" }, { code: "CA", name: "Canada", flag: "🇨🇦" }, { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" }, { code: "IE", name: "Ireland", flag: "🇮🇪" }, { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" }, { code: "NL", name: "Netherlands", flag: "🇳🇱" }, { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "ES", name: "Spain", flag: "🇪🇸" }, { code: "PT", name: "Portugal", flag: "🇵🇹" }, { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "PL", name: "Poland", flag: "🇵🇱" }, { code: "AT", name: "Austria", flag: "🇦🇹" }, { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" }, { code: "DK", name: "Denmark", flag: "🇩🇰" }, { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" }, { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" }, { code: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" }, { code: "OM", name: "Oman", flag: "🇴🇲" }, { code: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "IN", name: "India", flag: "🇮🇳" }, { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "AU", name: "Australia", flag: "🇦🇺" }, { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
];

export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

/**
 * Sites relevant to where the user wants to work. Global sites always apply; remote boards
 * are added when the user accepts remote work; country boards match the chosen countries.
 * Optional `focus` (e.g. ["design"]) adds niche boards for that field.
 */
export function recommendSites(opts: { countries: string[]; remote: boolean; focus?: string[] }): JobSite[] {
  const focus = (opts.focus ?? []).map((f) => f.toLowerCase());
  return JOB_SITES.filter((s) => {
    if (s.focus?.length && !s.focus.some((f) => focus.includes(f))) {
      // niche board: only when the user's field matches
      return false;
    }
    if (s.regions.includes("GLOBAL")) return true;
    if (opts.remote && s.regions.includes("REMOTE")) return true;
    return s.regions.some((r) => opts.countries.includes(r));
  });
}

/** Infer a field focus from role titles, used to add niche boards (e.g. Dribbble for designers). */
export function focusFromRoles(roles: string[]): string[] {
  const t = roles.join(" ").toLowerCase();
  const f: string[] = [];
  if (/(design|ui|ux|graphic|product designer|visual|brand)/.test(t)) f.push("design");
  if (/(engineer|developer|devops|data|software|frontend|backend|full.?stack|wordpress)/.test(t)) f.push("tech");
  if (/(startup|founding)/.test(t)) f.push("startup");
  return f;
}

export const APPLY_LABEL: Record<ApplySupport, string> = {
  auto: "Auto-apply",
  assisted: "Finds & applies when possible",
  monitor: "Alerts only",
};
