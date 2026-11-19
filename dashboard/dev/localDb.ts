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
    applications: {}, questions: {}, activity: {}, workerStatus: {}, agencies: {},
    outreachCompanies: {}, coldEmails: {},
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
    agencySettings: {
      enabled: true,
      autoSubmit: true,
      skipPaidAgencies: true,
      targetLocations: [],
      targetRoles: [],
    },
    outreachSettings: {
      enabled: true,
      niches: ["Loan Companies & Digital Lending", "Fintech & Payments"],
      targetLocations: [],
      dailyEmailLimit: 15,
      autoSearchCompanies: true,
    },
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

  // Sample recruitment agencies demonstrating free auto-submission and paid skipping
  db.agencies["agency-workforce-ng"] = {
    name: "Workforce Group Nigeria",
    website: "https://workforcegroup.com",
    registrationUrl: "https://workforcegroup.com/job-seekers/drop-cv",
    locations: ["Lagos", "Abuja", "Remote"],
    countries: ["NG"],
    sectors: ["Technology", "Banking & Finance", "Consulting"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates (Never pay for employment)",
    status: "submitted",
    foundAt: ago(24),
    submittedAt: ago(4),
    submissionMethod: "portal_form",
    contactEmail: "careers@workforcegroup.com",
    phone: "+234 1 280 1410",
    description: "Leading HR and talent solutions partner in Nigeria matching candidates with top corporate clients.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "stateOfResidence"],
    submittedDetails: {
      candidateName: (db.profile.main as { fullName?: string } | undefined)?.fullName || "Candidate",
      candidateEmail: (db.profile.main as { email?: string } | undefined)?.email || "candidate@example.com",
      candidatePhone: (db.profile.main as { phone?: string } | undefined)?.phone || "+234 800 000 0000",
      resumeFileName: "Candidate_Resume.pdf",
      targetRoles: ["Product Designer", "UI/UX Designer"],
      locations: ["Lagos", "Remote"],
      salaryExpectation: "$60,000+",
      coverNote: "Registered profile and resume for relevant placement opportunities.",
    },
    submissionNotes: "Profile registered. Recruiter desk notified (Ref: AGY-WF-8201).",
    sample: true,
  };

  db.agencies["agency-hays-uk"] = {
    name: "Hays UK & Ireland",
    website: "https://www.hays.co.uk",
    registrationUrl: "https://www.hays.co.uk/register",
    locations: ["London", "Manchester", "Birmingham", "Remote"],
    countries: ["GB", "IE"],
    sectors: ["Technology", "Digital", "Finance", "Engineering"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates (employer-funded recruitment)",
    status: "verified_free",
    foundAt: ago(12),
    submissionMethod: "portal_form",
    contactEmail: "candidates@hays.co.uk",
    phone: "+44 20 7259 8700",
    description: "UK's leading recruitment specialist with dedicated tech and design placement teams.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume", "desiredRole"],
    sample: true,
  };

  db.agencies["agency-michael-page-uk"] = {
    name: "Michael Page UK (PageGroup)",
    website: "https://www.michaelpage.co.uk",
    registrationUrl: "https://www.michaelpage.co.uk/my-page/register",
    locations: ["London", "Reading", "Manchester", "Remote"],
    countries: ["GB"],
    sectors: ["Technology", "Design & Creative", "Product"],
    isPaidService: false,
    pricingDetails: "100% Free for candidates",
    status: "verified_free",
    foundAt: ago(8),
    submissionMethod: "portal_form",
    contactEmail: "cv@michaelpage.co.uk",
    description: "Specialized recruitment consultancy representing leading tech firms and enterprises.",
    portalFieldsRequired: ["fullName", "email", "phone", "resume"],
    sample: true,
  };

  db.agencies["agency-paid-sample-club"] = {
    name: "Executive Placement Club (Paid Membership)",
    website: "https://example-paid-placement-service.org",
    registrationUrl: "https://example-paid-placement-service.org/checkout/signup",
    locations: ["London", "New York", "Remote"],
    countries: ["GLOBAL", "US", "GB"],
    sectors: ["Executive", "Management"],
    isPaidService: true,
    pricingDetails: "PAID: Charges $199/month candidate membership fee before submission",
    status: "paid_skipped",
    skipReason: "Paid service skipped - candidate fee or subscription required ($199/month)",
    foundAt: ago(16),
    submissionMethod: "portal_form",
    description: "Paid subscription candidate network that charges jobseekers upfront.",
    portalFieldsRequired: ["creditCardNumber", "billingAddress"],
    sample: true,
  };

  // Sample outreach companies across requested niches (e.g. loan companies)
  db.outreachCompanies["comp-fairmoney"] = {
    name: "FairMoney",
    domain: "fairmoney.io",
    website: "https://fairmoney.io",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Leading mobile banking and instant credit provider in emerging markets.",
    size: "500-1000",
    status: "contacted",
    foundAt: ago(36),
    contactedAt: ago(5),
    emailsSentCount: 1,
    source: "auto_search",
    contacts: [
      { id: "c-fm-1", name: "Talent Acquisition Team", title: "Head of People & Talent", email: "talent@fairmoney.io", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-fm-2", name: "Engineering & Product Desk", title: "VP of Product & Tech", email: "careers@fairmoney.io", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-fm-3", name: "Executive Office", title: "Co-Founder & CEO", email: "laurin@fairmoney.io", roleCategory: "executive", confidence: "high" },
    ],
    sample: true,
  };

  db.coldEmails["email-fm-1"] = {
    companyId: "comp-fairmoney",
    companyName: "FairMoney",
    recipientName: "Talent Acquisition Team",
    recipientEmail: "talent@fairmoney.io",
    recipientTitle: "Head of People & Talent",
    roleCategory: "hr_talent",
    subject: "Product Designer Application / Inbound — Candidate",
    body: "Hi Talent Acquisition Team,\n\nI have been following FairMoney's rapid growth in the Loan Companies & Digital Lending space in Lagos...",
    sentAt: ago(5),
    status: "sent",
    templateId: "tpl-talent-pitch",
    notes: "Cold email sent to Head of Talent",
    sample: true,
  };

  db.outreachCompanies["comp-carbon"] = {
    name: "Carbon",
    domain: "yourcarbon.com",
    website: "https://yourcarbon.com",
    niche: "Loan Companies & Digital Lending",
    location: "Lagos, Nigeria",
    country: "NG",
    description: "Pan-African digital lender providing instant personal loans, SME credit, and payments.",
    size: "200-500",
    status: "contacts_found",
    foundAt: ago(18),
    source: "auto_search",
    contacts: [
      { id: "c-cb-1", name: "People Operations", title: "Head of People Operations", email: "careers@yourcarbon.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-cb-2", name: "Credit & Product Lead", title: "Head of Digital Lending", email: "recruitment@yourcarbon.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-cb-3", name: "Chijioke Dozie", title: "Co-Founder & CEO", email: "chijioke@yourcarbon.com", roleCategory: "executive", confidence: "high" },
    ],
    sample: true,
  };

  db.outreachCompanies["comp-funding-circle"] = {
    name: "Funding Circle",
    domain: "fundingcircle.com",
    website: "https://fundingcircle.com",
    niche: "Loan Companies & Digital Lending",
    location: "London, United Kingdom",
    country: "GB",
    description: "UK's premier small business loan platform facilitating commercial credit.",
    size: "1000+",
    status: "contacts_found",
    foundAt: ago(10),
    source: "auto_search",
    contacts: [
      { id: "c-fc-1", name: "Talent Team", title: "Head of Talent Acquisition UK", email: "careers@fundingcircle.com", roleCategory: "hr_talent", confidence: "verified" },
      { id: "c-fc-2", name: "Lending Tech Lead", title: "VP of Engineering", email: "tech-recruiting@fundingcircle.com", roleCategory: "hiring_manager", confidence: "high" },
      { id: "c-fc-3", name: "Lisa Jacobs", title: "Chief Executive Officer", email: "lisa.jacobs@fundingcircle.com", roleCategory: "executive", confidence: "high" },
    ],
    sample: true,
  };

  const acts: Array<[number, string, string, string]> = [
    [0.1, "success", "outreach", "Sample: sent personalized cold email to Head of Talent at FairMoney (Loan Companies)"],
    [0.2, "info", "scan", "Sample: scan found 42 jobs, 6 new, 2 ready, 1 waiting on you"],
    [0.4, "success", "agency", "Sample: auto-submitted profile & resume to Workforce Group Nigeria (Free agency)"],
    [0.5, "success", "applied", "Sample: applied to Product Designer (Dashboards) at Lumen Health"],
    [0.8, "warn", "agency", "Sample: skipped Executive Placement Club — paid candidate fee ($199/mo) detected"],
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
