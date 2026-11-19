// Archives the simulated data the removed in-browser "auto-apply" created: invented jobs
// (sample=true / ids "job-…"), "applications" without an employer confirmation screenshot,
// agency/outreach records. Copied to users/{uid}/_archived_fake/* before removal.
// Usage: TARGET_UID=... [FIRESTORE_EMULATOR_HOST=...] npx tsx src/dev/archive-simulated.ts
import { firestore } from "../db";

const root = firestore().collection("users").doc(process.env.TARGET_UID!);
const archive = root.collection("_archived_fake");
let moved = 0;
async function move(col: string, filter: (id: string, d: FirebaseFirestore.DocumentData) => boolean) {
  for (const d of (await root.collection(col).get()).docs) {
    if (!filter(d.id, d.data())) continue;
    await archive.doc(`${col}__${d.id}`).set({ collection: col, id: d.id, data: d.data(), archivedAt: new Date().toISOString(), reason: "simulated — never actually happened" });
    await d.ref.delete();
    moved++;
  }
}
const fakeJobIds = new Set<string>();
for (const d of (await root.collection("jobs").get()).docs) {
  const j = d.data();
  if (j.sample || String(j.externalId ?? "").startsWith("job-") || /^https:\/\/(jobs\.ashbyhq\.com|boards\.greenhouse\.io|jobs\.lever\.co)\/[^/]+\/?(apply)?$/.test(j.applyUrl ?? "")) fakeJobIds.add(d.id);
}
await move("applications", (id, a) => !a.screenshotJpegBase64 || fakeJobIds.has(id));
await move("jobs", (id) => fakeJobIds.has(id));
for (const c of ["agencies", "outreachCompanies", "coldEmails"]) await move(c, () => true);
await move("activity", (_, a) => ["agency", "outreach"].includes(a.type) || /Auto-applied via agent engine|on first launch/i.test(a.message ?? ""));
console.log(`archived ${moved} simulated records from users/${process.env.TARGET_UID}`);
process.exit(0);
