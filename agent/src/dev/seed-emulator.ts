// Seeds a test user into the LOCAL Firestore emulator for end-to-end dry runs.
// Usage: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-job-agent RESUME_PDF=<path> npx tsx src/dev/seed-emulator.ts
import fs from "node:fs";
import path from "node:path";
import { userDb, nowIso } from "../db";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Refusing to run without FIRESTORE_EMULATOR_HOST (emulator only).");
const pdfPath = process.env.RESUME_PDF;
if (!pdfPath || !fs.existsSync(pdfPath)) throw new Error("Set RESUME_PDF to a resume PDF path.");

const uid = "e2e-test-user";
const db = userDb(uid);
const now = nowIso();
await db.set("profile", "main", {
  fullName: "E2E Test Candidate", email: "e2e@example.test", phone: "+234 800 000 0000", location: "Lagos", country: "NG",
  headline: "Product Designer with 5+ years designing fintech dashboards and MVPs",
  links: { portfolio: "https://example.com" },
  standardAnswers: { workAuthorization: "Nigerian citizen; requires visa sponsorship to work in the Netherlands", needsSponsorship: "Yes", willingToRelocate: "Yes", salaryExpectation: "USD 48,000+/year", yearsExperience: "5" },
  masterResume: { fileName: path.basename(pdfPath), uploadedAt: now, pdfBase64: fs.readFileSync(pdfPath).toString("base64") },
});
for (const text of [
  "Needs visa sponsorship: Yes", "Work authorization: Nigerian citizen; requires visa sponsorship to work in the Netherlands",
  "Open to relocating: Yes", "Lives in: Lagos, Nigeria", "Target roles: Product Designer", "Seniority: Mid, Senior", "Years of experience: 5",
]) await db.add("facts", { text, category: "logistics", source: "manual", createdAt: now, updatedAt: now });
await db.set("workerStatus", "main", { state: "idle", appliedToday: { linkedin: 0, indeed: 0, ats: 0 }, sessions: { linkedin: "unknown", indeed: "unknown" } });
await db.set("settings", "main", {
  paused: false, onboardedAt: now, roles: ["Product Designer"], includeKeywords: ["Figma", "design system", "fintech"], excludeKeywords: [],
  countries: ["NL"], locations: [], workModes: ["hybrid", "onsite", "remote"], jobTypes: ["full_time", "contract"],
  enabledSites: ["greenhouse", "lever", "ashby", "workable", "himalayas", "weworkremotely", "remotive", "remoteok"],
  remoteOnly: false, minSalary: 48000, currency: "USD", seniority: ["mid", "senior"], blockedCompanies: [],
  thresholds: { apply: 75, tailor: 55 }, dailyCaps: { linkedin: 15, indeed: 15, ats: 30 }, pacingMinutes: { min: 4, max: 15 },
  targetCompanies: [], coverLetter: { mode: "when_required", tone: "professional" },
});
console.log(`Seeded users/${uid} in the emulator.`);
process.exit(0);
