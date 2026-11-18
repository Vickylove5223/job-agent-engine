# Job Agent Engine — Build Plan

An autonomous job-search agent that finds jobs, rates your resume against each one, tailors a
resume (without inventing anything), writes cover letters, and auto-applies — on Greenhouse, Lever,
Ashby, LinkedIn Easy Apply and Indeed. When it is unsure of something, it asks you in the dashboard
and remembers your answer forever.

**Cost: $0.** GitHub Pages + GitHub Actions + Firebase (Spark/free) + Gemini free tier + a local worker on your PC.

> ## ⚠️ Architecture update (2026-11-18) — supersedes the "local worker" parts below
> - **Multi-user.** Anyone can sign up. Each account's data lives under `users/{uid}/…` in Firestore;
>   rules allow a user to touch only their own tree. New accounts go through a 7-step onboarding
>   wizard (profile → resume → roles → where → pay → job sites → autopilot).
> - **Location-based job sites.** `shared/src/sites.ts` holds a catalog of job sites by country plus
>   remote/global boards, each tagged auto / assisted / monitor. Onboarding and Settings recommend
>   sites from the user's countries, work modes and field; chosen ids are stored in `settings.enabledSites`.
> - **No self-hosted browsers.** The "worker on your PC" is replaced by hosted browsers on
>   **Browserbase**, driven by **Stagehand 4** (`agent/`). Logins: the user signs in themselves in a
>   Browserbase **Live View** embedded in the dashboard; cookies persist in a per-user Browserbase
>   **Context** (`connections/{siteId}` stores only the context id + status). Orchestration runs on
>   GitHub Actions cron (free); the connect endpoints need a small serverless API (Vercel Hobby, free)
>   because GitHub Pages is static and the Browserbase key must stay server-side.
> - **Cost reality.** Browserbase free ≈ 1 browser-hour/month, 15-min sessions, no stealth/proxies —
>   enough to set up and test (~15–30 applications). Daily auto-applying needs the Developer plan
>   (~$20/mo, 100 h). API job feeds (Greenhouse, Lever, Ashby, RemoteOK…) use no browser time;
>   browser minutes are spent only on logins and submitting applications.
>
> This file is the single source of truth for every agent building the project.
> Read sections 2–5 (architecture, contracts, status machine) before writing any code.

---

## 1. Principles (every agent must follow)

1. **Never fabricate.** Tailored resumes, cover letters and form answers may only use facts from the
   master resume or the `facts` collection. Unknown → create a Question, never guess.
2. **Fully autonomous.** No approval step. Jobs that pass the threshold are applied to automatically.
3. **Protect the user's accounts.** Daily caps, random pacing, stop on CAPTCHA / "verify it's you".
   LinkedIn/Indeed sessions only ever run on the user's PC — never in GitHub Actions.
4. **No secrets in the dashboard.** The dashboard repo is public (free GitHub Pages). Firebase web
   config is public by design; security comes from Firestore rules locked to one owner UID.
5. **Free-tier aware.** Respect Gemini rate limits (queue + backoff) and Firestore quotas
   (50k reads / 20k writes per day): avoid broad realtime listeners, paginate lists.
6. **Shared types are the contract.** Nobody changes `shared/src/types.ts` or the status machine
   without updating this file.

---

## 2. Architecture

```
┌────────────────────────── GitHub Actions (cron every 30 min) ──────────────────────────┐
│  scanner/                                                                               │
│   fetch → normalize → dedupe → hard filters → AI score master resume → write job       │
│   sources: Greenhouse · Lever · Ashby (target companies) · RemoteOK · Adzuna            │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           ▼
                              ┌──────── Firestore ────────┐
                              │ settings profile facts    │
                              │ jobs resumes coverLetters │
                              │ applications questions    │
                              │ activity workerStatus     │
                              └───▲───────────────────▲───┘
                                  │                   │
┌──── GitHub Pages: dashboard/ ───┴──┐     ┌──────────┴──── Your PC: worker/ ────────────────────┐
│ React + Vite + Firebase Auth       │     │ Node + Playwright (saved Chrome profile) + Stagehand │
│ Overview · Jobs · Questions        │     │ • LinkedIn / Indeed discovery (2–3×/day)             │
│ Applications · Profile · Settings  │     │ • tailor resume → PDF, cover letter → PDF            │
│ Answers questions, edits settings  │     │ • apply via site adapters, screenshot, log           │
└────────────────────────────────────┘     │ • re-runs jobs when you answer questions             │
                                           └──────────────────────────────────────────────────────┘
                     AI everywhere: Gemini API free tier via shared/src/ai
```

### Tech choices

| Part | Tools |
|---|---|
| Monorepo | npm workspaces, TypeScript (strict), Node 22+, ESM |
| Shared | `zod` schemas + types, `@google/genai`, prompt files |
| Dashboard | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui (Radix), React Router **HashRouter** (GitHub Pages), Firebase Web SDK (Auth + Firestore), `lucide-react` icons, `recharts` |
| Scanner | Node script, `firebase-admin`, `p-limit` |
| Worker | Node, `playwright` (persistent context), `@browserbasehq/stagehand` (LOCAL env, Gemini model), `firebase-admin`, `pdf-parse` |
| PDFs | HTML templates rendered with Playwright `page.pdf()` (ATS-friendly single column) |
| CI | GitHub Actions: `scan.yml` (cron), `deploy-pages.yml` (on push to main) |

---

## 3. Repository layout & file ownership

```
job-agent-engine/
├─ PLAN.md                     (this file)
├─ package.json                (workspaces)
├─ .env.example
├─ .gitignore                  (profiles/, *.json keys, .env, tmp/)
├─ shared/                     ← Agent 0 (contracts) + Agent C (ai/, pdf/)
│  └─ src/
│     ├─ types.ts              zod schemas + TS types for every collection
│     ├─ status.ts             job status machine + allowed transitions
│     ├─ firestore-paths.ts    collection names, id helpers (jobId = sha1(source:externalId))
│     ├─ ai/                   Gemini client, prompts, functions (section 6)
│     └─ pdf/                  resume + cover-letter HTML templates
├─ firebase/                   ← Agent 0
│  ├─ firestore.rules
│  ├─ firestore.indexes.json
│  └─ firebase.json            (emulator config)
├─ dashboard/                  ← Agent A
├─ scanner/                    ← Agent B
│  └─ src/sources/{greenhouse,lever,ashby,remoteok,adzuna}.ts
├─ worker/                     ← Agent D (core + ATS adapters) & Agent E (linkedin/, indeed/)
│  └─ src/
│     ├─ index.ts, loop.ts, session.ts, queue.ts, pacing.ts, heartbeat.ts
│     ├─ adapters/{greenhouse,lever,ashby,generic}.ts        (Agent D)
│     └─ adapters/{linkedin,indeed}.ts + discovery/{linkedin,indeed}.ts  (Agent E)
└─ .github/workflows/          ← Agent B (scan.yml), Agent A (deploy-pages.yml)
```

An agent only edits the files it owns. Need a change to `shared/`? Note it in your report; Agent 0 / lead applies it.

---

## 4. Data model (Firestore) — the contract

All timestamps are Firestore `Timestamp`. IDs noted where fixed.

### `settings/main`
```ts
{
  paused: boolean,
  roles: string[],                 // "Frontend Developer", "React Developer"
  includeKeywords: string[],
  excludeKeywords: string[],       // "senior staff", "clearance"
  locations: string[],
  remoteOnly: boolean,
  minSalary: number | null, currency: string,
  seniority: ("intern"|"junior"|"mid"|"senior"|"lead")[],
  blockedCompanies: string[],
  thresholds: { apply: 80, tailor: 60 },          // ≥apply → apply; tailor..apply → tailor; <tailor → skip
  dailyCaps: { linkedin: 15, indeed: 15, ats: 30 },
  pacingMinutes: { min: 4, max: 15 },
  sources: { greenhouse, lever, ashby, remoteok, adzuna, linkedin, indeed: boolean },
  targetCompanies: { ats: "greenhouse"|"lever"|"ashby", slug: string, name: string }[],
  coverLetter: { mode: "when_required" | "always" , tone: "professional"|"warm"|"concise" }
}
```

### `profile/main`
```ts
{
  fullName, email, phone, location, links: { linkedin?, github?, portfolio? },
  masterResume: {
    fileName, uploadedAt, pdfBase64,            // < 900 KB
    text,                                        // extracted text
    structured: Resume                           // parsed by AI (see Resume type)
  },
  standardAnswers: {                             // seeded into facts too
    workAuthorization?, needsSponsorship?, noticePeriod?, salaryExpectation?,
    willingToRelocate?, yearsExperience?
  }
}
```
`Resume = { summary, skills: string[], experience: {company,title,start,end,location,bullets[]}[], education: {...}[], certifications: string[], projects: {...}[] }`

### `facts/{factId}`
```ts
{ text: string, category: "skill"|"experience"|"preference"|"logistics"|"negative"|"other",
  source: "resume"|"answer"|"manual", questionId?: string, createdAt, updatedAt }
```
"negative" facts record what the user does NOT have ("No Kubernetes experience") — equally important.

### `jobs/{jobId}`
```ts
{
  source: "greenhouse"|"lever"|"ashby"|"remoteok"|"adzuna"|"linkedin"|"indeed",
  externalId, url, applyUrl,
  applyMethod: "greenhouse"|"lever"|"ashby"|"linkedin_easy"|"indeed"|"external",
  title, company, location, remote: boolean, salary?: {min,max,currency},
  description, postedAt?, foundAt,
  status: JobStatus,                               // section 5
  score?: { master: number, tailored?: number, reasons: string[] },
  gaps?: { item: string, kind: "wording"|"missing_fact"|"true_gap" }[],
  questionIds?: string[],
  skipReason?: string, error?: string,
  attempts: number, lockedBy?: string, lockedAt?,
  updatedAt
}
```

### `resumes/{jobId}` — tailored version for a job
`{ structured: Resume, changes: string[], score, pdfBase64, createdAt }`

### `coverLetters/{jobId}`
`{ text, pdfBase64?, createdAt }`

### `applications/{jobId}`
```ts
{ submittedAt, site, resumeUsed: "master"|"tailored", coverLetterUsed: boolean,
  answers: { question: string, answer: string, factIds: string[] }[],
  screenshotJpegBase64,                            // compressed, < 300 KB
  outcome: "submitted"|"interview"|"rejected"|"offer"|"ghosted", notes? }
```

### `questions/{questionId}`
```ts
{ text, whyNeeded, origin: "scoring"|"form"|"tailoring",
  jobIds: string[],                                // all jobs waiting on it
  inputType: "text"|"yes_no"|"number"|"choice", options?: string[],
  status: "open"|"answered"|"dismissed",
  answer?: string, saveAsFact: boolean, createdAt, answeredAt? }
```
Before creating a question, de-duplicate against open questions (normalized text + AI similarity); if a match exists, append the jobId instead.

### `activity/{autoId}`
`{ ts, level: "info"|"success"|"warn"|"error", type, jobId?, message }`

### `workerStatus/main`
```ts
{ heartbeatAt, state: "idle"|"discovering"|"tailoring"|"applying"|"paused"|"blocked",
  currentJobId?, appliedToday: { linkedin, indeed, ats },
  sessions: { linkedin: "ok"|"logged_out"|"checkpoint", indeed: ... },
  blockedUntil?: { linkedin?, indeed? }, version }
```

### Security rules (summary)
Only `request.auth.uid == OWNER_UID` can read/write anything. Scanner and worker use the Admin SDK
(service account) which bypasses rules.

---

## 5. Job status machine

```
new ──score──▶ scored ─┬─ score ≥ apply ───────────────▶ ready
                       ├─ tailor ≤ score < apply ──────▶ needs_tailoring ──tailor──▶ ready
                       │                                      └─ still < apply ──▶ skipped
                       ├─ missing facts ───────────────▶ waiting_input
                       └─ score < tailor / filtered ───▶ skipped

ready ──worker claims──▶ applying ─┬─▶ applied
                                   ├─▶ waiting_input   (unknown form question)
                                   ├─▶ blocked         (captcha / checkpoint → site paused N hours)
                                   └─▶ failed          (retry up to 3, then stays failed)

waiting_input ──all its questions answered──▶ new   (re-scored with new facts)
any ──user "Skip"──▶ skipped        any non-applied ──user "Retry"──▶ new
```
Transitions live in `shared/src/status.ts` (`canTransition(from,to)`); scanner, worker and dashboard all use it.

---

## 6. AI layer (`shared/src/ai`) — owned by Agent C

All functions return zod-validated JSON (Gemini structured output). Model name comes from env
`GEMINI_MODEL`. Client includes: rate limiter (requests/min from env), exponential backoff on 429,
response caching by input hash.

| Function | In → Out |
|---|---|
| `parseResume(text)` | → `Resume` |
| `scoreMatch(resume, job, facts)` | → `{ score 0–100, reasons[], gaps[], questions[] }` |
| `tailorResume(resume, job, facts)` | → `{ resume: Resume, changes[] }` |
| `verifyNoFabrication(master, tailored, facts)` | → `{ ok, violations[] }` — deterministic check (companies, titles, dates, degrees must match master exactly) **plus** an AI claim-by-claim check. Any violation → discard and retry once, then fall back to master. |
| `writeCoverLetter(resume, job, facts, tone)` | → `{ text }` (≤ 300 words, no invented facts) |
| `answerFormField(field, profile, facts, job)` | → `{ answer, confidence 0–1, factIds[] }` — confidence < 0.8 → create Question |
| `matchQuestion(newQ, openQs)` | → existing question id or null (dedupe) |
| `factsFromAnswer(question, answer)` | → `Fact[]` to save |

PDF templates (`shared/src/pdf`): `renderResumeHtml(resume)` and `renderCoverLetterHtml(text, profile, job)`;
the worker turns HTML → PDF with Playwright.

---

## 7. Scanner (`scanner/`) — owned by Agent B

Runs in GitHub Actions every 30 min (`scan.yml`, `workflow_dispatch` too).

1. Load `settings/main`; exit if `paused`.
2. For each enabled source, `fetchJobs(settings): RawJob[]` (common interface):
   - Greenhouse `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`
   - Lever `api.lever.co/v0/postings/{slug}?mode=json`
   - Ashby `api.ashbyhq.com/posting-api/job-board/{slug}`
   - RemoteOK `remoteok.com/api` (keyword filter locally)
   - Adzuna search API (free key, keywords + location)
3. Normalize → `jobId = sha1(source:externalId)` → skip if exists.
4. Hard filters: roles/keywords, exclude keywords, location/remote, salary, seniority, blocked companies.
   Rejected → write as `skipped` with reason (keeps dedupe working).
5. AI `scoreMatch` with master resume + facts → set status per section 5. Create/merge Questions.
6. Write `activity` summary ("Scan: 42 found, 6 new, 2 ready, 1 waiting on you").
Secrets: `FIREBASE_SERVICE_ACCOUNT` (JSON), `GEMINI_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`.

---

## 8. Worker (`worker/`) — Agents D & E

Runs on your PC: `npm run worker`. Uses a dedicated persistent Chrome profile at `worker/profiles/main`
(gitignored — treat like a password).

**Startup**
1. Launch Playwright persistent context (`channel: "chrome"`, headed by default).
2. Session check for LinkedIn and Indeed. If logged out → open the login page and wait for you to sign
   in (2FA included); never type passwords. Update `workerStatus.sessions`.

**Main loop** (every minute)
1. Heartbeat → `workerStatus/main`. If `settings.paused` → idle.
2. **Answered questions:** for each newly answered question → save facts (`factsFromAnswer`) if
   `saveAsFact`, then move its jobs whose questions are all answered back to `new` and re-score.
3. **Discovery** (2–3×/day, randomized): LinkedIn & Indeed searches (Easy Apply / Apply-with-Indeed
   filters), max ~3 result pages each → same normalize → filter → score pipeline as the scanner.
4. **Tailoring:** `needs_tailoring` jobs → `tailorResume` → `verifyNoFabrication` → re-score → `ready` or `skipped`.
5. **Applying:** claim one `ready` job via Firestore transaction (`lockedBy`, 15-min lock expiry).
   Check daily cap and `blockedUntil` for its site. Then:
   - render resume PDF (tailored or master) + cover letter PDF if needed → `worker/tmp/`
   - route to adapter by `applyMethod`
   - write `applications/{jobId}`, screenshot, activity; status `applied`
   - wait random `pacingMinutes`.

**Adapter interface**
```ts
interface ApplyAdapter {
  canHandle(job: Job): boolean;
  apply(ctx: ApplyContext): Promise<ApplyResult>;
}
type ApplyContext = { page: Page; stagehand: Stagehand; job: Job; profile: Profile; facts: Fact[];
                      resumePdfPath: string; coverLetter?: { text: string; pdfPath: string };
                      answer: (field: FormField) => Promise<FieldAnswer> };  // wraps answerFormField
type ApplyResult = { status: "applied" | "waiting_input" | "blocked" | "failed";
                     answers: AnswerLog[]; screenshot?: Buffer; questions?: NewQuestion[]; error?: string };
```
- Adapters fill known fields with Playwright selectors first; Stagehand `act/extract` handles anything unusual.
- Any field where `answer()` returns confidence < 0.8 → stop **before submitting**, return `waiting_input` with the questions.
- CAPTCHA, "verify it's you", security checkpoint → return `blocked`; site paused 12 h; never bypass.
- Agent D: `greenhouse`, `lever`, `ashby`, `generic` (Stagehand fallback for external sites, off by default).
- Agent E: `linkedin` (Easy Apply multi-step modal), `indeed` (Apply with Indeed flow; external redirects → `external`), plus discovery.

---

## 9. Dashboard (`dashboard/`) — owned by Agent A

### Look & feel — blue theme
| Token | Light | Dark |
|---|---|---|
| `--primary` | `#2563EB` (blue-600) | `#3B82F6` |
| `--primary-soft` | `#DBEAFE` | `#1E3A8A` |
| `--sidebar` | `#0B1B3F` (deep navy) | `#070F24` |
| `--bg` | `#F5F8FF` | `#0A1020` |
| `--card` | `#FFFFFF` | `#111A2E` |
| `--text` | `#0F172A` | `#E2E8F0` |
| `--muted` | `#64748B` | `#94A3B8` |
| `--success` | `#16A34A` | `#22C55E` |
| `--warning` | `#D97706` | `#F59E0B` |
| `--danger` | `#DC2626` | `#EF4444` |

- Font: **Inter** (Google Fonts). Radius 12px cards, 8px inputs. Soft shadows, generous spacing.
- Layout: fixed navy sidebar (logo, nav, worker status dot at bottom), top bar (page title, Pause/Resume
  switch, light/dark toggle, avatar). Collapses to a bottom tab bar on mobile.
- Status badge colors: new/scored = slate, ready = blue, needs_tailoring = indigo, waiting_input = amber,
  applying = blue pulse, applied = green, skipped = gray, blocked/failed = red.
- Score shown as a ring: <60 red, 60–79 amber, ≥80 blue.

### Pages

**1. Login** — centered card on blue gradient, "Sign in with Google". Non-owner UID → "Access denied".

**2. Overview (home)**
- Stat cards: Jobs found today · Applied today (vs. cap, per site) · Waiting on you (links to Questions) · Avg match score.
- Worker card: online/offline (heartbeat < 3 min), current state + job, LinkedIn/Indeed session status, blocked-until timers.
- Pipeline funnel: found → matched → tailored → applied (last 7 days) + applications-per-day chart.
- "Needs your input" callout if open questions > 0.
- Recent activity feed (last 20).

**3. Jobs**
- Tabs/filters by status, source, score range, search box; paginated table (title, company, source, score ring, status, found).
- Job detail drawer: description, score + reasons, gaps list, linked questions, **resume diff** (master vs tailored, highlighted changes), cover letter preview, actions: Skip · Retry · Open posting.

**4. Questions** (inbox, badge count in sidebar)
- Open question cards: question, why it's needed, affected jobs (chips), input matching `inputType`,
  "Save to my profile permanently" toggle (default on), buttons **Answer** · **I don't have this** (saves a negative fact) · Dismiss.
- Answered tab: history, editable (editing updates the fact).

**5. Applications**
- Table: date, job, company, site, resume used (master/tailored), outcome (editable dropdown: submitted → interview → rejected/offer/ghosted).
- Detail: screenshot, resume PDF + cover letter PDF (view/download from base64), every Q&A answer sent with the facts it came from.
- Stats: response rate by source.

**6. Profile & Resume**
- Upload master resume (PDF → text in browser with `pdfjs-dist` → saved; worker/scanner run `parseResume` if `structured` is missing).
- Parsed resume view (editable sections).
- Standard answers form (work authorization, sponsorship, notice period, salary, relocation, years of experience).
- **Facts** list: search, category filter, add/edit/delete. Shows source (resume / your answer / manual).

**7. Settings**
- Search criteria: roles, keywords, exclude keywords, locations, remote only, min salary, seniority.
- Sources toggles + target companies list (ATS + slug, with "test" button that hits the public API).
- Thresholds sliders (apply, tailor), daily caps per site, pacing range, cover letter mode/tone.
- Blocked companies. Big **Pause agent** switch. Danger zone: clear skipped jobs.

**8. Activity** — full log with level filter (errors highlighted), paginated.

Data access: small hooks over Firestore (`useDoc`, `useQueryPaged`); realtime `onSnapshot` only for
`workerStatus/main`, open questions count, and the activity feed (limit 20).

---

## 10. End-to-end flow (one job's life)

1. Scanner finds "React Developer @ Acme" on Greenhouse → passes filters → master resume scores 68 → `needs_tailoring`; gap: "GraphQL" (missing_fact) → Question "Have you used GraphQL in production?" → job `waiting_input`.
2. You open **Questions**, answer "Yes, 2 years at Beta Corp, built the API layer" → fact saved.
3. Worker sees the answer → job back to `new` → re-scored 76 → tailored (summary rewritten, GraphQL bullet surfaced) → verification passes → 86 → `ready`.
4. Worker claims it → renders tailored PDF + cover letter → Greenhouse adapter fills form, uploads files → a field asks "Earliest start date?" → answered from fact "notice period: 2 weeks" (confidence 0.9) → submit → screenshot → `applied`.
5. Dashboard shows it under Applications with the exact resume, letter and answers sent. Next time GraphQL comes up, no question is asked.

---

## 11. Build plan — parallel agents

### Phase 0 — Contracts (one agent, must finish first, ~1 session)
Agent 0 / lead: monorepo + workspaces, `shared/src/types.ts`, `status.ts`, `firestore-paths.ts`,
stub signatures for every function in section 6 and the adapter interface, `firebase/` rules +
emulator config, `.env.example`, `.gitignore`, seed script with sample settings/profile/jobs for the emulator.
The seed script imports the real profile from `data/profile.local.json` (gitignored; built from the
user's resume + portfolio): `profile` → `profile/main`, `resume` → `masterResume.structured`,
each experience bullet / portfolio fact → `facts` (source `resume`), `openQuestions` → `questions` (status `open`).
**Done when:** `npm run typecheck` passes at root and the emulator starts with seed data.

### Phase 1 — Parallel (5 agents, each in its own worktree/branch)
| Agent | Owns | Done when |
|---|---|---|
| **A — Dashboard** | `dashboard/`, `deploy-pages.yml` | All 8 pages work against emulator seed data; builds for Pages (HashRouter, base path); light/dark blue theme; mobile layout |
| **B — Scanner** | `scanner/`, `scan.yml` | All 5 sources fetch + normalize (unit tests with recorded fixtures); full scan writes correct statuses to emulator; workflow runs on `workflow_dispatch` |
| **C — AI core + PDFs** | `shared/src/ai/`, `shared/src/pdf/` | All section-6 functions implemented with prompts + zod schemas; fabrication check has tests (must catch an invented job/skill/date); rate limiter + backoff; templates render clean PDFs |
| **D — Worker core + ATS** | `worker/src/*` except linkedin/indeed | Session handling, loop, queue lock, caps, pacing, heartbeat, question re-run; Greenhouse/Lever/Ashby adapters submit a test application in dry-run mode (stops before final click) |
| **E — LinkedIn & Indeed** | `worker/src/adapters/{linkedin,indeed}.ts`, `worker/src/discovery/` | Discovery returns normalized jobs; Easy Apply + Indeed flows complete in dry-run mode; checkpoint/CAPTCHA detection returns `blocked` |

Agents D/E code against the stub AI functions from Phase 0 until Agent C merges.
Every adapter must support `DRY_RUN=true` (fills everything, screenshots, never clicks the final submit).

### Phase 2 — Integration (lead)
Merge branches → run full pipeline on the emulator → real Firebase project → dry-run against one real
posting per site → turn off dry run → deploy dashboard → enable `scan.yml` cron.

---

## 12. One-time setup (you)

1. **Firebase** (free Spark plan): create project → enable Firestore + Authentication (Google) →
   add `<your-username>.github.io` to Authorized domains → copy web config into `dashboard/.env`.
2. Sign in once → copy your UID into `firestore.rules` (`OWNER_UID`) and deploy rules.
3. **Service account**: Project settings → Service accounts → generate key → save as
   `worker/service-account.json` (gitignored) and as GitHub secret `FIREBASE_SERVICE_ACCOUNT`.
4. **Gemini**: free key from Google AI Studio → `GEMINI_API_KEY` in `worker/.env` and GitHub secrets.
5. **Adzuna** (optional): free app id/key → GitHub secrets.
6. **GitHub**: repo public (for free Pages) → Settings → Pages → Source: GitHub Actions.
7. **Worker**: install Node 22+ → `npm install` → `npx playwright install chrome` → `npm run worker` →
   sign into LinkedIn and Indeed in the window it opens.

---

## 13. Known limits & risks

- **LinkedIn / Indeed ToS forbid automation.** Caps, pacing and stop-on-checkpoint reduce but do not remove the risk of restrictions.
- **Worker only applies while your PC is on.** Scanning and scoring continue 24/7 in Actions.
- **Gemini free tier** has per-minute/per-day limits and Google may use free-tier inputs to improve models. Option: switch to local Ollama via the same `shared/src/ai` client.
- **Firestore free quotas** — keep listeners narrow; store PDFs/screenshots compressed (doc limit 1 MiB).
- **Public dashboard repo** — never commit `.env`, service account keys, or `worker/profiles/`.
- Site UIs change; adapters fall back to Stagehand, and failures land in Activity as `failed` for review.
