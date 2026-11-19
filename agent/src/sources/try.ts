// Live smoke test for the job scanner.
//   npx tsx src/sources/try.ts                  scan with a sample "Product Designer in NL" profile
//   npx tsx src/sources/try.ts --skipped        also print a sample of skip reasons
//   npx tsx src/sources/try.ts --verify-boards  re-check every seed board in companies.ts
import type { Settings } from "@shared/types";
import { BOARDS, type Board } from "./companies";
import { ALL_SOURCES, scanAll } from "./index";
import { fetchJson, pool } from "./util";

const args = new Set(process.argv.slice(2));

function sampleSettings(): Settings {
  return {
    paused: false,
    roles: ["Product Designer"],
    includeKeywords: [],
    excludeKeywords: [],
    countries: ["NL"],
    locations: [],
    workModes: ["hybrid", "onsite", "remote"],
    jobTypes: ["full_time"],
    enabledSites: ALL_SOURCES.map((s) => s.id).filter((id) => id !== "adzuna"),
    remoteOnly: false,
    minSalary: 48000,
    currency: "USD",
    seniority: ["mid", "senior"],
    blockedCompanies: [],
    thresholds: { apply: 75, tailor: 60 },
    dailyCaps: { linkedin: 10, indeed: 10, ats: 20 },
    pacingMinutes: { min: 3, max: 8 },
    targetCompanies: [],
    coverLetter: { mode: "when_required", tone: "professional" },
  };
}

async function verifyBoards() {
  const url = (b: Board) =>
    b.ats === "greenhouse" ? `https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs`
    : b.ats === "lever" ? `https://api${b.eu ? ".eu" : ""}.lever.co/v0/postings/${b.slug}?mode=json`
    : b.ats === "ashby" ? `https://api.ashbyhq.com/posting-api/job-board/${b.slug}`
    : `https://apply.workable.com/api/v1/widget/accounts/${b.slug}`;
  let ok = 0;
  const bad: string[] = [];
  await pool(BOARDS, 8, async (b) => {
    try {
      const data = await fetchJson<{ jobs?: unknown[] } | unknown[]>(url(b));
      const n = Array.isArray(data) ? data.length : (data.jobs?.length ?? 0);
      if (n > 0) ok++;
      else bad.push(`${b.ats}/${b.slug}: 0 jobs`);
    } catch (e) {
      bad.push(`${b.ats}/${b.slug}: ${(e as Error).message}`);
    }
  });
  const nl = BOARDS.filter((b) => b.countries.includes("NL")).length;
  console.log(`boards: ${ok}/${BOARDS.length} live (NL-hiring: ${nl})`);
  for (const b of bad) console.log("  ✗", b);
}

async function main() {
  if (args.has("--verify-boards")) return verifyBoards();

  const settings = sampleSettings();
  const t0 = Date.now();
  const res = await scanAll(settings, { limitPerSource: 100 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\nScan finished in ${secs}s — roles ${JSON.stringify(settings.roles)}, countries ${settings.countries}, modes ${settings.workModes}\n`);
  console.log("source            fetched  kept");
  for (const id of Object.keys(res.counts)) {
    console.log(`  ${id.padEnd(16)}${String(res.counts[id]).padStart(7)}${String(res.kept[id] ?? 0).padStart(6)}`);
  }
  console.log(`  ${"TOTAL".padEnd(16)}${String(Object.values(res.counts).reduce((a, b) => a + b, 0)).padStart(7)}${String(res.jobs.length).padStart(6)}`);

  if (res.errors.length) {
    console.log(`\nErrors (${res.errors.length}):`);
    for (const e of res.errors.slice(0, 20)) console.log(`  [${e.source}] ${e.message}`);
  }

  const reasons = new Map<string, number>();
  for (const s of res.skipped) {
    const key = s.reason.replace(/".*"/, '"…"').replace(/limited to .*/, "limited to …").replace(/duplicate of .*/, "duplicate");
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  console.log(`\nSkipped ${res.skipped.length}:`);
  for (const [r, n] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(n).padStart(4)}  ${r}`);
  if (args.has("--skipped")) {
    for (const s of res.skipped.slice(0, 40)) console.log(`   - ${s.job.title} — ${s.job.company} — ${s.job.location} :: ${s.reason}`);
  }

  console.log(`\nFirst 15 kept jobs (of ${res.jobs.length}):`);
  for (const j of res.jobs.slice(0, 15)) {
    console.log(`  ${j.title} — ${j.company} — ${(j.location || "?").slice(0, 70)}${j.remote ? " (remote)" : ""} — ${j.applyMethod}  [${j.source}]`);
  }
  if (args.has("--all")) for (const j of res.jobs.slice(15)) console.log(`  ${j.title} — ${j.company} — ${j.location.slice(0, 70)} — ${j.applyMethod}  [${j.source}]`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
