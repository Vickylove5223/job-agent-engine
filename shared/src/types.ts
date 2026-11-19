// Shared data contract for dashboard, scanner and worker. See PLAN.md section 4.
// Timestamps are ISO-8601 strings on the client; the Firestore adapter converts them.

export type ISODate = string;

export type JobSource = "greenhouse" | "lever" | "ashby" | "remoteok" | "adzuna" | "linkedin" | "indeed";
export type ApplyMethod = "greenhouse" | "lever" | "ashby" | "linkedin_easy" | "indeed" | "external";
export type Site = "linkedin" | "indeed" | "ats";

export type JobStatus =
  | "new"
  | "scored"
  | "needs_tailoring"
  | "waiting_input"
  | "ready"
  | "applying"
  | "applied"
  | "skipped"
  | "blocked"
  | "failed";

export const JOB_STATUSES: JobStatus[] = [
  "new", "scored", "needs_tailoring", "waiting_input", "ready", "applying", "applied", "skipped", "blocked", "failed",
];

export type Seniority = "intern" | "junior" | "mid" | "senior" | "lead";

export type WorkMode = "remote" | "hybrid" | "onsite";
export type JobType = "full_time" | "contract" | "part_time" | "freelance" | "internship";

export interface Settings {
  paused: boolean;
  /** set when the user finishes the onboarding wizard */
  onboardedAt?: ISODate;
  roles: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  /** ISO country codes the user wants to work in (drives which job sites are used) */
  countries: string[];
  /** cities / regions within those countries */
  locations: string[];
  workModes: WorkMode[];
  jobTypes: JobType[];
  /** ids from JOB_SITES (shared/src/sites.ts) the agent monitors */
  enabledSites: string[];
  remoteOnly: boolean;
  minSalary: number | null;
  currency: string;
  seniority: Seniority[];
  blockedCompanies: string[];
  thresholds: { apply: number; tailor: number };
  dailyCaps: Record<Site, number>;
  pacingMinutes: { min: number; max: number };
  /** @deprecated use enabledSites; kept so older documents still load */
  sources?: Partial<Record<JobSource, boolean>>;
  targetCompanies: { ats: "greenhouse" | "lever" | "ashby"; slug: string; name: string }[];
  coverLetter: { mode: "when_required" | "always"; tone: "professional" | "warm" | "concise" };
}

export interface ResumeExperience {
  company: string;
  title: string;
  location?: string;
  start: string;
  end: string;
  type?: string;
  bullets: string[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  start?: string;
  end?: string;
  country?: string;
  thesis?: string;
}

export interface Resume {
  summary: string;
  skills: Record<string, string[]>;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  certifications: { name: string; issued?: string }[];
  projects: string[];
  awards: string[];
  languages: string[];
  interests: string[];
}

export interface StandardAnswers {
  workAuthorization?: string;
  needsSponsorship?: string;
  noticePeriod?: string;
  salaryExpectation?: string;
  willingToRelocate?: string;
  yearsExperience?: string;
}

export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  /** city / area the user lives in */
  location: string;
  /** ISO country code of where the user lives */
  country?: string;
  headline?: string;
  links: { linkedin?: string; github?: string; portfolio?: string };
  masterResume?: {
    fileName: string;
    uploadedAt: ISODate;
    pdfBase64?: string;
    text?: string;
    structured?: Resume;
  };
  standardAnswers: StandardAnswers;
}

export type FactCategory = "skill" | "experience" | "preference" | "logistics" | "negative" | "other";

export interface Fact {
  text: string;
  category: FactCategory;
  source: "resume" | "portfolio" | "answer" | "manual";
  questionId?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Gap {
  item: string;
  kind: "wording" | "missing_fact" | "true_gap";
}

export interface Job {
  source: JobSource;
  externalId: string;
  url: string;
  applyUrl: string;
  applyMethod: ApplyMethod;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary?: { min?: number; max?: number; currency: string };
  description: string;
  postedAt?: ISODate;
  foundAt: ISODate;
  status: JobStatus;
  score?: { master: number; tailored?: number; reasons: string[] };
  gaps?: Gap[];
  questionIds?: string[];
  skipReason?: string;
  error?: string;
  attempts: number;
  lockedBy?: string;
  lockedAt?: ISODate;
  updatedAt: ISODate;
  sample?: boolean;
}

export interface TailoredResume {
  structured: Resume;
  changes: string[];
  score: number;
  pdfBase64?: string;
  createdAt: ISODate;
  sample?: boolean;
}

export interface CoverLetter {
  text: string;
  pdfBase64?: string;
  createdAt: ISODate;
  sample?: boolean;
}

export type Outcome = "submitted" | "interview" | "rejected" | "offer" | "ghosted";

export interface Application {
  submittedAt: ISODate;
  site: Site;
  resumeUsed: "master" | "tailored";
  coverLetterUsed: boolean;
  answers: { question: string; answer: string; factIds: string[] }[];
  screenshotJpegBase64?: string;
  outcome: Outcome;
  notes?: string;
  sample?: boolean;
}

export interface Question {
  text: string;
  whyNeeded?: string;
  origin: "scoring" | "form" | "tailoring" | "profile";
  jobIds: string[];
  inputType: "text" | "yes_no" | "number" | "choice";
  options?: string[];
  /** choice questions: allow picking several options */
  multiple?: boolean;
  status: "open" | "answered" | "dismissed";
  /** AI-drafted answer from the resume/facts, prefilled for the user to edit */
  suggestedAnswer?: string;
  answer?: string;
  saveAsFact: boolean;
  createdAt: ISODate;
  answeredAt?: ISODate;
}

export interface ActivityEntry {
  ts: ISODate;
  level: "info" | "success" | "warn" | "error";
  type: string;
  jobId?: string;
  message: string;
  sample?: boolean;
}

export type SessionState = "ok" | "logged_out" | "checkpoint" | "unknown";

export interface WorkerStatus {
  heartbeatAt?: ISODate;
  state: "idle" | "discovering" | "tailoring" | "applying" | "paused" | "blocked" | "offline";
  currentJobId?: string;
  appliedToday: Record<Site, number>;
  sessions: { linkedin: SessionState; indeed: SessionState };
  blockedUntil?: { linkedin?: ISODate; indeed?: ISODate };
  version?: string;
  lastScanAt?: ISODate;
}

/**
 * connections/{siteId} — a job site account the user signed into through the hosted
 * browser (Browserbase Live View). The login lives in a Browserbase Context; we only
 * store its id and status, never passwords.
 */
export interface SiteConnection {
  status: "connected" | "not_connected" | "pending" | "expired";
  contextId?: string;
  connectedAt?: ISODate;
  lastCheckedAt?: ISODate;
  error?: string;
}

/** Collection name → document type. */
export interface Collections {
  settings: Settings;
  profile: Profile;
  facts: Fact;
  jobs: Job;
  resumes: TailoredResume;
  coverLetters: CoverLetter;
  applications: Application;
  questions: Question;
  activity: ActivityEntry;
  workerStatus: WorkerStatus;
  connections: SiteConnection;
}

export type CollectionName = keyof Collections;
export type WithId<T> = T & { id: string };
