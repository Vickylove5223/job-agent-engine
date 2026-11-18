// Self-test for the AI module.
//   npx tsx --env-file=.env src/ai/selftest.ts
// Without MODEL_API_KEY only the offline checks run.
import { readFile } from "node:fs/promises";
import type { Job, Profile, Resume, Settings } from "@shared/types";
import type { FieldQuestion } from "../contracts";
import { hasModelKey, modelName } from "./client";
import { ai, answeredByFacts, coverLetterIssues, requiredLanguages } from "./index";
import { answerDeterministic } from "./fields";
import { numbersIn, verifyTailoredDeterministic } from "./verify";

const PDF_PATH = process.env.RESUME_PDF ?? "";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
  }
}

// ---------------- fixtures ----------------
const profile: Profile = {
  fullName: "Ada Test Example",
  email: "ada@example.com",
  phone: "+31 6 1234 5678",
  location: "Amsterdam, Netherlands",
  country: "NL",
  links: { linkedin: "https://linkedin.com/in/ada-example", portfolio: "https://ada.example.com" },
  standardAnswers: {
    workAuthorization: "Yes",
    needsSponsorship: "No",
    noticePeriod: "1 month",
    salaryExpectation: "€65,000 per year",
    yearsExperience: "6",
  },
};

const job: Job = {
  source: "greenhouse",
  externalId: "123",
  url: "https://example.com/jobs/123",
  applyUrl: "https://example.com/jobs/123/apply",
  applyMethod: "greenhouse",
  title: "Senior Product Designer",
  company: "Acme",
  location: "Amsterdam",
  remote: false,
  description:
    "We are looking for a Senior Product Designer to own end-to-end design of our checkout. Requirements: 5+ years of product design, Figma, design systems, user research. Fluent Dutch is required. We do not offer visa sponsorship.",
  foundAt: "2026-11-18T00:00:00Z",
  status: "new",
  attempts: 0,
  updatedAt: "2026-11-18T00:00:00Z",
};

const master: Resume = {
  summary: "Product designer with 6 years of experience in fintech and e-commerce.",
  skills: { productDesign: ["Interaction design", "Design systems", "Prototyping"], tools: ["Figma", "Maze"] },
  experience: [
    {
      company: "Payly",
      title: "Product Designer",
      location: "Lagos",
      start: "Jan 2021",
      end: "Present",
      bullets: ["Redesigned checkout, raising conversion by 18%.", "Built a design system used by 4 product teams."],
    },
    {
      company: "Shopit",
      title: "UI/UX Designer",
      start: "Mar 2018",
      end: "Dec 2020",
      bullets: ["Ran 30 usability tests per quarter.", "Designed the seller onboarding flow."],
    },
  ],
  education: [{ school: "University of Lagos", degree: "B.Sc. Computer Science", start: "2013", end: "2017" }],
  certifications: [{ name: "Google UX Design Certificate", issued: "2020" }],
  projects: [],
  awards: [],
  languages: ["English"],
  interests: [],
};
const facts = ["I need visa sponsorship to work in the Netherlands.", "I have used Framer for 2 years."];

const settings: Settings = {
  paused: false,
  roles: ["Product Designer"],
  includeKeywords: [],
  excludeKeywords: [],
  countries: ["NL"],
  locations: ["Amsterdam"],
  workModes: ["remote", "hybrid", "onsite"],
  jobTypes: ["full_time"],
  enabledSites: [],
  remoteOnly: false,
  minSalary: null,
  currency: "EUR",
  seniority: ["mid", "senior"],
  blockedCompanies: [],
  thresholds: { apply: 75, tailor: 60 },
  dailyCaps: { linkedin: 10, indeed: 10, ats: 20 },
  pacingMinutes: { min: 3, max: 9 },
  targetCompanies: [],
  coverLetter: { mode: "when_required", tone: "professional" },
};

const f = (label: string, type: FieldQuestion["type"] = "text", options?: string[], required = true): FieldQuestion => ({ label, type, options, required });
const det = (field: FieldQuestion, factsIn: string[] = facts) => answerDeterministic({ field, profile, facts: factsIn, job });

// ---------------- offline checks ----------------
async function offline() {
  console.log("\n[offline] PDF extraction");
  const pdf = await readFile(PDF_PATH).catch(() => null);
  if (!pdf) {
    check(`PDF exists at ${PDF_PATH}`, false);
  } else {
    const text = await ai.resumeTextFromPdf(pdf.toString("base64"));
    check("extracted text is non-trivial (> 500 chars)", text.length > 500, text.length);
    check("no runs of 3+ newlines / double spaces", !/\n{3,}| {2,}/.test(text));
    console.log(`        ${text.length} chars; first line: ${JSON.stringify(text.split("\n")[0])}`);
  }

  console.log("\n[offline] deterministic answerField");
  const cases: [string, FieldQuestion, (a: ReturnType<typeof det>) => boolean][] = [
    ["first name", f("First Name"), (a) => a?.answer === "Ada" && a.confidence === 1],
    ["last name", f("Last name"), (a) => a?.answer === "Test Example"],
    ["full name", f("Full name"), (a) => a?.answer === "Ada Test Example"],
    ["email", f("Email address", "email"), (a) => a?.answer === "ada@example.com"],
    ["phone", f("Phone", "tel"), (a) => a?.answer === profile.phone],
    ["city", f("City"), (a) => a?.answer === "Amsterdam"],
    ["country (select)", f("Country", "select", ["Germany", "Netherlands", "Nigeria"]), (a) => a?.answer === "Netherlands"],
    ["linkedin", f("LinkedIn Profile", "url"), (a) => a?.answer === profile.links.linkedin],
    ["portfolio", f("Portfolio / Website", "url"), (a) => a?.answer === profile.links.portfolio],
    ["how did you hear (text)", f("How did you hear about us?"), (a) => a?.answer === "Company website" && a.confidence === 0.9],
    ["how did you hear (select)", f("How did you hear about this job?", "select", ["LinkedIn", "Referral", "Company Website", "Other"]), (a) => a?.answer === "Company Website"],
    ["salary", f("Salary expectations"), (a) => a?.answer === "€65,000 per year" && a.confidence >= 0.8],
    ["salary (number)", f("Desired salary", "number"), (a) => a?.answer === "65000"],
    ["notice period", f("What is your notice period?"), (a) => a?.answer === "1 month"],
    ["work auth (radio)", f("Are you legally authorized to work in the Netherlands?", "radio", ["Yes", "No"]), (a) => a?.answer === "Yes"],
    ["work auth other country → model", f("Are you legally authorized to work in the United States?", "radio", ["Yes", "No"]), (a) => a === null],
    ["sponsorship (radio)", f("Will you now or in the future require visa sponsorship?", "radio", ["Yes", "No"]), (a) => a?.answer === "No"],
    ["gender EEO", f("Gender", "select", ["Male", "Female", "Non-binary", "Decline to self-identify"]), (a) => a?.answer === "Decline to self-identify"],
    ["veteran EEO", f("Veteran status", "radio", ["I am a veteran", "I am not a veteran", "I prefer not to answer"]), (a) => a?.answer === "I prefer not to answer"],
    ["race EEO (text)", f("Race / Ethnicity"), (a) => a?.answer === "Prefer not to say"],
    ["years experience (number)", f("Years of experience", "number"), (a) => a?.answer === "6"],
    ["years with Figma → model", f("How many years of experience do you have with Figma?", "number"), (a) => a === null],
    ["degree question → model", f("Do you have a Master's degree?", "radio", ["Yes", "No"]), (a) => a === null],
    ["resume upload", f("Resume/CV", "file"), (a) => a?.answer === "resume"],
  ];
  for (const [name, field, ok] of cases) {
    const a = det(field);
    check(name, ok(a), a);
  }
  // sponsorship from a fact (no standard answer)
  {
    const p2: Profile = { ...profile, standardAnswers: {} };
    const a = answerDeterministic({ field: f("Do you require sponsorship?", "radio", ["Yes", "No"]), profile: p2, facts, job });
    check("sponsorship from fact → Yes", a?.answer === "Yes", a);
    const b = answerDeterministic({ field: f("Salary expectation"), profile: p2, facts: [], job });
    check("salary unknown → low confidence", !!b && b.confidence < 0.8, b);
  }

  console.log("\n[offline] tailoring verifier");
  check("master vs itself passes", verifyTailoredDeterministic(master, master, facts).length === 0, verifyTailoredDeterministic(master, master, facts));
  const reworded: Resume = {
    ...master,
    summary: "Product designer with 6 years in fintech checkout and design systems.",
    skills: { tools: ["Figma", "Framer"], productDesign: ["Design systems", "Prototyping"] },
    experience: [
      { ...master.experience[0]!, bullets: ["Built a design system used by 4 product teams.", "Redesigned checkout, lifting conversion 18%."] },
      master.experience[1]!,
    ],
  };
  const rv = verifyTailoredDeterministic(master, reworded, facts);
  check("honest rewording (skill from fact) passes", rv.length === 0, rv);
  const fabricated: Resume = {
    ...master,
    summary: "Lead product designer with 10 years of experience who managed a team of 12.",
    skills: { ...master.skills, tools: ["Figma", "Maze", "Sketch"] },
    experience: [
      { ...master.experience[0]!, title: "Lead Product Designer", bullets: ["Raised conversion by 45%."] },
      master.experience[1]!,
      { company: "Google", title: "Designer", start: "2016", end: "2018", bullets: ["Designed Search."] },
    ],
    education: [{ school: "Stanford University", degree: "M.Sc. HCI", start: "2017", end: "2018" }],
    certifications: [...master.certifications, { name: "Certified Scrum Master" }],
  };
  const fv = verifyTailoredDeterministic(master, fabricated, facts);
  check("fabricated resume is REJECTED", fv.length > 0);
  const expect = (re: RegExp, what: string) => check(`  flags ${what}`, fv.some((v) => re.test(v)), fv);
  expect(/Experience entry not in master: google/i, "invented employer");
  expect(/lead product designer/i, "changed title");
  expect(/Education entry not in master: stanford/i, "invented degree");
  expect(/Certification.*Scrum/i, "invented certification");
  expect(/Skill.*Sketch/i, "invented skill");
  expect(/Number.*\b10\b/, "invented number 10");
  expect(/Number.*\b45\b/, "invented metric 45%");

  console.log("\n[offline] helpers");
  check("numbersIn normalizes 1,200 and 40%", JSON.stringify(numbersIn("1,200 users, 40% faster, 3.5x")) === JSON.stringify(["1200", "40", "3.5"]), numbersIn("1,200 users, 40% faster, 3.5x"));
  check("requiredLanguages finds Dutch", JSON.stringify(requiredLanguages(job.description)) === '["Dutch"]', requiredLanguages(job.description));
  check("requiredLanguages ignores 'German is a plus'", requiredLanguages("German is a plus.").length === 0);
  check("answeredByFacts: Dutch already answered", answeredByFacts("Do you speak Dutch?", ["I speak Dutch at B1 level"]));
  check("answeredByFacts: unrelated fact", !answeredByFacts("Do you speak Dutch?", facts));
  const cl = coverLetterIssues("Dear [Company] team, I am passionate about design and grew revenue 300%.\n\nBest regards,\nSomeone", [master.summary], profile.fullName);
  check("cover letter checker flags placeholder, cliché, number, signature", cl.length >= 4, cl);
}

// ---------------- online checks ----------------
async function online() {
  console.log(`\n[online] model ${modelName()}`);
  const pdf = await readFile(PDF_PATH);
  const text = await ai.resumeTextFromPdf(pdf.toString("base64"));
  const structured = await ai.structureResume(text);
  check("structureResume: has experience", structured.experience.length > 0, structured.experience.length);
  check("structureResume: has skills", Object.keys(structured.skills).length > 0, Object.keys(structured.skills));
  check(
    "structureResume: bullets are verbatim substrings of the PDF text",
    structured.experience.flatMap((e) => e.bullets).every((b) => text.replace(/\s+/g, " ").includes(b.replace(/\s+/g, " ").slice(0, 40))),
  );

  const s = await ai.scoreJob({ resumeText: text, facts, settings, job });
  console.log("        score:", s.score, s.reasons);
  check("scoreJob: no-sponsorship + needs sponsorship → ≤ 30", s.score <= 30, s.score);
  check("scoreJob: asks about Dutch", s.questions.some((q) => /dutch/i.test(q.text)), s.questions);
  const s2 = await ai.scoreJob({ resumeText: text, facts: [...facts, "I do not speak Dutch."], settings, job });
  check("scoreJob: does not re-ask Dutch when a fact answers it", !s2.questions.some((q) => /dutch/i.test(q.text)), s2.questions);

  const t = await ai.tailorResume({ master, facts, job });
  console.log("        changes:", t.changes);
  check("tailorResume: result passes deterministic verifier", verifyTailoredDeterministic(master, t.resume, facts).length === 0);

  const letter = await ai.writeCoverLetter({ profile, resumeText: text, facts, job, tone: "professional" });
  check("coverLetter: ≤ 250 words", letter.split(/\s+/).length <= 250);
  check("coverLetter: signed", letter.trim().endsWith(profile.fullName));

  const deg = await ai.answerField({ field: f("Do you have a Master's degree?", "radio", ["Yes", "No"]), profile, facts, job });
  console.log("        master's degree answer:", deg);
  check("answerField: degree not guessed yes with high confidence", !(deg.answer === "Yes" && deg.confidence >= 0.8));
}

await offline();
if (hasModelKey()) await online();
else console.log("\nMODEL_API_KEY is not set — skipped online (Gemini) checks. Add it to agent/.env to run them.");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
