// Client-side AI service for resume parsing, question generation, and prefilling.
import { type ResumeFile, type Draft } from "@/pages/onboarding/draft";
import { countryName, COUNTRIES } from "@shared/sites";
import type { Seniority } from "@shared/types";

// SECURITY: never ship a model key in the public bundle. Only local dev (private .env) may call
// Gemini from the browser; in production these helpers fall back to their non-AI paths and the
// cloud agent does the AI work server-side.
const GEMINI_KEY: string = import.meta.env.DEV ? (import.meta.env.VITE_GEMINI_API_KEY ?? "") : "";
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"];

function normalizeCountryCode(countryStr?: string): string {
  if (!countryStr) return "US";
  const trimmed = countryStr.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const hit = COUNTRIES.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  return hit ? hit.code : "US";
}

function normalizeSeniority(val: unknown): Seniority[] {
  const allowed: Seniority[] = ["intern", "junior", "mid", "senior", "lead"];
  if (Array.isArray(val)) {
    const res = val
      .map((s) => String(s).toLowerCase().trim())
      .filter((s): s is Seniority => allowed.includes(s as Seniority));
    if (res.length > 0) return res;
  } else if (typeof val === "string") {
    const s = val.toLowerCase().trim();
    const hit = allowed.find((a) => s.includes(a));
    if (hit) return [hit];
  }
  return ["mid"];
}

function normalizeUrl(url?: string): string {
  if (!url || !url.trim()) return "";
  let clean = url.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }
  return clean;
}

function normalizeLinkedIn(url?: string): string {
  if (!url || !url.trim()) return "";
  let clean = url.trim();
  if (clean.startsWith("@")) clean = clean.slice(1);
  if (!clean.includes("linkedin.com")) {
    return `https://linkedin.com/in/${clean}`;
  }
  return normalizeUrl(clean);
}

export interface ExtractedProfileData {
  fullName: string;
  email: string;
  phone: string;
  headline: string;
  country: string;
  city: string;
  roles: string[];
  seniority: Seniority[];
  yearsExperience: string;
  skills: string[];
  portfolio: string;
  linkedin: string;
  github: string;
  workAuthorization: string;
  noticePeriod: string;
  salaryExpectation: string;
  summary: string;
  facts: string[];
}

export interface PrefilledQuestion {
  id: string;
  text: string;
  whyNeeded: string;
  inputType: "text" | "yes_no" | "choice";
  options?: string[];
  answer: string;
  category: "authorization" | "experience" | "logistics" | "skills" | "compensation";
}

async function callGemini(parts: unknown[]): Promise<string | null> {
  if (!GEMINI_KEY) return null;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch {
      // Try next model
    }
  }
  return null;
}

/** Fallback heuristic parser if Gemini API is unreachable */
function heuristicExtract(fileName: string, portfolioUrl = "", authEmail = ""): ExtractedProfileData {
  const cleanName = fileName
    .replace(/\.pdf$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b(resume|cv|portfolio|v\d+|\d{4})\b/gi, "")
    .trim() || (authEmail ? authEmail.split("@")[0].replace(/[._]/g, " ") : "Candidate");

  const formattedName = cleanName
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  const lowerName = fileName.toLowerCase();
  let roles = ["Full-stack Developer", "Frontend Developer"];
  let skills = ["JavaScript", "TypeScript", "React", "Node.js", "Git"];
  let headline = "Software Engineer";

  if (lowerName.includes("design") || lowerName.includes("ui") || lowerName.includes("ux")) {
    roles = ["Product Designer", "UI/UX Designer"];
    skills = ["Figma", "User Research", "Wireframing", "Prototyping", "Design Systems"];
    headline = "Product Designer & UX Specialist";
  } else if (lowerName.includes("product") || lowerName.includes("pm")) {
    roles = ["Product Manager", "Associate Product Manager"];
    skills = ["Product Strategy", "Roadmapping", "Agile/Scrum", "Data Analysis", "User Stories"];
    headline = "Product Manager";
  } else if (lowerName.includes("data") || lowerName.includes("analyst")) {
    roles = ["Data Analyst", "Business Intelligence Analyst"];
    skills = ["SQL", "Python", "Tableau", "Power BI", "Excel", "Data Modeling"];
    headline = "Data & Analytics Specialist";
  }

  return {
    fullName: formattedName,
    email: authEmail || "",
    phone: "",
    headline,
    country: "US",
    city: "",
    roles,
    seniority: ["mid"],
    yearsExperience: "4",
    skills,
    portfolio: portfolioUrl,
    linkedin: "",
    github: "",
    workAuthorization: "Authorized to work in country of residence",
    noticePeriod: "2 weeks",
    salaryExpectation: "",
    summary: "",
    facts: [
      `Key skills: ${skills.join(", ")}`,
      `Target roles: ${roles.join(", ")}`,
      `Experience level: Mid-level professional`,
    ],
  };
}

export async function parseResumeAndPortfolio(
  resume: ResumeFile,
  portfolioUrl = "",
  authEmail = "",
): Promise<ExtractedProfileData> {
  const fallback = heuristicExtract(resume.fileName, portfolioUrl, authEmail);

  try {
    const prompt = `You are a recruitment AI. Analyze this candidate's resume PDF and portfolio URL (${portfolioUrl || "none"}).
Extract the candidate's complete profile information as strict JSON matching this schema:
{
  "fullName": "Full name of candidate",
  "email": "Email address",
  "phone": "Phone number with country code if available",
  "headline": "Short professional headline (e.g. Senior Frontend Engineer with 5+ years experience)",
  "country": "Two-letter ISO country code if identified, e.g. US, NG, GB, DE, CA, IN, etc. Default to US if not determinable",
  "city": "City or state",
  "roles": ["Primary Target Role 1", "Target Role 2"],
  "seniority": ["junior" | "mid" | "senior" | "lead"],
  "yearsExperience": "Number of years as string, e.g. 5",
  "skills": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5", "Skill6"],
  "portfolio": "Portfolio URL or website if found",
  "linkedin": "LinkedIn profile URL if found",
  "github": "GitHub URL if found",
  "workAuthorization": "Work authorization summary or citizenship if mentioned",
  "noticePeriod": "Notice period if mentioned, otherwise '2 weeks' or 'Immediate'",
  "salaryExpectation": "Salary expectation if mentioned",
  "summary": "Brief 1-2 sentence professional summary",
  "facts": ["3 to 6 key verifiable facts about experience, achievements, tools, education"]
}`;

    const parts = [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: resume.base64,
        },
      },
      { text: prompt },
    ];

    const rawJson = await callGemini(parts);
    if (!rawJson) return fallback;

    const parsed = JSON.parse(rawJson);
    return {
      fullName: parsed.fullName?.trim() || fallback.fullName,
      email: parsed.email?.trim() || authEmail || fallback.email,
      phone: parsed.phone?.trim() || fallback.phone,
      headline: parsed.headline?.trim() || fallback.headline,
      country: normalizeCountryCode(parsed.country || fallback.country),
      city: parsed.city?.trim() || fallback.city,
      roles: Array.isArray(parsed.roles) && parsed.roles.length > 0 ? parsed.roles : fallback.roles,
      seniority: normalizeSeniority(parsed.seniority || fallback.seniority),
      yearsExperience: String(parsed.yearsExperience || fallback.yearsExperience).replace(/[^0-9]/g, "") || "4",
      skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : fallback.skills,
      portfolio: normalizeUrl(portfolioUrl || parsed.portfolio || fallback.portfolio),
      linkedin: normalizeLinkedIn(parsed.linkedin || fallback.linkedin),
      github: normalizeUrl(parsed.github || fallback.github),
      workAuthorization: parsed.workAuthorization?.trim() || fallback.workAuthorization,
      noticePeriod: parsed.noticePeriod?.trim() || fallback.noticePeriod,
      salaryExpectation: parsed.salaryExpectation?.trim() || fallback.salaryExpectation,
      summary: parsed.summary?.trim() || fallback.summary,
      facts: Array.isArray(parsed.facts) && parsed.facts.length > 0 ? parsed.facts : fallback.facts,
    };
  } catch (err) {
    console.warn("Gemini parse failed, falling back to heuristic:", err);
    return fallback;
  }
}

export function generatePrefilledQuestions(draft: Draft): PrefilledQuestion[] {
  const targetLocations = [
    draft.countries.length ? draft.countries.map(countryName).join(", ") : null,
    draft.workModes.includes("remote") ? "Remote" : null,
  ].filter(Boolean).join(" / ") || "worldwide";

  const primaryRole = draft.roles[0] || "Professional";
  const years = draft.yearsExperience ? `${draft.yearsExperience} years` : "Several years";
  const salaryText = draft.minSalary ? `${draft.currency} ${draft.minSalary}/year` : "Competitive market rate";
  const primarySkills = draft.includeKeywords.length > 0 ? draft.includeKeywords.slice(0, 3).join(", ") : "modern tools and best practices";

  return [
    {
      id: "q-work-auth",
      text: `Are you legally authorized to work in ${targetLocations}?`,
      whyNeeded: "Required by employers to verify employment eligibility before interviewing.",
      inputType: "choice",
      options: ["Yes, fully authorized", "Yes, with current work permit", "Will require sponsorship"],
      answer: draft.sponsorship ? "Will require sponsorship" : (draft.workAuthorization || "Yes, fully authorized"),
      category: "authorization",
    },
    {
      id: "q-sponsorship",
      text: "Will you now or in the future require visa sponsorship to work?",
      whyNeeded: "Standard ATS filter question across international and US company job boards.",
      inputType: "yes_no",
      options: ["No", "Yes"],
      answer: draft.sponsorship ? "Yes" : "No",
      category: "authorization",
    },
    {
      id: "q-experience",
      text: `How many years of relevant experience do you have in ${primaryRole}?`,
      whyNeeded: "Used to match you directly against role seniority requirements.",
      inputType: "text",
      answer: `${years} of hands-on professional experience with ${primarySkills}.`,
      category: "experience",
    },
    {
      id: "q-compensation",
      text: "What is your target annual compensation expectation?",
      whyNeeded: "Prefills salary fields on application forms so jobs below your minimum are filtered.",
      inputType: "text",
      answer: salaryText,
      category: "compensation",
    },
    {
      id: "q-notice-period",
      text: "What is your notice period or earliest possible start date?",
      whyNeeded: "Recruiters use this to evaluate onboarding timelines.",
      inputType: "text",
      answer: draft.noticePeriod.trim() || "Immediate to 2 weeks notice.",
      category: "logistics",
    },
    {
      id: "q-work-mode",
      text: "What are your preferred work arrangements?",
      whyNeeded: "Matches you with companies offering your desired flexibility.",
      inputType: "text",
      answer: draft.workModes.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ") || "Remote",
      category: "logistics",
    },
    {
      id: "q-links",
      text: "Portfolio and professional links to accompany your applications:",
      whyNeeded: "Included in every application submission and cover letter header.",
      inputType: "text",
      answer: [draft.portfolio && `Portfolio: ${draft.portfolio}`, draft.linkedin && `LinkedIn: ${draft.linkedin}`].filter(Boolean).join(" | ") || "Provided in resume",
      category: "skills",
    },
  ];
}
