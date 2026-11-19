// Read-only: runs the scanner with a real user's saved settings and explains every skip.
import { scanAll } from "../sources/index";
import { userDb } from "../db";

const db = userDb(process.env.REAL_UID!);
const s = (await db.get("settings", "main"))!;
console.log("settings:", JSON.stringify({ roles: s.roles, countries: s.countries, workModes: s.workModes, seniority: s.seniority, sites: s.enabledSites }));
const r = await scanAll(s, { limitPerSource: 200 });
console.log("per source:", JSON.stringify(r.counts), "errors:", r.errors.map((e) => e.source).join(",") || "none");
const reasons = new Map<string, number>();
for (const k of r.skipped) {
  const key = (k.reason ?? "?").replace(/"[^"]*"/, '"…"');
  reasons.set(key, (reasons.get(key) ?? 0) + 1);
}
console.log("\nskipped by reason:");
for (const [k, v] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log("\nkept:");
for (const j of r.jobs) console.log(`  ${j.title} — ${j.company} — ${j.location} — ${j.source}`);
console.log("\nexamples of design jobs dropped only for location:");
for (const k of r.skipped.filter((x) => /location|worldwide|remote/i.test(x.reason ?? "")).slice(0, 12)) console.log(`  ${k.job.title} — ${k.job.company} — ${k.job.location.slice(0, 70)} → ${k.reason}`);
process.exit(0);
