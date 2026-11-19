// Loads the OWNER's real profile (data/profile.local.json + resume PDF) into the LOCAL emulator so the
// agent can apply with real details before the owner's Firebase account exists. Emulator only.
// Usage: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-job-agent npx tsx src/dev/seed-owner.ts
import fs from "node:fs";
import path from "node:path";
import { userDb, nowIso } from "../db";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Emulator only.");
const dataDir = path.resolve(import.meta.dirname, "../../../data");
const p = JSON.parse(fs.readFileSync(path.join(dataDir, "profile.local.json"), "utf8"));
const pdfPath: string = p.sources.resumePdf;
const uid = "owner-local";
const db = userDb(uid);
const now = nowIso();

await db.set("profile", "main", {
  fullName: p.profile.fullName, email: p.profile.email, phone: p.profile.phone, location: "Lagos", country: "NG",
  headline: "Product Designer with 5+ years designing fintech dashboards and MVPs",
  links: { linkedin: p.profile.links.linkedin, portfolio: p.profile.links.portfolio },
  standardAnswers: {
    workAuthorization: "Nigerian citizen; requires visa sponsorship to work in the Netherlands",
    needsSponsorship: "Yes", willingToRelocate: "Yes", salaryExpectation: "USD 4,000/month (USD 48,000/year)", yearsExperience: "5",
  },
  masterResume: { fileName: path.basename(pdfPath), uploadedAt: now, pdfBase64: fs.readFileSync(pdfPath).toString("base64") },
});

const facts = [
  "Lives in: Lagos, Nigeria",
  "Wants to work in: the Netherlands (hybrid or on-site)",
  "Open to relocating to the Netherlands: Yes",
  "Needs visa sponsorship to work in the Netherlands: Yes",
  "Work authorization: Nigerian citizen; not currently authorized to work in the Netherlands without sponsorship",
  "Minimum salary: USD 4,000 per month (USD 48,000 per year)",
  "Target roles: Product Designer",
  "Seniority: Mid, Senior",
  "Years of experience: 5",
  "Job types: Full-time, Contract",
  "Languages: English (fluent)",
  ...((p.portfolioFacts as string[]) ?? []),
];
for (const text of facts) await db.add("facts", { text, category: "other", source: "manual", createdAt: now, updatedAt: now });

await db.set("workerStatus", "main", { state: "idle", appliedToday: { linkedin: 0, indeed: 0, ats: 0 }, sessions: { linkedin: "unknown", indeed: "unknown" } });
await db.set("settings", "main", {
  paused: false, onboardedAt: now, roles: ["Product Designer"], includeKeywords: ["Figma", "design system", "fintech", "dashboard"], excludeKeywords: [],
  countries: ["NL"], locations: [], workModes: ["hybrid", "onsite"], jobTypes: ["full_time", "contract"],
  enabledSites: ["greenhouse", "lever", "ashby", "workable"],
  remoteOnly: false, minSalary: 48000, currency: "USD", seniority: ["mid", "senior"], blockedCompanies: [],
  thresholds: { apply: 70, tailor: 55 }, dailyCaps: { linkedin: 15, indeed: 15, ats: 30 }, pacingMinutes: { min: 1, max: 2 },
  targetCompanies: [], coverLetter: { mode: "when_required", tone: "professional" },
});
console.log(`Loaded real profile into users/${uid} (emulator).`);
process.exit(0);
