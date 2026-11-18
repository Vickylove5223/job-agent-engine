// Local wizard state. Everything lives here until "Launch my agent" writes it to the database.
import type { JobType, Seniority, WorkMode } from "@shared/types";
import { JOB_SITES, type JobSite } from "@shared/sites";

export interface ResumeFile {
  fileName: string;
  size: number;
  base64: string;
}

export interface Draft {
  step: number;
  // 1. Welcome
  fullName: string;
  phone: string;
  country: string;
  city: string;
  // 2. Resume
  resume: ResumeFile | null;
  headline: string;
  linkedin: string;
  portfolio: string;
  // 3. Roles
  roles: string[];
  seniority: Seniority[];
  yearsExperience: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  // 4. Where
  workModes: WorkMode[];
  countries: string[];
  cities: string[];
  relocate: boolean;
  sponsorship: boolean;
  workAuthorization: string;
  // 5. Pay
  minSalary: string;
  currency: string;
  currencyTouched: boolean;
  period: "year" | "month";
  jobTypes: JobType[];
  noticePeriod: string;
  // 6. Sites — null until the recommendation has run for the current `sitesKey`
  enabledSites: string[] | null;
  sitesKey: string;
  // 7. Autopilot
  capLinkedin: string;
  capIndeed: string;
  capAts: string;
  applyThreshold: number;
  coverLetter: "when_required" | "always";
  paused: boolean;
}

export const TOTAL_STEPS = 7;

export const initialDraft: Draft = {
  step: 1,
  fullName: "", phone: "", country: "", city: "",
  resume: null, headline: "", linkedin: "", portfolio: "",
  roles: [], seniority: [], yearsExperience: "", includeKeywords: [], excludeKeywords: [],
  workModes: [], countries: [], cities: [], relocate: false, sponsorship: false, workAuthorization: "",
  minSalary: "", currency: "USD", currencyTouched: false, period: "year", jobTypes: ["full_time"], noticePeriod: "",
  enabledSites: null, sitesKey: "",
  capLinkedin: "15", capIndeed: "15", capAts: "30", applyThreshold: 80, coverLetter: "when_required", paused: false,
};

const KEY = "onboarding-draft";

export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialDraft;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    const d = { ...initialDraft, ...parsed };
    d.step = Math.min(Math.max(1, Number(d.step) || 1), TOTAL_STEPS);
    return d;
  } catch {
    return initialDraft;
  }
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Quota exceeded (large resume) — keep the rest of the answers at least.
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...d, resume: null }));
    } catch {
      /* storage unavailable */
    }
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ---------- validation ----------
export const onlyRemote = (d: Draft) => d.workModes.length === 1 && d.workModes[0] === "remote";

export function isStepValid(d: Draft, step: number): boolean {
  switch (step) {
    case 1: return d.fullName.trim().length > 0 && d.country.length > 0;
    case 2: return true;
    case 3: return d.roles.length > 0 && d.seniority.length > 0;
    case 4: return d.workModes.length > 0 && (d.countries.length > 0 || onlyRemote(d));
    case 5: return d.jobTypes.length > 0;
    case 6: return (d.enabledSites?.length ?? 0) > 0;
    default: return true;
  }
}

// ---------- options ----------
export const ROLE_SUGGESTIONS = [
  "Product Designer", "UI/UX Designer", "UX Researcher", "Graphic Designer", "Frontend Developer", "Full-stack Developer",
  "WordPress Developer", "Data Analyst", "Product Manager", "Marketing Manager", "Content Writer", "Customer Success",
];

export const SENIORITY_OPTIONS: { value: Seniority; label: string }[] = [
  { value: "intern", label: "Intern" }, { value: "junior", label: "Junior" }, { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" }, { value: "lead", label: "Lead" },
];

export const WORK_MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: "remote", label: "Remote" }, { value: "hybrid", label: "Hybrid" }, { value: "onsite", label: "On-site" },
];

export const JOB_TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: "full_time", label: "Full-time" }, { value: "contract", label: "Contract" }, { value: "part_time", label: "Part-time" },
  { value: "freelance", label: "Freelance" }, { value: "internship", label: "Internship" },
];

export const CURRENCIES = ["USD", "NGN", "GBP", "EUR", "CAD", "AUD", "KES", "ZAR", "GHS", "INR", "AED"];

const EURO = ["IE", "DE", "FR", "NL", "BE", "ES", "PT", "IT", "AT", "FI"];
export function currencyForCountry(code: string): string {
  const map: Record<string, string> = { NG: "NGN", GB: "GBP", US: "USD", CA: "CAD", AU: "AUD", KE: "KES", ZA: "ZAR", GH: "GHS", IN: "INR", AE: "AED" };
  if (map[code]) return map[code];
  if (EURO.includes(code)) return "EUR";
  return "USD";
}

export const labelOf = <T extends string>(opts: { value: T; label: string }[], v: T) => opts.find((o) => o.value === v)?.label ?? v;

/** Yearly minimum salary as a number, or null when not set. */
export function yearlySalary(d: Draft): number | null {
  const n = Number(d.minSalary);
  if (!d.minSalary.trim() || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(d.period === "month" ? n * 12 : n);
}

export const formatMoney = (currency: string, n: number) => `${currency} ${n.toLocaleString("en-US")}`;

export const siteById = (id: string): JobSite | undefined => JOB_SITES.find((s) => s.id === id);

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
