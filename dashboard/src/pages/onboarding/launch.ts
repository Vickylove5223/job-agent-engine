// Final step: write everything the wizard collected. Settings go LAST — App.tsx leaves the
// wizard as soon as settings/main has onboardedAt.
import type { Fact, FactCategory, Profile, Settings, StandardAnswers } from "@shared/types";
import { countryName } from "@shared/sites";
import { addDocument, logActivity, nowIso, setDocument } from "@/lib/db";
import { JOB_TYPE_OPTIONS, SENIORITY_OPTIONS, WORK_MODE_OPTIONS, formatMoney, labelOf, onlyRemote, yearlySalary, type Draft } from "./draft";

const yesNo = (b: boolean) => (b ? "Yes" : "No");
const capOf = (s: string, fallback: number) => {
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 && s.trim() !== "" ? n : fallback;
};

export function placesSummary(d: Draft) {
  const parts = [d.countries.length ? d.countries.map(countryName).join(", ") : null, d.workModes.includes("remote") ? "remote" : null].filter(Boolean);
  return parts.join(" + ") || "anywhere";
}

export async function launchAgent(d: Draft, email: string) {
  const now = nowIso();
  const salary = yearlySalary(d);
  const enabledSites = d.enabledSites ?? [];
  const roles = d.roles;
  const years = d.yearsExperience.trim();

  // ---- profile ----
  const standardAnswers: StandardAnswers = {
    needsSponsorship: yesNo(d.sponsorship),
    willingToRelocate: yesNo(d.relocate),
  };
  if (d.workAuthorization.trim()) standardAnswers.workAuthorization = d.workAuthorization.trim();
  if (d.noticePeriod.trim()) standardAnswers.noticePeriod = d.noticePeriod.trim();
  if (salary !== null) standardAnswers.salaryExpectation = `${formatMoney(d.currency, salary)}+/year`;
  if (years) standardAnswers.yearsExperience = years;

  const links: Profile["links"] = {};
  if (d.linkedin.trim()) links.linkedin = d.linkedin.trim();
  if (d.portfolio.trim()) links.portfolio = d.portfolio.trim();

  const profile: Profile = {
    fullName: d.fullName.trim(),
    email,
    phone: d.phone.trim(),
    location: d.city.trim(),
    links,
    standardAnswers,
  };
  if (d.country) profile.country = d.country;
  if (d.headline.trim()) profile.headline = d.headline.trim();
  if (d.resume) profile.masterResume = { fileName: d.resume.fileName, uploadedAt: now, pdfBase64: d.resume.base64 };
  await setDocument("profile", "main", profile);

  // ---- facts ----
  const facts: [string, FactCategory][] = [];
  if (standardAnswers.workAuthorization) facts.push([`Work authorization: ${standardAnswers.workAuthorization}`, "logistics"]);
  facts.push([`Needs visa sponsorship: ${yesNo(d.sponsorship)}`, "logistics"]);
  if (standardAnswers.noticePeriod) facts.push([`Notice period: ${standardAnswers.noticePeriod}`, "logistics"]);
  facts.push([`Open to relocating: ${yesNo(d.relocate)}`, "logistics"]);
  if (d.country) facts.push([`Lives in: ${[d.city.trim(), countryName(d.country)].filter(Boolean).join(", ")}`, "logistics"]);
  if (salary !== null) facts.push([`Minimum salary: ${formatMoney(d.currency, salary)}/year`, "preference"]);
  if (years) facts.push([`Years of experience: ${years}`, "skill"]);
  facts.push([`Target roles: ${roles.join(", ")}`, "preference"]);
  if (d.seniority.length) facts.push([`Seniority: ${d.seniority.map((s) => labelOf(SENIORITY_OPTIONS, s)).join(", ")}`, "preference"]);
  facts.push([`Work modes: ${d.workModes.map((m) => labelOf(WORK_MODE_OPTIONS, m)).join(", ")}`, "preference"]);
  if (d.countries.length) facts.push([`Wants to work in: ${d.countries.map(countryName).join(", ")}`, "preference"]);
  if (d.cities.length) facts.push([`Preferred cities/regions: ${d.cities.join(", ")}`, "preference"]);
  facts.push([`Job types: ${d.jobTypes.map((t) => labelOf(JOB_TYPE_OPTIONS, t)).join(", ")}`, "preference"]);
  if (d.includeKeywords.length) facts.push([`Key skills: ${d.includeKeywords.join(", ")}`, "skill"]);
  for (const [text, category] of facts) {
    const fact: Fact = { text, category, source: "manual", createdAt: now, updatedAt: now };
    await addDocument("facts", fact);
  }

  // ---- worker status ----
  await setDocument("workerStatus", "main", {
    state: "idle",
    appliedToday: { linkedin: 0, indeed: 0, ats: 0 },
    sessions: { linkedin: "unknown", indeed: "unknown" },
  });

  await logActivity("success", "onboarding", `Agent set up: ${roles.join(", ")} in ${placesSummary(d)}; monitoring ${enabledSites.length} job sites`);

  // ---- settings (last) ----
  const settings: Settings = {
    paused: d.paused,
    onboardedAt: nowIso(),
    roles,
    includeKeywords: d.includeKeywords,
    excludeKeywords: d.excludeKeywords,
    countries: d.countries,
    locations: d.cities,
    workModes: d.workModes,
    jobTypes: d.jobTypes,
    enabledSites,
    remoteOnly: onlyRemote(d),
    minSalary: salary,
    currency: d.currency,
    seniority: d.seniority,
    blockedCompanies: [],
    thresholds: { apply: d.applyThreshold, tailor: Math.max(0, d.applyThreshold - 20) },
    dailyCaps: { linkedin: capOf(d.capLinkedin, 15), indeed: capOf(d.capIndeed, 15), ats: capOf(d.capAts, 30) },
    pacingMinutes: { min: 4, max: 15 },
    targetCompanies: [],
    coverLetter: { mode: d.coverLetter, tone: "professional" },
  };
  await setDocument("settings", "main", settings);
}
