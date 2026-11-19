// Step 2: writes the clean bundle into the REAL account users/{REAL_UID}. Additive only.
// Usage: FIREBASE_SERVICE_ACCOUNT=... REAL_UID=... IN_FILE=... npx tsx src/dev/import-real.ts
import fs from "node:fs";
import { userDb, nowIso } from "../db";
import type { Application, Job } from "@shared/types";

if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error("This writes to the REAL project; unset FIRESTORE_EMULATOR_HOST.");
const b = JSON.parse(fs.readFileSync(process.env.IN_FILE!, "utf8"));
const db = userDb(process.env.REAL_UID!);
const now = nowIso();

await db.set("profile", "main", b.profile);
for (const f of b.facts) await db.add("facts", { ...f, createdAt: now, updatedAt: now });
for (const [id, job] of Object.entries(b.realJobs)) await db.set("jobs", id, job as Job);
for (const [id, app] of Object.entries(b.realApps)) await db.set("applications", id, app as Application);
await db.set("workerStatus", "main", { state: "idle", appliedToday: { linkedin: 0, indeed: 0, ats: 0 }, sessions: { linkedin: "unknown", indeed: "unknown" } });
await db.log("success", "applied", "Applied to Lead UX Designer at Actcareers (confirmed by the employer)");
await db.set("settings", "main", b.settings); // last: the dashboard leaves onboarding once settings exist
console.log(`imported into users/${db.uid}: profile, ${b.facts.length} facts, ${Object.keys(b.realApps).length} genuine application(s), settings`);
process.exit(0);
