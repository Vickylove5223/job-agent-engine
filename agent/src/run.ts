// One agent cycle for every onboarded user: scan → score → tailor → apply.
// Runs on GitHub Actions every 30 min (`npm run cycle`). All browsers are hosted (Browserbase).
//
// Env:
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON (or FIRESTORE_EMULATOR_HOST + FIREBASE_PROJECT_ID for local tests)
//   BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, MODEL_API_KEY  (see .env.example)
//   DRY_RUN=true              fill forms but never submit (default true until you flip it)
//   MAX_APPLY_PER_RUN=2       browser budget per user per cycle (Browserbase free ≈ 60 min/month)
//   MAX_SCORE_PER_RUN=15      Gemini calls budget per user per cycle
//   ONLY_UID=<uid>            restrict to one user
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Fact, Job, Profile, Settings, WithId } from "@shared/types";
import { canTransition } from "@shared/status";
import { nowIso, onboardedUserIds, userDb, type UserDb } from "./db";
import type { RawJob, ScoreResult } from "./contracts";
import { scanAll } from "./sources/index";
import { ai } from "./ai/index";
import { applyTo } from "./apply/index";
import { renderCoverLetterPdf, renderResumePdf } from "./pdf";

const DRY_RUN = (process.env.DRY_RUN ?? "true") !== "false";
const MAX_APPLY = Number(process.env.MAX_APPLY_PER_RUN ?? 2);
const MAX_SCORE = Number(process.env.MAX_SCORE_PER_RUN ?? 15);
const SCAN_EVERY_MIN = Number(process.env.SCAN_EVERY_MIN ?? 25);

const jobIdFor = (r: RawJob) => createHash("sha1").update(`${r.source}:${r.externalId}`).digest("hex").slice(0, 20);
const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
const siteOf = (j: Job): "linkedin" | "indeed" | "ats" => (j.applyMethod === "linkedin_easy" ? "linkedin" : j.applyMethod === "indeed" ? "indeed" : "ats");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

async function setStatus(db: UserDb, job: WithId<Job>, to: Job["status"], patch: Partial<Job> = {}) {
  if (job.status !== to && !canTransition(job.status, to)) {
    console.warn(`  ! skip invalid transition ${job.status} → ${to} for ${job.id}`);
    return;
  }
  await db.update("jobs", job.id, { ...patch, status: to, updatedAt: nowIso() });
  job.status = to;
}

/** Create or merge open questions; returns their ids. */
async function upsertQuestions(db: UserDb, qs: ScoreResult["questions"], jobId: string, origin: "scoring" | "form") {
  const open = await db.list("questions", ["status", "==", "open"]);
  const ids: string[] = [];
  for (const q of qs) {
    const hit = open.find((o) => norm(o.text) === norm(q.text));
    if (hit) {
      if (!hit.jobIds.includes(jobId)) await db.update("questions", hit.id, { jobIds: [...hit.jobIds, jobId] });
      ids.push(hit.id);
    } else {
      ids.push(await db.add("questions", { text: q.text, whyNeeded: q.whyNeeded, origin, jobIds: [jobId], inputType: q.inputType ?? "text", options: q.options, status: "open", saveAsFact: true, createdAt: nowIso() }));
    }
  }
  return ids;
}

async function ensureResume(db: UserDb, profile: WithId<Profile>) {
  const mr = profile.masterResume;
  if (!mr?.pdfBase64) return null;
  if (!mr.text) {
    console.log("  reading resume…");
    const text = await ai.resumeTextFromPdf(mr.pdfBase64);
    const structured = mr.structured ?? (await ai.structureResume(text));
    await db.update("profile", "main", { masterResume: { ...mr, text, structured } });
    mr.text = text;
    mr.structured = structured;
    await db.log("success", "resume", "Read your resume");
  } else if (!mr.structured) {
    mr.structured = await ai.structureResume(mr.text);
    await db.update("profile", "main", { masterResume: { ...mr } });
  }
  return mr;
}

function decide(score: number, s: Settings): Job["status"] {
  if (score >= s.thresholds.apply) return "ready";
  if (score >= s.thresholds.tailor) return "needs_tailoring";
  return "skipped";
}

async function runUser(uid: string) {
  const db = userDb(uid);
  const settings = await db.get("settings", "main");
  const profile = await db.get("profile", "main");
  if (!settings?.onboardedAt || !profile) return;
  console.log(`\n=== user ${uid.slice(0, 6)}… (${profile.fullName}) ===`);
  await db.update("workerStatus", "main", { heartbeatAt: nowIso(), state: "discovering", version: "agent-0.1" });

  const resume = await ensureResume(db, profile);
  if (!resume?.text) {
    await db.log("warn", "resume", "Upload your resume in Profile & Resume so the agent can score and apply.");
    await db.update("workerStatus", "main", { state: "idle", heartbeatAt: nowIso() });
    return;
  }
  const facts = (await db.list("facts")).map((f: WithId<Fact>) => f.text);

  // 1) Re-queue jobs whose questions were all answered.
  const waiting = await db.list("jobs", ["status", "==", "waiting_input"]);
  if (waiting.length) {
    const openQ = await db.list("questions", ["status", "==", "open"]);
    for (const j of waiting) if (!openQ.some((q) => q.jobIds.includes(j.id))) await setStatus(db, j, "new");
  }

  // 2) Scan (throttled).
  const ws = await db.get("workerStatus", "main");
  const lastScan = ws?.lastScanAt;
  if (!lastScan || Date.now() - new Date(lastScan).getTime() > SCAN_EVERY_MIN * 60_000) {
    const res = await scanAll(settings, { limitPerSource: 60 });
    let added = 0;
    for (const r of res.jobs) {
      const id = jobIdFor(r);
      if (await db.exists("jobs", id)) continue;
      await db.set("jobs", id, { ...r, source: r.source as Job["source"], foundAt: nowIso(), status: "new", attempts: 0, updatedAt: nowIso() });
      added++;
    }
    await db.update("workerStatus", "main", { lastScanAt: nowIso() });
    const errs = res.errors.length ? ` (${res.errors.length} source errors)` : "";
    await db.log("info", "scan", `Scanned ${Object.keys(res.counts).length} sources: ${res.jobs.length} matching, ${added} new${errs}`);
    console.log(`  scan: ${res.jobs.length} matching, ${added} new, errors: ${res.errors.map((e) => e.source).join(",") || "none"}`);
  }

  // 3) Score new jobs.
  const fresh = (await db.list("jobs", ["status", "==", "new"])).slice(0, MAX_SCORE);
  for (const j of fresh) {
    try {
      const s = await ai.scoreJob({ resumeText: resume.text, facts, settings, job: j });
      const patch: Partial<Job> = { score: { master: s.score, reasons: s.reasons }, gaps: s.gaps };
      if (s.questions.length && s.score >= settings.thresholds.tailor) {
        const qids = await upsertQuestions(db, s.questions, j.id, "scoring");
        await setStatus(db, j, "waiting_input", { ...patch, questionIds: qids });
        await db.log("warn", "question", `Needs your input for ${j.title} at ${j.company}`, j.id);
      } else {
        await setStatus(db, j, decide(s.score, settings), { ...patch, skipReason: s.score < settings.thresholds.tailor ? `Match score ${s.score} is below ${settings.thresholds.tailor}` : undefined });
      }
      console.log(`  scored ${s.score} ${j.title} @ ${j.company} → ${j.status}`);
    } catch (e) {
      console.warn(`  score failed for ${j.id}: ${(e as Error).message}`);
      break; // likely rate limit; try next cycle
    }
  }

  // 4) Tailor.
  for (const j of (await db.list("jobs", ["status", "==", "needs_tailoring"])).slice(0, 3)) {
    if (!resume.structured) break;
    const t = await ai.tailorResume({ master: resume.structured, facts, job: j });
    const rescored = await ai.scoreJob({ resumeText: JSON.stringify(t.resume), facts, settings, job: j });
    await db.set("resumes", j.id, { structured: t.resume, changes: t.changes, score: rescored.score, createdAt: nowIso() });
    await setStatus(db, j, rescored.score >= settings.thresholds.apply ? "ready" : "skipped", {
      score: { master: j.score?.master ?? 0, tailored: rescored.score, reasons: j.score?.reasons ?? [] },
      skipReason: rescored.score >= settings.thresholds.apply ? undefined : `Still ${rescored.score} after tailoring`,
    });
    await db.log("info", "tailor", `Tailored resume for ${j.title} at ${j.company} (${j.score?.master} → ${rescored.score})`, j.id);
  }

  // 5) Apply.
  if (settings.paused) {
    await db.update("workerStatus", "main", { state: "paused", heartbeatAt: nowIso() });
    return;
  }
  const apps = await db.list("applications");
  const today = { linkedin: 0, indeed: 0, ats: 0 };
  for (const a of apps) if (isToday(a.submittedAt)) today[a.site]++;
  const ready = (await db.list("jobs", ["status", "==", "ready"]))
    .sort((a, b) => (b.score?.tailored ?? b.score?.master ?? 0) - (a.score?.tailored ?? a.score?.master ?? 0));
  const conn = await db.list("connections");
  const contextId = conn.find((c) => c.contextId)?.contextId;
  let attempts = 0;
  for (const j of ready) {
    if (attempts >= MAX_APPLY) break;
    const site = siteOf(j);
    if (today[site] >= settings.dailyCaps[site]) continue;
    if ((site === "linkedin" || site === "indeed") && !conn.find((c) => c.id === site && c.status === "connected")) continue;
    attempts++;
    await setStatus(db, j, "applying", { attempts: (j.attempts ?? 0) + 1 });
    await db.update("workerStatus", "main", { state: "applying", currentJobId: j.id, heartbeatAt: nowIso() });

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ja-"));
    const tailored = await db.get("resumes", j.id);
    const resumePath = path.join(tmp, `${profile.fullName.replace(/\s+/g, "_")}_Resume.pdf`);
    fs.writeFileSync(resumePath, tailored ? await renderResumePdf(tailored.structured, profile) : Buffer.from(resume.pdfBase64!, "base64"));
    let coverLetter: { text: string; pdfPath?: string } | undefined;
    if (settings.coverLetter.mode === "always" || /cover letter/i.test(j.description)) {
      try {
        const text = await ai.writeCoverLetter({ profile, resumeText: resume.text, facts, job: j, tone: settings.coverLetter.tone });
        const pdfPath = path.join(tmp, "Cover_Letter.pdf");
        fs.writeFileSync(pdfPath, await renderCoverLetterPdf(text, profile));
        coverLetter = { text, pdfPath };
        await db.set("coverLetters", j.id, { text, createdAt: nowIso() });
      } catch (e) {
        await db.log("warn", "cover_letter", `Skipped cover letter for ${j.company}: ${(e as Error).message}`, j.id);
      }
    }

    const res = await applyTo({
      job: j, profile, facts: await db.list("facts"), resumePdfPath: resumePath, coverLetter, contextId, dryRun: DRY_RUN,
      answer: (field) => ai.answerField({ field, profile, facts, job: j }),
    });
    fs.rmSync(tmp, { recursive: true, force: true });
    const shot = res.screenshot?.toString("base64");

    if (res.status === "applied" || res.status === "dry_run_ok") {
      if (res.status === "applied") {
        await db.set("applications", j.id, { submittedAt: nowIso(), site, resumeUsed: tailored ? "tailored" : "master", coverLetterUsed: !!coverLetter, answers: res.answers.map((a) => ({ question: a.question, answer: a.answer, factIds: [] })), screenshotJpegBase64: shot, outcome: "submitted" });
        await setStatus(db, j, "applied");
        await db.log("success", "applied", `Applied to ${j.title} at ${j.company}`, j.id);
        today[site]++;
      } else {
        await setStatus(db, j, "ready", { error: "" });
        await db.log("info", "dry_run", `Dry run OK for ${j.title} at ${j.company} — form filled, not submitted (DRY_RUN is on)`, j.id);
      }
    } else if (res.status === "waiting_input") {
      const qids = await upsertQuestions(db, (res.questions ?? []).map((q) => ({ ...q, inputType: "text" as const })), j.id, "form");
      await setStatus(db, j, "waiting_input", { questionIds: qids });
      await db.log("warn", "question", `Paused ${j.title} at ${j.company}: the form asks something only you can answer`, j.id);
    } else if (res.status === "blocked") {
      await setStatus(db, j, "blocked", { error: res.error });
      await db.log("error", "blocked", `Blocked on ${j.company}: ${res.error}`, j.id);
    } else {
      await setStatus(db, j, j.attempts >= 3 || res.status === "unsupported" ? "failed" : "ready", { error: res.error });
      await db.log("error", "failed", `Could not apply to ${j.title} at ${j.company}: ${res.error}`, j.id);
    }
    console.log(`  apply ${j.title} @ ${j.company}: ${res.status} ${res.error ?? ""} (${res.browserSeconds ?? "?"}s browser)`);
  }
  await db.update("workerStatus", "main", { state: "idle", currentJobId: "", heartbeatAt: nowIso(), appliedToday: today });
}

const only = process.env.ONLY_UID;
const uids = only ? [only] : await onboardedUserIds();
console.log(`Agent cycle — ${uids.length} user(s), DRY_RUN=${DRY_RUN}, MAX_APPLY_PER_RUN=${MAX_APPLY}`);
for (const uid of uids) {
  try {
    await runUser(uid);
  } catch (e) {
    console.error(`user ${uid} failed:`, e);
    await userDb(uid).log("error", "agent", `Agent cycle failed: ${(e as Error).message}`).catch(() => {});
  }
}
process.exit(0);
