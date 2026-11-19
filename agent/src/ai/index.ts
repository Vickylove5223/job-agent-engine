// AI module (Gemini). Implements the AI interface from src/contracts.ts.
// Rule #1 (PLAN.md §1): never fabricate — every output may only use the master resume, facts and profile.
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import type { Job, Resume } from "@shared/types";
import type { AI, FieldAnswer, FieldQuestion, RawJob, ScoreResult } from "../contracts";
import { generateJson } from "./client";
import { answerDeterministic, LEGAL_RE, type FieldInput } from "./fields";
import { norm, numbersIn, resumeToText, unsupportedNumbers, verifyTailoredDeterministic } from "./verify";

export { verifyTailoredDeterministic } from "./verify";
export { answerDeterministic } from "./fields";

const MAX_JOB_CHARS = 8000;

// ---------------- helpers ----------------
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[  -​  　]/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function camelKey(s: string): string {
  const words = s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "other";
  return words[0] + words.slice(1).map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");
}

const factList = (facts: string[]) => (facts.length ? facts.map((f, i) => `F${i + 1}. ${f}`).join("\n") : "(no facts recorded)");

function jobBlock(job: RawJob | Job): string {
  const salary = job.salary ? `${job.salary.min ?? "?"}–${job.salary.max ?? "?"} ${job.salary.currency}` : "not stated";
  return [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}${job.remote ? " (remote)" : ""}`,
    `Salary: ${salary}`,
    `Description:\n${job.description.slice(0, MAX_JOB_CHARS)}`,
  ].join("\n");
}

const skillsArray = z.array(z.object({ category: z.string(), items: z.array(z.string()) }));
function skillsToRecord(arr: z.infer<typeof skillsArray>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const { category, items } of arr) {
    const key = camelKey(category);
    const clean = items.map((s) => s.trim()).filter(Boolean);
    if (!clean.length) continue;
    out[key] = [...new Set([...(out[key] ?? []), ...clean])];
  }
  return out;
}
const opt = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined);

// ---------------- structureResume ----------------
const ResumeLLM = z.object({
  summary: z.string(),
  skills: skillsArray,
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string(),
      start: z.string(),
      end: z.string(),
      type: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({ school: z.string(), degree: z.string(), start: z.string(), end: z.string(), country: z.string(), thesis: z.string() }),
  ),
  certifications: z.array(z.object({ name: z.string(), issued: z.string() })),
  projects: z.array(z.string()),
  awards: z.array(z.string()),
  languages: z.array(z.string()),
  interests: z.array(z.string()),
});

async function structureResume(text: string): Promise<Resume> {
  const prompt = `Convert this resume text into structured JSON. Copy content EXACTLY as written — do not reword,
summarize, correct, translate or add anything. Use "" for unknown strings and [] for missing sections.

Rules:
- summary: the resume's own summary/profile paragraph verbatim ("" if none).
- skills: group skills by category. Use the resume's own headings when present; category names will become
  camelCase keys such as "productDesign", "tools", "research", "frontend", "languages". Items verbatim.
- experience: one entry per role, newest first as in the resume. company, title, location, start, end
  (dates exactly as written, e.g. "Jan 2022", "Present"), type (e.g. "Full-time", "Contract", or ""),
  bullets exactly as written (merge lines that were wrapped mid-sentence by the PDF, remove bullet glyphs).
- education: school, degree, start, end, country, thesis.
- certifications: name and issued date if written.
- projects, awards, languages (spoken languages), interests: verbatim strings.

RESUME TEXT:
"""
${text.slice(0, 30000)}
"""`;
  const r = await generateJson(prompt, ResumeLLM, { temperature: 0 });
  return {
    summary: r.summary.trim(),
    skills: skillsToRecord(r.skills),
    experience: r.experience.map((e) => ({
      company: e.company.trim(),
      title: e.title.trim(),
      location: opt(e.location),
      start: e.start.trim(),
      end: e.end.trim(),
      type: opt(e.type),
      bullets: e.bullets.map((b) => b.replace(/^[•●▪◦\-–*]\s*/, "").trim()).filter(Boolean),
    })),
    education: r.education.map((e) => ({
      school: e.school.trim(),
      degree: e.degree.trim(),
      start: opt(e.start),
      end: opt(e.end),
      country: opt(e.country),
      thesis: opt(e.thesis),
    })),
    certifications: r.certifications.map((c) => ({ name: c.name.trim(), issued: opt(c.issued) })),
    projects: r.projects.map((s) => s.trim()).filter(Boolean),
    awards: r.awards.map((s) => s.trim()).filter(Boolean),
    languages: r.languages.map((s) => s.trim()).filter(Boolean),
    interests: r.interests.map((s) => s.trim()).filter(Boolean),
  };
}

// ---------------- scoreJob ----------------
const ScoreLLM = z.object({
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  gaps: z.array(z.object({ item: z.string(), kind: z.enum(["wording", "missing_fact", "true_gap"]) })),
  questions: z.array(
    z.object({
      text: z.string(),
      whyNeeded: z.string(),
      inputType: z.enum(["text", "yes_no", "number", "choice"]),
      options: z.array(z.string()),
    }),
  ),
});

const LANGUAGES = [
  "Dutch", "German", "French", "Spanish", "Italian", "Portuguese", "Swedish", "Norwegian", "Danish", "Finnish",
  "Polish", "Czech", "Hungarian", "Romanian", "Greek", "Turkish", "Arabic", "Hebrew", "Russian", "Ukrainian",
  "Japanese", "Korean", "Mandarin", "Chinese", "Cantonese", "Hindi", "Vietnamese", "Thai", "Indonesian", "Malay",
];

/** Spoken languages a job explicitly requires (other than English). */
export function requiredLanguages(description: string): string[] {
  const out: string[] = [];
  for (const lang of LANGUAGES) {
    const L = `\\b${lang}\\b`;
    const re = new RegExp(
      `(fluen(t|cy)|native|proficien(t|cy)|business[- ]level|professional[- ]level|working knowledge|excellent|strong|speak)[^.\\n]{0,40}${L}|${L}[^.\\n]{0,40}(required|is a must|mandatory|essential|fluen(t|cy)|native|proficien|speaker|C1|C2|B2)`,
      "i",
    );
    if (re.test(description) && !new RegExp(`${L}[^.\\n]{0,30}(is a plus|nice to have|a bonus|preferred|an advantage)`, "i").test(description)) out.push(lang);
  }
  return out;
}

const NO_SPONSOR_RE =
  /(no|not|unable to|cannot|can't|won't|will not|do not|does not|don't)\s+(offer|provide|support|sponsor)[^.\n]{0,30}(sponsor|visa)|visa sponsorship is not|sponsorship (is )?not (available|offered|provided)|without (the need for )?(visa )?sponsorship|must (already )?(be|have)[^.\n]{0,30}(authori[sz]ed|right to work|work permit)/i;
const NEEDS_SPONSOR_RE = /\b(need|needs|require|requires|will require)\b[^.\n]{0,30}sponsor/i;
const NO_NEED_SPONSOR_RE = /(do not|don't|does not|doesn't|no longer|never)\s+(need|require)[^.\n]{0,30}sponsor/i;

const GENERIC = new Set(
  "do you have are any the a an to of in for with and or your you is what how many much can will would be able willing speak fluent fluency years year experience work working level language professional currently based require required need needs".split(" "),
);
/** True when some fact already covers every distinctive word of the question. */
export function answeredByFacts(question: string, facts: string[]): boolean {
  const words = question.toLowerCase().match(/[a-z][a-z+#.]{2,}/g)?.filter((w) => !GENERIC.has(w)) ?? [];
  if (!words.length) return false;
  return facts.some((f) => {
    const fl = f.toLowerCase();
    return words.every((w) => fl.includes(w));
  });
}

async function scoreJob(input: { resumeText: string; facts: string[]; settings: import("@shared/types").Settings; job: RawJob | Job }): Promise<ScoreResult> {
  const { resumeText, facts, settings, job } = input;
  const prefs = {
    roles: settings.roles,
    seniority: settings.seniority,
    countries: settings.countries,
    locations: settings.locations,
    workModes: settings.workModes,
    jobTypes: settings.jobTypes,
    remoteOnly: settings.remoteOnly,
    minSalary: settings.minSalary ? `${settings.minSalary} ${settings.currency}` : null,
    includeKeywords: settings.includeKeywords,
    excludeKeywords: settings.excludeKeywords,
  };
  const prompt = `You are a strict, calibrated recruiter. Score how well this candidate matches the job (0–100).
Use ONLY the resume and the facts. Never assume a skill, language, location or eligibility the inputs do not state.

RUBRIC (start from role fit, then apply caps/penalties):
- 85–100: same role family and seniority, meets essentially all REQUIRED skills, domain fits, location/work mode OK.
- 70–84: strong fit, 1–2 non-critical required items missing or only implied (wording gaps).
- 50–69: related role or seniority off by one level, several required items missing.
- 30–49: weak fit — different specialization, big seniority mismatch, or a hard requirement likely unmet.
- 0–29: wrong field, or a hard blocker (eligibility, required language, required license/degree) is unmet.
Hard rules:
- Job says no visa sponsorship / must already be authorized AND a fact says the candidate needs sponsorship
  (or is not authorized there) → score ≤ 30 and a reason saying so. If authorization for the job's country is
  unknown and the job requires it → ask (yes_no) unless a fact already answers it.
- Job requires fluency in a language (e.g. "fluent Dutch required") and neither resume nor facts show it →
  big penalty (score ≤ 40) and ask "Do you speak <language>?" unless already answered in the facts.
- Location/work mode incompatible with the candidate's preferences and not remote → penalty.
- Seniority: compare years and scope in the resume to the job level.

gaps: things the job asks for that the resume does not show.
 - "wording": the candidate has it (resume/facts show it) but under different words.
 - "missing_fact": might be true but nothing in the inputs says so — a question could resolve it.
 - "true_gap": the inputs show the candidate does not have it.
questions: ONLY for facts that would change the apply/skip decision AND are not already answered in the
FACTS list or resume (read them carefully — never re-ask something a fact answers, even if worded differently).
Max 3 questions. Use inputType "yes_no" for yes/no, "number" for numbers, "choice" with options when useful,
otherwise "text" (options: [] when not "choice").
reasons: 2–5 short, specific bullet strings (cite concrete skills/requirements).

CANDIDATE PREFERENCES:
${JSON.stringify(prefs)}

FACTS (confirmed by the candidate):
${factList(facts)}

RESUME:
"""
${resumeText.slice(0, 15000)}
"""

JOB:
${jobBlock(job)}`;

  const r = await generateJson(prompt, ScoreLLM, { temperature: 0 });
  let score = Math.round(Math.min(100, Math.max(0, r.score)));
  const reasons = [...r.reasons];
  const gaps = [...r.gaps];
  let questions = r.questions.map((q) => ({
    text: q.text,
    whyNeeded: q.whyNeeded,
    inputType: q.inputType,
    ...(q.inputType === "choice" && q.options.length ? { options: q.options } : {}),
  }));

  // Deterministic guards on top of the model.
  const known = [resumeText, ...facts].join("\n");
  const factText = facts.join("\n");
  if (NO_SPONSOR_RE.test(job.description) && NEEDS_SPONSOR_RE.test(factText) && !NO_NEED_SPONSOR_RE.test(factText)) {
    if (score > 30) score = 30;
    if (!reasons.some((x) => /sponsor/i.test(x))) reasons.unshift("Job does not offer visa sponsorship and you need sponsorship");
  }
  for (const lang of requiredLanguages(job.description)) {
    if (new RegExp(`\\b${lang}\\b`, "i").test(known)) continue;
    if (score > 40) score = 40;
    if (!reasons.some((x) => x.toLowerCase().includes(lang.toLowerCase()))) reasons.push(`Job requires ${lang}; your resume/facts don't show it`);
    if (!gaps.some((g) => g.item.toLowerCase().includes(lang.toLowerCase()))) gaps.push({ item: `${lang} language`, kind: "missing_fact" });
    if (!questions.some((q) => q.text.toLowerCase().includes(lang.toLowerCase())))
      questions.push({ text: `Do you speak ${lang}?`, whyNeeded: `${job.company} requires ${lang} for this role.`, inputType: "yes_no" });
  }
  // Never re-ask what a fact already answers.
  questions = questions.filter((q) => !answeredByFacts(q.text, facts));
  const seen = new Set<string>();
  questions = questions.filter((q) => {
    const k = norm(q.text);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { score, reasons, gaps, questions };
}

// ---------------- tailorResume ----------------
const TailorLLM = z.object({
  summary: z.string(),
  skills: skillsArray,
  experience: z.array(z.object({ index: z.number().int(), bullets: z.array(z.string()) })),
  changes: z.array(z.string()),
});
const ClaimCheckLLM = z.object({ unsupported: z.array(z.object({ claim: z.string(), reason: z.string() })) });

function tailoredText(r: Resume): string {
  return [
    `SUMMARY: ${r.summary}`,
    `SKILLS: ${Object.entries(r.skills).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ")}`,
    ...r.experience.map((e, i) => `ROLE ${i} (${e.title} at ${e.company}):\n${e.bullets.map((b) => `- ${b}`).join("\n")}`),
  ].join("\n");
}

async function claimCheck(master: Resume, tailored: Resume, facts: string[]): Promise<string[]> {
  const prompt = `You are a fact-checker. Compare a TAILORED resume against the candidate's MASTER resume and FACTS.
List every claim in the tailored text that is NOT supported by the master resume or facts: a new skill, tool,
employer, responsibility, metric, number, certification, degree, language, seniority claim, or an
exaggeration (e.g. "led" when the master says "assisted", "expert" when not stated). Rewording, reordering,
shortening and combining of supported information is fine — do not list those. Return [] if all is supported.

MASTER RESUME:
"""
${resumeToText(master).slice(0, 15000)}
"""

FACTS:
${factList(facts)}

TAILORED (check this):
"""
${tailoredText(tailored)}
"""`;
  const r = await generateJson(prompt, ClaimCheckLLM, { temperature: 0 });
  return r.unsupported.map((u) => `Unsupported claim: "${u.claim}" — ${u.reason}`);
}

async function tailorOnce(master: Resume, facts: string[], job: Job, feedback: string[]): Promise<{ resume: Resume; changes: string[] }> {
  const prompt = `Tailor this candidate's resume to the job below. Hard rules — breaking any of them is a failure:
- Use ONLY information present in the MASTER resume and FACTS. Never add a skill, tool, employer, metric,
  number, certification, degree, language, or responsibility that isn't in the inputs. Never inflate scope.
- You may: rewrite the summary (2–4 sentences, first person implied, no "I"), reorder and reword bullets to
  foreground what this job values, mirror the job's terminology ONLY where the master/facts show the same thing,
  reorder skill categories and items, drop irrelevant skills or bullets (keep at least 2 bullets per role).
- Every number in your output must appear in the master resume or facts exactly.
- Companies, titles, dates and education are fixed and are not part of your output.
- experience: one item per master role, using its "index" from the list below, with the new bullets.
- skills: use only skills that appear in the master skills or facts, verbatim.
- changes: 3–6 short human-readable bullets describing what you changed (e.g. "Moved design-systems work to the top").

JOB:
${jobBlock(job)}

FACTS:
${factList(facts)}

MASTER RESUME (JSON; experience indexes shown):
${JSON.stringify({
  summary: master.summary,
  skills: master.skills,
  experience: master.experience.map((e, index) => ({ index, company: e.company, title: e.title, start: e.start, end: e.end, bullets: e.bullets })),
  education: master.education,
  certifications: master.certifications,
  projects: master.projects,
  languages: master.languages,
})}${feedback.length ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED FOR THESE VIOLATIONS — fix all of them:\n${feedback.map((f) => `- ${f}`).join("\n")}` : ""}`;

  const r = await generateJson(prompt, TailorLLM, { temperature: 0.3 });
  const byIndex = new Map(r.experience.map((e) => [e.index, e.bullets.map((b) => b.trim()).filter(Boolean)]));
  const resume: Resume = {
    ...master,
    summary: r.summary.trim() || master.summary,
    skills: Object.keys(skillsToRecord(r.skills)).length ? skillsToRecord(r.skills) : master.skills,
    experience: master.experience.map((e, i) => {
      const b = byIndex.get(i);
      return { ...e, bullets: b && b.length ? b : e.bullets };
    }),
    // fixed sections copied verbatim from master
    education: master.education,
    certifications: master.certifications,
    projects: master.projects,
    awards: master.awards,
    languages: master.languages,
    interests: master.interests,
  };
  return { resume, changes: r.changes.map((c) => c.trim()).filter(Boolean) };
}

async function tailorResume(input: { master: Resume; facts: string[]; job: Job }): Promise<{ resume: Resume; changes: string[] }> {
  const { master, facts, job } = input;
  let feedback: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await tailorOnce(master, facts, job, feedback);
      const violations = verifyTailoredDeterministic(master, out.resume, facts);
      if (!violations.length) violations.push(...(await claimCheck(master, out.resume, facts)));
      if (!violations.length) return out;
      feedback = violations;
    } catch (err) {
      feedback = [`Previous attempt errored: ${(err as Error).message}`];
    }
  }
  return { resume: master, changes: ["Kept master resume (tailoring failed verification)"] };
}

// ---------------- writeCoverLetter ----------------
const CoverLLM = z.object({ text: z.string() });
const CLICHES = [
  "i am writing to express", "i am excited to apply", "passionate about", "team player", "hit the ground running",
  "perfect fit", "dream job", "think outside the box", "go-getter", "synergy", "detail-oriented", "results-driven",
  "to whom it may concern", "i believe i would be a great", "thrilled to apply",
];
export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function coverLetterIssues(text: string, sources: string[], fullName: string): string[] {
  const issues: string[] = [];
  const wc = wordCount(text);
  if (wc > 250) issues.push(`Too long: ${wc} words (max 250)`);
  if (/\[[^\]]*\]|\{[^}]*\}|<[^>]+>|\bXXX\b|lorem ipsum/i.test(text)) issues.push("Contains a placeholder like [Company] — use real values or omit");
  const low = text.toLowerCase();
  for (const c of CLICHES) if (low.includes(c)) issues.push(`Cliché: "${c}"`);
  for (const n of unsupportedNumbers(text, sources)) issues.push(`Number ${n} is not in the resume, facts or job post`);
  if (!text.trim().split("\n").slice(-3).join(" ").includes(fullName)) issues.push(`Must be signed with "${fullName}"`);
  return issues;
}

async function writeCoverLetter(input: { profile: import("@shared/types").Profile; resumeText: string; facts: string[]; job: Job; tone: string }): Promise<string> {
  const { profile, resumeText, facts, job, tone } = input;
  const base = `Write a cover letter for ${profile.fullName} applying to "${job.title}" at ${job.company}.
Rules:
- At most 230 words, first person, tone: ${tone}. Plain text, short paragraphs, no subject line, no address block.
- Open with "Dear ${job.company} team," (or a named hiring manager only if the job post names one).
- Specific to this company and role: connect 2–3 concrete things from the job post to concrete experience
  from the resume/facts.
- Use ONLY facts from the resume and facts list. Never invent employers, metrics, numbers, skills, tools or
  motivations about the company that the job post doesn't support.
- No clichés ("I am writing to express", "passionate", "team player", "perfect fit", "hit the ground running").
- No placeholders like [Company] or [Hiring Manager].
- End with a short closing line, then "Best regards," and "${profile.fullName}" on its own final line.

JOB:
${jobBlock(job)}

FACTS:
${factList(facts)}

RESUME:
"""
${resumeText.slice(0, 12000)}
"""`;
  const sources = [resumeText, ...facts, job.description, job.title, job.company];
  let prompt = base;
  let text = "";
  let issues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await generateJson(prompt, CoverLLM, { temperature: 0.5 });
    text = normalizeWhitespace(r.text);
    if (!text.split("\n").slice(-3).join(" ").includes(profile.fullName)) text = `${text}\n\nBest regards,\n${profile.fullName}`;
    issues = coverLetterIssues(text, sources, profile.fullName);
    if (!issues.length) return text;
    prompt = `${base}\n\nYOUR PREVIOUS DRAFT WAS REJECTED:\n${issues.map((i) => `- ${i}`).join("\n")}\nPrevious draft:\n${text}`;
  }
  throw new Error(`Cover letter failed checks: ${issues.join("; ")}`);
}

// ---------------- answerField ----------------
const AnswerLLM = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  basis: z.array(z.string()),
});

/** Map a model answer onto the exact option text; undefined if it is not one of the options. */
function matchOption(answer: string, options: string[]): string | undefined {
  const a = norm(answer);
  return options.find((o) => norm(o) === a) ?? options.find((o) => norm(o).startsWith(a) && a.length > 1) ?? options.find((o) => a.includes(norm(o)) && norm(o).length > 2);
}

async function answerField(input: FieldInput): Promise<FieldAnswer> {
  const det = answerDeterministic(input);
  if (det) return det;

  const { field, profile, facts, job } = input;
  const choice = (field.type === "select" || field.type === "radio") && !!field.options?.length;
  const std = Object.entries(profile.standardAnswers ?? {}).filter(([, v]) => v);
  const prompt = `Answer one field of a job application form for the candidate, truthfully.
Rules:
- Use ONLY the profile, standard answers, facts and resume below. Never invent experience, credentials,
  numbers or eligibility.
- Legal / eligibility / certification / license / degree / language / background-check questions: answer
  "Yes" ONLY if a fact or the resume explicitly supports it; otherwise give your best truthful answer with
  confidence ≤ 0.5 so the candidate is asked.
- confidence: 0.9–1 only when a fact/profile entry states the answer directly; 0.8–0.89 when it follows
  clearly from the inputs; < 0.8 whenever it is inferred, partially supported, or unknown.
- ${choice ? `Return EXACTLY one of these options (verbatim): ${JSON.stringify(field.options)}` : field.type === "checkbox" && field.options?.length ? `Return one or more of these options verbatim, separated by "; ": ${JSON.stringify(field.options)}` : field.type === "number" ? "Return a plain number." : field.type === "date" ? "Return a date as YYYY-MM-DD." : field.type === "textarea" ? "Write 2–5 sentences, first person, specific to the job, using only real facts." : "Keep it short."}
- basis: list each source you used, quoting it exactly as "fact: <fact text>", "standard: <key>", "profile: <field>",
  or "resume: <short quote>". Empty if nothing supports the answer.
- If the inputs give no answer, return answer "" with confidence 0.

FIELD: ${JSON.stringify({ label: field.label, type: field.type, required: field.required, options: field.options })}

JOB: ${job.title} at ${job.company} (${job.location}${job.remote ? ", remote" : ""})

PROFILE: ${JSON.stringify({ fullName: profile.fullName, location: profile.location, country: profile.country, headline: profile.headline, links: profile.links })}
STANDARD ANSWERS: ${std.length ? JSON.stringify(Object.fromEntries(std)) : "(none)"}

FACTS:
${factList(facts)}

RESUME:
"""
${(profile.masterResume?.text ?? (profile.masterResume?.structured ? resumeToText(profile.masterResume.structured) : "")).slice(0, 8000)}
"""`;

  const r = await generateJson(prompt, AnswerLLM, { temperature: 0 });
  let answer = r.answer.trim();
  let confidence = Math.min(1, Math.max(0, r.confidence));

  // Keep only basis entries that really exist in the inputs.
  const resumeTxt = norm(profile.masterResume?.text ?? (profile.masterResume?.structured ? resumeToText(profile.masterResume.structured) : ""));
  const normFacts = facts.map(norm);
  const basis = r.basis.filter((b) => {
    const m = b.match(/^\s*(fact|standard|profile|resume)\s*:\s*(.+)$/i);
    if (!m) return false;
    const kind = m[1]!.toLowerCase();
    const val = norm(m[2]);
    if (kind === "fact") return normFacts.some((f) => f.includes(val) || val.includes(f));
    if (kind === "resume") return val.length > 0 && resumeTxt.includes(val.slice(0, 60));
    return true;
  });

  if (choice) {
    const o = matchOption(answer, field.options!);
    if (o) answer = o;
    else {
      answer = "";
      confidence = Math.min(confidence, 0.3);
    }
  } else if (field.type === "checkbox" && field.options?.length && answer) {
    const parts = answer.split(/\s*[;\n]\s*/).filter(Boolean).map((p) => matchOption(p, field.options!));
    if (parts.some((p) => !p)) confidence = Math.min(confidence, 0.4);
    answer = parts.filter((p): p is string => !!p).join("; ");
  } else if (field.type === "number" && answer && !/^-?\d+(\.\d+)?$/.test(answer.replace(/,/g, ""))) {
    const n = answer.match(/-?\d[\d,]*(\.\d+)?/)?.[0];
    if (n) answer = n.replace(/,/g, "");
    else confidence = Math.min(confidence, 0.3);
  }

  if (!basis.length) confidence = Math.min(confidence, 0.6);
  const hardBasis = basis.some((b) => /^\s*(fact|standard|resume)\s*:/i.test(b));
  if (LEGAL_RE.test(field.label) && /^(yes|y|true|i (am|do|have|can))\b/i.test(answer) && !hardBasis) confidence = Math.min(confidence, 0.5);
  if (!answer) confidence = Math.min(confidence, field.required ? 0.2 : 0.5);
  // Any number in a free-text answer must come from the inputs.
  if (field.type === "text" || field.type === "textarea") {
    const src = [resumeTxt, ...facts, ...std.map(([, v]) => String(v)), job.description];
    if (numbersIn(answer).length && unsupportedNumbers(answer, src).length) confidence = Math.min(confidence, 0.5);
  }
  return { answer, confidence: Math.round(confidence * 100) / 100, basis };
}

// ---------------- PDF ----------------
async function resumeTextFromPdf(pdfBase64: string): Promise<string> {
  const b64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return normalizeWhitespace(Array.isArray(text) ? text.join("\n\n") : text);
}

// ---------------- suggestAnswer ----------------
/**
 * Drafts an answer to a question the agent asked the user, so they only have to edit it.
 * Uses ONLY the resume + facts. Anything not supported becomes a clearly marked [placeholder]
 * the user must fill in — never an invented claim.
 */
async function suggestAnswer(input: { question: string; whyNeeded?: string; resumeText: string; facts: string[]; job?: { title: string; company: string } }): Promise<string> {
  const out = await generateJson(
    [
      "Draft a short first-person answer (1–3 sentences) the candidate can edit before saving.",
      "Use ONLY information from the RESUME and FACTS below. Prefer concrete names of projects, employers and tools that appear there.",
      "If the resume/facts do not clearly support an answer, do NOT guess: write the most likely helpful structure with [square-bracket placeholders] for the parts the candidate must confirm, e.g. \"[Yes/No] — I have [N] years of …\".",
      "Never invent employers, numbers, degrees, certifications, languages or skills.",
      `QUESTION: ${input.question}`,
      input.whyNeeded ? `WHY THE AGENT ASKS: ${input.whyNeeded}` : "",
      input.job ? `FOR JOB: ${input.job.title} at ${input.job.company}` : "",
      `FACTS:\n- ${input.facts.join("\n- ") || "(none)"}`,
      `RESUME:\n${input.resumeText.slice(0, 9000)}`,
    ].filter(Boolean).join("\n\n"),
    z.object({ answer: z.string() }),
    { temperature: 0.3 },
  );
  return out.answer.trim();
}

export const ai: AI = {
  resumeTextFromPdf,
  structureResume,
  scoreJob,
  tailorResume,
  writeCoverLetter,
  suggestAnswer,
  answerField: (input: { field: FieldQuestion; profile: import("@shared/types").Profile; facts: string[]; job: Job }) => answerField(input),
};

export default ai;
