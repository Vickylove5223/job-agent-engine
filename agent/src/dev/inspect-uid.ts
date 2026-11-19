// Read-only summary of users/{UID}. Usage: UID_TO_INSPECT=... npx tsx src/dev/inspect-uid.ts
import { firestore } from "../db";
const root = firestore().collection("users").doc(process.env.UID_TO_INSPECT!);
const p = (await root.collection("profile").doc("main").get()).data() ?? {};
console.log("PROFILE:", p.fullName, "|", p.email, "|", p.phone, "|", p.location, p.country, "| links:", JSON.stringify(p.links), "| resume:", p.masterResume?.fileName, p.masterResume?.pdfBase64 ? "pdf ok" : "no pdf");
console.log("STANDARD:", JSON.stringify(p.standardAnswers));
const s = (await root.collection("settings").doc("main").get()).data() ?? {};
console.log("SETTINGS:", JSON.stringify({ roles: s.roles, countries: s.countries, locations: s.locations, workModes: s.workModes, seniority: s.seniority, jobTypes: s.jobTypes, minSalary: s.minSalary, currency: s.currency, enabledSites: s.enabledSites, thresholds: s.thresholds, paused: s.paused }));
const q = await root.collection("questions").get();
console.log(`QUESTIONS: ${q.size}`); for (const d of q.docs) { const x = d.data(); if (x.status === "answered") console.log("  answered:", x.text.slice(0, 70), "→", String(x.answer).slice(0, 60)); }
const j = await root.collection("jobs").limit(3).get();
for (const d of j.docs) { const x = d.data(); console.log("JOB:", x.status, x.sample, x.title, "@", x.company, x.applyUrl); }
process.exit(0);
