// Interfaces shared by the scanner, AI and applier modules. Agents code against these.
import type { ApplyMethod, Fact, Job, Profile, Settings, Gap, Resume } from "@shared/types";

// ---------------- Scanner ----------------
/** A job as returned by a source, before scoring. */
export interface RawJob {
  source: string; // site id from shared/src/sites.ts (e.g. "greenhouse", "remotive")
  externalId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string; // public posting
  applyUrl: string; // where the application form is
  applyMethod: ApplyMethod;
  description: string; // plain text, trimmed to ~8k chars
  postedAt?: string; // ISO
  salary?: { min?: number; max?: number; currency: string };
}

export interface SourceContext {
  settings: Settings;
  /** max jobs to return per source per run */
  limit: number;
}

export interface JobSource {
  /** must match a JOB_SITES id */
  id: string;
  /** API-based sources only (no browser minutes). */
  fetch(ctx: SourceContext): Promise<RawJob[]>;
}

// ---------------- AI ----------------
export interface ScoreResult {
  score: number; // 0–100
  reasons: string[];
  gaps: Gap[];
  /** facts the AI needs from the user to decide or apply; become dashboard Questions */
  questions: { text: string; whyNeeded: string; inputType: "text" | "yes_no" | "number" | "choice"; options?: string[] }[];
}

export interface FieldQuestion {
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "number" | "date" | "email" | "tel" | "url" | "file";
  options?: string[];
  required: boolean;
}

export interface FieldAnswer {
  answer: string;
  /** 0–1. Below 0.8 the applier must stop and ask the user instead of submitting. */
  confidence: number;
  /** which facts the answer came from (for the audit trail) */
  basis: string[];
}

export interface AI {
  resumeTextFromPdf(pdfBase64: string): Promise<string>;
  structureResume(text: string): Promise<Resume>;
  scoreJob(input: { resumeText: string; facts: string[]; settings: Settings; job: RawJob | Job }): Promise<ScoreResult>;
  tailorResume(input: { master: Resume; facts: string[]; job: Job }): Promise<{ resume: Resume; changes: string[] }>;
  writeCoverLetter(input: { profile: Profile; resumeText: string; facts: string[]; job: Job; tone: string }): Promise<string>;
  answerField(input: { field: FieldQuestion; profile: Profile; facts: string[]; job: Job }): Promise<FieldAnswer>;
  /** Draft answer for a dashboard question, for the user to edit (placeholders where unsure). */
  suggestAnswer(input: { question: string; whyNeeded?: string; resumeText: string; facts: string[]; job?: { title: string; company: string } }): Promise<string>;
}

// ---------------- Applier ----------------
export interface ApplyInput {
  job: Job & { id: string };
  profile: Profile;
  facts: Fact[];
  /** absolute path of the PDF to upload */
  resumePdfPath: string;
  coverLetter?: { text: string; pdfPath?: string };
  /** Browserbase context holding the user's logins (LinkedIn, Indeed…) */
  contextId?: string;
  answer: (field: FieldQuestion) => Promise<FieldAnswer>;
  /** fill everything, screenshot, but never click the final submit */
  dryRun: boolean;
}

export interface ApplyResult {
  status: "applied" | "dry_run_ok" | "waiting_input" | "blocked" | "failed" | "unsupported";
  answers: { question: string; answer: string; basis: string[] }[];
  /** JPEG, compressed, < 300 KB */
  screenshot?: Buffer;
  /** questions the user must answer before this job can be retried */
  questions?: { text: string; whyNeeded: string }[];
  error?: string;
  /** browser seconds used (for the free-plan budget) */
  browserSeconds?: number;
}

export interface Applier {
  /** which ApplyMethods this applier handles */
  methods: ApplyMethod[];
  apply(input: ApplyInput): Promise<ApplyResult>;
}
