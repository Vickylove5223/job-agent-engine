// Step 1 of moving to the real account: reads the emulator and writes a clean bundle (no fake data)
// to OUT_FILE. Emulator only. Usage: FIRESTORE_EMULATOR_HOST=... SIGNUP_UID=... OUT_FILE=... npx tsx src/dev/export-for-real.ts
import fs from "node:fs";
import { firestore, nowIso } from "../db";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Emulator only.");
const db = firestore();
const signup = db.collection("users").doc(process.env.SIGNUP_UID!);
const owner = db.collection("users").doc("owner-local");
const now = nowIso();

const profile = (await signup.collection("profile").doc("main").get()).data()!;
const s = (await signup.collection("settings").doc("main").get()).data()!;

// Facts: curated owner-local facts (from the real resume/portfolio + answers), minus ones the user
// has since changed (now remote-only, not relocating), plus answers from the signup questions.
const stale = /hybrid or on-site|Open to relocating|Wants to work in/i;
const facts: { text: string; category: string; source: string }[] = [];
for (const d of (await owner.collection("facts").get()).docs) {
  const f = d.data();
  if (!stale.test(f.text)) facts.push({ text: f.text, category: f.category, source: f.source });
}
facts.push({ text: "Wants to work: remote, for employers in the Netherlands", category: "preference", source: "answer" });
facts.push({ text: "Open to relocating: No", category: "preference", source: "answer" });
for (const d of (await signup.collection("questions").where("status", "==", "answered").get()).docs) {
  const q = d.data();
  facts.push({ text: `Q: ${q.text} A: ${q.answer}`, category: "other", source: "answer" });
}

// The one genuine application (confirmed by the employer) + its job.
const realApps: Record<string, unknown> = {};
const realJobs: Record<string, unknown> = {};
for (const d of (await owner.collection("applications").get()).docs) {
  const a = d.data();
  if (!a.screenshotJpegBase64) continue; // genuine submissions always carry the confirmation screenshot
  realApps[d.id] = a;
  realJobs[d.id] = (await owner.collection("jobs").doc(d.id).get()).data();
}

const settings = {
  ...s,
  onboardedAt: s.onboardedAt || now,
  enabledSites: ["greenhouse", "lever", "ashby", "workable", "arbeitnow", "remotive", "remoteok", "weworkremotely", "himalayas"],
  thresholds: { apply: 70, tailor: 55 },
  consent: { acceptRequired: true },
  dailyCaps: s.dailyCaps ?? { linkedin: 15, indeed: 15, ats: 30 },
  pacingMinutes: { min: 1, max: 3 },
  coverLetter: s.coverLetter ?? { mode: "when_required", tone: "professional" },
  targetCompanies: s.targetCompanies ?? [],
  blockedCompanies: s.blockedCompanies ?? [],
  includeKeywords: s.includeKeywords ?? [],
  excludeKeywords: s.excludeKeywords ?? [],
  locations: s.locations ?? [],
};
profile.standardAnswers = { ...profile.standardAnswers, salaryExpectation: profile.standardAnswers?.salaryExpectation ?? "Competitive market rate" };

fs.writeFileSync(process.env.OUT_FILE!, JSON.stringify({ profile, settings, facts, realApps, realJobs }));
console.log(`exported: profile=${profile.fullName}, facts=${facts.length}, genuine applications=${Object.keys(realApps).length}`);
process.exit(0);
