// Read-only summary of a real user's data. Usage: OWNER_EMAIL=... npx tsx src/dev/inspect-real.ts
import { getAuth } from "firebase-admin/auth";
import { firestore } from "../db";

const email = process.env.OWNER_EMAIL!;
firestore();
const user = await getAuth().getUserByEmail(email);
console.log(`uid=${user.uid} created=${user.metadata.creationTime}`);
const root = firestore().collection("users").doc(user.uid);
for (const c of await root.listCollections()) {
  const s = await c.get();
  console.log(`\n${c.id}: ${s.size}`);
  if (c.id === "jobs") for (const d of s.docs) { const j = d.data(); console.log(`  ${d.id.slice(0, 26).padEnd(26)} ${String(j.status).padEnd(13)} sample=${!!j.sample} ${j.score?.master ?? "-"} ${j.title} @ ${j.company} | ${j.applyUrl}`); }
  if (c.id === "applications") for (const d of s.docs) { const a = d.data(); console.log(`  ${d.id.slice(0, 26).padEnd(26)} shot=${!!a.screenshotJpegBase64} notes=${(a.notes ?? "").slice(0, 50)}`); }
  if (c.id === "settings") { const x = s.docs[0]?.data() ?? {}; console.log("  ", JSON.stringify({ roles: x.roles, countries: x.countries, workModes: x.workModes, seniority: x.seniority, enabledSites: x.enabledSites, thresholds: x.thresholds, paused: x.paused, minSalary: x.minSalary, currency: x.currency })); }
  if (c.id === "profile") { const x = s.docs[0]?.data() ?? {}; console.log("  ", x.fullName, "|", x.email, "| resume:", x.masterResume?.fileName, x.masterResume?.pdfBase64 ? `${Math.round(x.masterResume.pdfBase64.length / 1365)}KB` : "no pdf", "| text:", !!x.masterResume?.text); }
}
process.exit(0);
