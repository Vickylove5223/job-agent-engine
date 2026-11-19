// Final step: write everything the wizard collected. Settings go LAST — App.tsx leaves the
// wizard as soon as settings/main has onboardedAt.
import type { Fact, FactCategory, Job, Profile, Question, Settings, StandardAnswers } from "@shared/types";
import { countryName } from "@shared/sites";
import { addDocument, logActivity, nowIso, setDocument } from "@/lib/db";
import {
  JOB_TYPE_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS,
  formatMoney,
  labelOf,
  onlyRemote,
  yearlySalary,
  type Draft,
} from "./draft";

const yesNo = (b: boolean) => (b ? "Yes" : "No");
const capOf = (s: string, fallback: number) => {
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 && s.trim() !== "" ? n : fallback;
};

export function placesSummary(d: Draft) {
  const parts = [
    d.countries.length ? d.countries.map(countryName).join(", ") : null,
    d.workModes.includes("remote") ? "remote" : null,
  ].filter(Boolean);
  return parts.join(" + ") || "anywhere";
}

export async function launchAgent(d: Draft, email: string) {
  const now = nowIso();
  const salary = yearlySalary(d);
  const enabledSites = d.enabledSites ?? ["greenhouse", "lever", "ashby", "remoteok", "remotive"];
  const roles = d.roles;
  const years = d.yearsExperience.trim();

  // ---- 1. Profile ----
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
  if (d.resume) {
    profile.masterResume = {
      fileName: d.resume.fileName,
      uploadedAt: now,
      pdfBase64: d.resume.base64,
    };
  }
  await setDocument("profile", "main", profile);

  // ---- 2. Facts ----
  const facts: [string, FactCategory][] = [];
  if (standardAnswers.workAuthorization)
    facts.push([`Work authorization: ${standardAnswers.workAuthorization}`, "logistics"]);
  facts.push([`Needs visa sponsorship: ${yesNo(d.sponsorship)}`, "logistics"]);
  if (standardAnswers.noticePeriod)
    facts.push([`Notice period: ${standardAnswers.noticePeriod}`, "logistics"]);
  facts.push([`Open to relocating: ${yesNo(d.relocate)}`, "logistics"]);
  if (d.country)
    facts.push([`Lives in: ${[d.city.trim(), countryName(d.country)].filter(Boolean).join(", ")}`, "logistics"]);
  if (salary !== null)
    facts.push([`Minimum salary: ${formatMoney(d.currency, salary)}/year`, "preference"]);
  if (years) facts.push([`Years of experience: ${years}`, "skill"]);
  facts.push([`Target roles: ${roles.join(", ")}`, "preference"]);
  if (d.seniority.length)
    facts.push([
      `Seniority: ${d.seniority.map((s) => labelOf(SENIORITY_OPTIONS, s)).join(", ")}`,
      "preference",
    ]);
  facts.push([
    `Work modes: ${d.workModes.map((m) => labelOf(WORK_MODE_OPTIONS, m)).join(", ")}`,
    "preference",
  ]);
  if (d.countries.length)
    facts.push([`Target countries: ${d.countries.map(countryName).join(", ")}`, "preference"]);
  if (d.cities.length)
    facts.push([`Preferred cities/regions: ${d.cities.join(", ")}`, "preference"]);
  facts.push([
    `Job types: ${d.jobTypes.map((t) => labelOf(JOB_TYPE_OPTIONS, t)).join(", ")}`,
    "preference",
  ]);
  if (d.includeKeywords.length)
    facts.push([`Key skills: ${d.includeKeywords.join(", ")}`, "skill"]);

  // Add any AI-extracted facts from resume/portfolio
  if (d.extractedFacts?.length) {
    for (const ef of d.extractedFacts) {
      facts.push([ef, "experience"]);
    }
  }

  for (const [text, category] of facts) {
    const fact: Fact = { text, category, source: "resume", createdAt: now, updatedAt: now };
    await addDocument("facts", fact);
  }

  // ---- 3. Save Confirmed Screening Questions ----
  if (d.prefilledQuestions?.length) {
    for (const q of d.prefilledQuestions) {
      const qDoc: Question = {
        text: q.text,
        whyNeeded: q.whyNeeded,
        origin: "profile",
        jobIds: [],
        inputType: q.inputType,
        options: q.options,
        status: "answered",
        answer: q.answer,
        suggestedAnswer: q.answer,
        saveAsFact: true,
        createdAt: now,
        answeredAt: now,
      };
      await addDocument("questions", qDoc);
    }
  }

  // ---- 4. Save Matched Jobs ----
  const jobsToSave: Job[] = d.matchedJobs?.length ? d.matchedJobs : [];
  for (const j of jobsToSave) {
    const jobId = j.externalId || `job-${Math.random().toString(36).slice(2, 10)}`;
    await setDocument("jobs", jobId, {
      ...j,
      foundAt: now,
      updatedAt: now,
    });
  }

  // ---- 5. Signal Auto-Apply First 10 on Dashboard Mount ----
  try {
    sessionStorage.setItem("job_agent_auto_apply_first_10", "true");
  } catch {
    /* ignore */
  }

  // ---- 6. Worker status ----
  await setDocument("workerStatus", "main", {
    state: "discovering",
    heartbeatAt: now,
    appliedToday: { linkedin: 0, indeed: 0, ats: 0 },
    sessions: { linkedin: "unknown", indeed: "unknown" },
    version: "agent-0.1",
  });

  await logActivity(
    "success",
    "onboarding",
    `Agent setup complete: ${roles.join(", ")} in ${placesSummary(d)}; initial ${jobsToSave.length} jobs discovered.`,
  );

  // ---- 7. Settings (last — switches to dashboard) ----
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
    dailyCaps: {
      linkedin: capOf(d.capLinkedin, 15),
      indeed: capOf(d.capIndeed, 15),
      ats: capOf(d.capAts, 30),
    },
    pacingMinutes: { min: 4, max: 15 },
    targetCompanies: [],
    coverLetter: { mode: d.coverLetter, tone: "professional" },
  };
  await setDocument("settings", "main", settings);
}
