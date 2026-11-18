// Dev-only local database used until Firebase is connected.
// Persists to ../data/db.local.json (gitignored). Seeded from ../data/profile.local.json.
// Never bundled into the production build — it only runs inside the Vite dev server.
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

type Db = Record<string, Record<string, Record<string, unknown>>>;

const now = () => new Date().toISOString();
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

function buildSeed(dataDir: string): Db {
  const db: Db = {
    settings: {}, profile: {}, facts: {}, jobs: {}, resumes: {}, coverLetters: {},
    applications: {}, questions: {}, activity: {}, workerStatus: {},
  };

  db.settings.main = {
    paused: true,
    roles: [], includeKeywords: [], excludeKeywords: [], locations: [],
    remoteOnly: true, minSalary: null, currency: "USD", seniority: ["mid", "senior"],
    blockedCompanies: [],
    thresholds: { apply: 80, tailor: 60 },
    dailyCaps: { linkedin: 15, indeed: 15, ats: 30 },
    pacingMinutes: { min: 4, max: 15 },
    countries: ["NG"], workModes: ["remote", "hybrid"], jobTypes: ["full_time", "contract"],
    enabledSites: ["linkedin", "indeed", "greenhouse", "lever", "ashby", "workable", "remoteok", "weworkremotely", "remotive", "dribbble", "jobberman", "myjobmag"],
    onboardedAt: now(),
    targetCompanies: [],
    coverLetter: { mode: "when_required", tone: "professional" },
  };

  db.workerStatus.main = {
    state: "offline",
    appliedToday: { linkedin: 0, indeed: 0, ats: 0 },
    sessions: { linkedin: "unknown", indeed: "unknown" },
  };

  const profilePath = path.join(dataDir, "profile.local.json");
  if (fs.existsSync(profilePath)) {
    const p = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    const r = p.resume ?? {};
    db.profile.main = {
      ...p.profile,
      standardAnswers: {},
      masterResume: {
        fileName: path.basename(p.sources?.resumePdf ?? "resume.pdf"),
        uploadedAt: now(),
        structured: {
          summary: r.summary ?? "",
          skills: r.skills ?? {},
          experience: r.experience ?? [],
          education: r.education ?? [],
          certifications: r.certifications ?? [],
          projects: [...(r.sideProjects ?? []), ...(r.contractProjects ?? [])],
          awards: r.awards ?? [],
          languages: r.languages ?? [],
          interests: r.interests ?? [],
        },
      },
    };
    let i = 0;
    for (const exp of r.experience ?? []) {
      for (const b of exp.bullets ?? []) {
        db.facts[`f-resume-${++i}`] = {
          text: `${exp.title} at ${exp.company}: ${b}`,
          category: "experience", source: "resume", createdAt: now(), updatedAt: now(),
        };
      }
    }
    for (const f of p.portfolioFacts ?? []) {
      db.facts[`f-portfolio-${++i}`] = { text: f, category: "experience", source: "portfolio", createdAt: now(), updatedAt: now() };
    }
    for (const q of p.openQuestions ?? []) {
      db.questions[q.id] = {
        text: q.text, whyNeeded: "Needed to set up your search and answer application forms accurately.",
        origin: "profile", jobIds: [], inputType: q.inputType ?? "text",
        options: q.id === "q-seniority" ? ["Junior", "Mid", "Senior", "Lead"] : q.id === "q-eeo" ? ["Answer them", "Always 'Prefer not to say'"] : undefined,
        multiple: q.id === "q-seniority" ? true : undefined,
        status: "open", saveAsFact: true, createdAt: now(),
      };
    }
  }

  // Clearly-marked sample jobs so every page has something to render. Removable from Settings.
  const samples: Array<[string, string, string, string, number, string, string]> = [
    ["Senior Product Designer", "Northwind Fintech", "greenhouse", "ready", 88, "Remote", "applied"],
    ["Product Designer (Dashboards)", "Lumen Health", "lever", "applied", 91, "Remote — EMEA", "applied"],
    ["UI/UX Designer", "Paystack-style Payments Co", "linkedin", "waiting_input", 74, "Lagos, Nigeria", ""],
    ["WordPress Developer", "Brightline Agency", "indeed", "needs_tailoring", 67, "Remote", ""],
    ["Lead Product Designer", "Atlas Lending", "ashby", "applying", 85, "Remote — Africa", ""],
    ["Graphic Designer", "Corner Studio", "remoteok", "skipped", 42, "Remote", ""],
    ["Product Designer, Growth", "Orbit SaaS", "linkedin", "applied", 83, "Remote", "applied"],
    ["Senior UX Designer", "Helix Insurance", "greenhouse", "failed", 81, "London, UK (Hybrid)", ""],
  ];
  const methods: Record<string, string> = { greenhouse: "greenhouse", lever: "lever", ashby: "ashby", linkedin: "linkedin_easy", indeed: "indeed", remoteok: "external" };
  samples.forEach(([title, company, source, status, score, location], idx) => {
    const id = `sample-${slug(company)}-${idx}`;
    db.jobs[id] = {
      source, externalId: String(1000 + idx), url: "https://example.com/jobs/" + id, applyUrl: "https://example.com/apply/" + id,
      applyMethod: methods[source], title, company, location, remote: location.startsWith("Remote"),
      salary: { min: 40000 + idx * 5000, max: 60000 + idx * 6000, currency: "USD" },
      description: `SAMPLE POSTING. ${company} is hiring a ${title} to design end-to-end product experiences, run user research, build design systems in Figma and collaborate with engineering. Experience with fintech dashboards, prototyping and stakeholder management is a plus.`,
      postedAt: ago(30 + idx * 6), foundAt: ago(idx * 5 + 1), status,
      score: { master: score, tailored: status === "needs_tailoring" ? undefined : score >= 80 ? undefined : score + 10, reasons: ["Strong dashboard and fintech design experience", "Figma and prototyping match the requirements", score < 60 ? "Role focuses on print design" : "Remote-friendly"] },
      gaps: status === "waiting_input" ? [{ item: "Design system ownership at scale", kind: "missing_fact" }] : status === "needs_tailoring" ? [{ item: "PHP / custom theme development", kind: "wording" }] : [],
      questionIds: [], skipReason: status === "skipped" ? "Match score 42 is below tailor threshold (60)" : undefined,
      error: status === "failed" ? "Form changed: could not find the resume upload field" : undefined,
      attempts: status === "failed" ? 3 : 0, updatedAt: ago(idx), sample: true,
    };
    if (status === "applied") {
      db.applications[id] = {
        submittedAt: ago(idx * 3 + 2), site: source === "linkedin" ? "linkedin" : source === "indeed" ? "indeed" : "ats",
        resumeUsed: idx % 2 ? "tailored" : "master", coverLetterUsed: idx % 2 === 1,
        answers: [{ question: "Are you legally authorized to work in this country?", answer: "(sample answer)", factIds: [] }],
        outcome: idx === 1 ? "interview" : "submitted", sample: true,
      };
      const master = (db.profile.main as { masterResume?: { structured?: Record<string, unknown> } } | undefined)?.masterResume?.structured;
      if (idx % 2 === 1 && master) {
        const exp = (master.experience as Array<{ bullets: string[] }>) ?? [];
        db.resumes[id] = {
          structured: {
            ...master,
            summary: `SAMPLE TAILORED. Product Designer focused on data-heavy dashboards for ${company}-style products, with 5+ years designing fintech and healthcare platforms from research to launch.`,
            experience: exp.map((e, i) => (i === 0 ? { ...e, bullets: ["Led the redesign of a loan management dashboard used by top Nigerian lenders, simplifying loan and investment workflows", ...e.bullets.slice(1)] } : e)),
          },
          changes: ["Rewrote summary around dashboard design", "Moved the loan dashboard bullet to the top and used the posting's wording"],
          score: score + 6, createdAt: ago(idx * 3 + 3), sample: true,
        };
        db.coverLetters[id] = {
          text: `SAMPLE COVER LETTER\n\nDear ${company} team,\n\nI'm excited to apply for the ${title} role. Over the past five years I've designed dashboards and end-to-end product flows for fintech and healthcare companies...\n\nBest regards,\n${(db.profile.main as { fullName?: string } | undefined)?.fullName ?? "Your name"}`,
          createdAt: ago(idx * 3 + 3), sample: true,
        };
      }
    }
  });

  const acts: Array<[number, string, string, string]> = [
    [0.2, "info", "scan", "Sample: scan found 42 jobs, 6 new, 2 ready, 1 waiting on you"],
    [0.5, "success", "applied", "Sample: applied to Product Designer (Dashboards) at Lumen Health"],
    [1.2, "warn", "question", "Sample: new question — design system ownership at scale"],
    [2.5, "error", "failed", "Sample: failed to apply to Senior UX Designer at Helix Insurance"],
    [3, "info", "tailor", "Sample: tailored resume for WordPress Developer at Brightline Agency"],
  ];
  acts.forEach(([h, level, type, message], i) => {
    db.activity[`a-sample-${i}`] = { ts: ago(h), level, type, message, sample: true };
  });
  db.activity["a-setup"] = { ts: now(), level: "info", type: "setup", message: "Profile imported from your resume and portfolio. Answer the questions to finish setup." };

  return db;
}

export function localDbPlugin(dataDir: string): Plugin {
  const file = path.join(dataDir, "db.local.json");
  let db: Db | null = null;

  const load = (): Db => {
    if (db) return db;
    if (fs.existsSync(file)) db = JSON.parse(fs.readFileSync(file, "utf8"));
    else {
      db = buildSeed(dataDir);
      save();
    }
    return db!;
  };
  const save = () => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  };

  return {
    name: "local-db",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__db", (req, res) => {
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        const parts = (req.url ?? "/").split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
        const d = load();
        if (req.method === "GET" && parts.length === 0) return send(200, d);
        // Fresh seed built from data/profile.local.json, used by "Import my profile" (Firebase mode).
        if (req.method === "GET" && parts[0] === "_seed") return send(200, buildSeed(dataDir));
        // Owner's resume PDF (path from data/profile.local.json) as base64, for prefilling onboarding.
        if (req.method === "GET" && parts[0] === "_resume") {
          const p = JSON.parse(fs.readFileSync(path.join(dataDir, "profile.local.json"), "utf8"));
          const file = p.sources?.resumePdf as string | undefined;
          if (!file || !fs.existsSync(file)) return send(404, { error: "resume not found" });
          const buf = fs.readFileSync(file);
          return send(200, { fileName: path.basename(file), size: buf.length, base64: buf.toString("base64") });
        }
        if (req.method === "POST" && parts[0] === "_reset") {
          db = buildSeed(dataDir);
          save();
          return send(200, db);
        }
        const [col, id] = parts;
        if (!col || !id) return send(400, { error: "collection and id required" });
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          d[col] ??= {};
          if (req.method === "PUT") d[col][id] = JSON.parse(body || "{}");
          else if (req.method === "PATCH") d[col][id] = { ...(d[col][id] ?? {}), ...JSON.parse(body || "{}") };
          else if (req.method === "DELETE") delete d[col][id];
          else return send(405, { error: "method not allowed" });
          save();
          send(200, { ok: true });
        });
      });
    },
  };
}
