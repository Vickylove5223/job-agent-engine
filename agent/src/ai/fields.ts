// Deterministic answers for common application-form fields (no model call).
import type { Job, Profile } from "@shared/types";
import type { FieldAnswer, FieldQuestion } from "../contracts";

export interface FieldInput {
  field: FieldQuestion;
  profile: Profile;
  facts: string[];
  job: Job;
}

const lc = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const ans = (answer: string, confidence: number, basis: string[]): FieldAnswer => ({ answer, confidence, basis });
const hasOptions = (f: FieldQuestion) => (f.type === "select" || f.type === "radio") && !!f.options?.length;

/** Return the option that best matches one of the candidates (exact, then contains). */
export function pickOption(options: string[], candidates: (string | RegExp)[]): string | undefined {
  for (const c of candidates) {
    const hit = options.find((o) => (typeof c === "string" ? lc(o) === lc(c) : c.test(o)));
    if (hit) return hit;
  }
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const hit = options.find((o) => lc(o).includes(lc(c)));
    if (hit) return hit;
  }
  return undefined;
}

/** "yes" | "no" | undefined from free text such as "Yes, EU citizen" or "No". */
export function yesNo(text: string | undefined): "yes" | "no" | undefined {
  if (!text) return undefined;
  const t = lc(text);
  if (/^(yes|y|true)\b/.test(t)) return "yes";
  if (/^(no|n|false)\b/.test(t)) return "no";
  return undefined;
}

/** Fill a yes/no field (text or select/radio) with a yes/no value. */
function yesNoAnswer(field: FieldQuestion, value: "yes" | "no", confidence: number, basis: string[]): FieldAnswer | null {
  if (hasOptions(field)) {
    const opt = pickOption(field.options!, value === "yes" ? ["Yes", /^yes\b/i] : ["No", /^no\b/i]);
    return opt ? ans(opt, confidence, basis) : null;
  }
  return ans(value === "yes" ? "Yes" : "No", confidence, basis);
}

function factMatching(facts: string[], re: RegExp): string | undefined {
  return facts.find((f) => re.test(f));
}

function countryName(code: string | undefined): string | undefined {
  if (!code) return undefined;
  if (code.length !== 2) return code;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

const EEO_RE = /\b(gender|sex\b|race|racial|ethnic|ethnicity|veteran|disabilit|sexual orientation|pronoun|hispanic|latin[oax]|transgender|demographic|lgbt|self-identify|self identify)/i;
const DECLINE_RE = /prefer not|decline|don'?t wish|do not wish|not wish to|choose not|not to (say|disclose|answer|self)|rather not|i don'?t want/i;

/**
 * Answer common fields without the model. Returns null when the field is not one of the
 * handled kinds (or the data needed is missing in a way the model might still resolve).
 */
export function answerDeterministic({ field, profile, facts, job }: FieldInput): FieldAnswer | null {
  const label = lc(field.label);
  const std = profile.standardAnswers ?? {};
  const nameParts = profile.fullName.trim().split(/\s+/);

  if (field.type === "file") {
    if (/cover/.test(label)) return ans("cover_letter", 1, ["file upload: cover letter"]);
    if (/resume|résumé|\bcv\b|curriculum/.test(label)) return ans("resume", 1, ["file upload: resume"]);
    return ans("", 0, ["unknown file upload"]);
  }

  // "Have you (previously) worked for <this company>?" → answered from work history.
  const company = lc(job.company ?? "").replace(/[^a-z0-9 ]/g, "").trim();
  if (company && /(work|employ|intern)/.test(label) && /(previous|current|ever|before|in the past|former)/.test(label) && (label.includes(company) || /\b(us|our company|this company)\b/.test(label))) {
    const history = [
      ...(profile.masterResume?.structured?.experience ?? []).map((e) => lc(e.company)),
      ...facts.map(lc),
    ].join(" | ");
    if (!history.includes(company)) {
      const no = field.options?.find((o) => /^no\b/i.test(o.trim())) ?? (field.options?.length ? undefined : "No");
      if (no) return ans(no, 0.9, [`${job.company} is not in your work history`]);
    }
  }

  // EEO / demographic → decline
  if (EEO_RE.test(label)) {
    if (field.options?.length) {
      const opt = field.options.find((o) => DECLINE_RE.test(o));
      return opt ? ans(opt, 0.95, ["policy: decline demographic questions"]) : ans("", 0.3, ["no decline option offered"]);
    }
    return ans("Prefer not to say", 0.9, ["policy: decline demographic questions"]);
  }

  // Names
  if (/^(legal )?first name|^given name|^forename/.test(label)) return ans(nameParts[0] ?? "", 1, ["profile.fullName"]);
  if (/^(legal )?(last name|surname|family name)/.test(label)) return ans(nameParts.slice(1).join(" ") || nameParts[0] || "", 1, ["profile.fullName"]);
  if (/^(preferred name|preferred first name)/.test(label)) return ans(nameParts[0] ?? "", 0.9, ["profile.fullName"]);
  if (/^(full |legal )?name\b|^your name|^full legal name/.test(label) && !/company|school|reference|manager/.test(label))
    return ans(profile.fullName, 1, ["profile.fullName"]);

  // Contact
  if (field.type === "email" || /\be-?mail\b/.test(label)) return ans(profile.email, 1, ["profile.email"]);
  if (field.type === "tel" || /\b(phone|mobile|cell|telephone)\b/.test(label)) return ans(profile.phone, 1, ["profile.phone"]);

  // Links
  if (/linkedin/.test(label)) return profile.links.linkedin ? ans(profile.links.linkedin, 1, ["profile.links.linkedin"]) : field.required ? null : ans("", 0.9, ["no LinkedIn on profile"]);
  if (/github/.test(label)) return profile.links.github ? ans(profile.links.github, 1, ["profile.links.github"]) : field.required ? null : ans("", 0.9, ["no GitHub on profile"]);
  if (/portfolio|personal (web)?site|^website|your website|personal url|other website|^url\b/.test(label)) {
    const url = profile.links.portfolio ?? profile.links.github ?? profile.links.linkedin;
    if (url) return ans(url, profile.links.portfolio ? 1 : 0.85, [profile.links.portfolio ? "profile.links.portfolio" : "profile.links (fallback)"]);
    return field.required ? null : ans("", 0.9, ["no portfolio on profile"]);
  }

  // Location
  if (!/relocat|willing|commut|onsite|on-site|office/.test(label)) {
    const city = profile.location.split(",")[0]?.trim() ?? "";
    const country = countryName(profile.country) ?? profile.location.split(",").slice(-1)[0]?.trim();
    if (/^(current )?city\b|city of residence|^town/.test(label)) {
      if (hasOptions(field)) {
        const o = pickOption(field.options!, [city]);
        return o ? ans(o, 0.95, ["profile.location"]) : null;
      }
      return ans(city, 0.95, ["profile.location"]);
    }
    if (/^(current )?country\b|country of residence|which country do you (live|reside)/.test(label) && country) {
      if (hasOptions(field)) {
        const o = pickOption(field.options!, [country, profile.country ?? "\u0000"]);
        return o ? ans(o, 0.95, ["profile.country"]) : null;
      }
      return ans(country, 0.95, ["profile.country"]);
    }
    if (/^(current )?location\b|where are you (located|based)|^(current )?address\b.*city|^based in/.test(label) && !hasOptions(field))
      return ans(profile.location, 0.9, ["profile.location"]);
  }

  // How did you hear
  if (/how did you (hear|find|learn)|where did you (hear|find|see)|referral source|^source\b|how did you come across/.test(label)) {
    if (hasOptions(field)) {
      const o = pickOption(field.options!, ["Company website", /company'?s? (web)?site/i, /career(s)? (page|site)/i, /website/i, /job board/i, /^other$/i]);
      return o ? ans(o, 0.9, ["policy: applied via company website"]) : null;
    }
    return ans("Company website", 0.9, ["policy: applied via company website"]);
  }

  // Salary
  if (/salary|compensation|pay expectation|desired pay|expected pay|rate expectation/.test(label)) {
    const f = std.salaryExpectation ?? factMatching(facts, /salary|compensation|per (year|annum|hour|month)|\bpay\b/i);
    if (!f) return ans("", 0.2, ["no salary expectation on file"]);
    const basis = [std.salaryExpectation ? "standardAnswers.salaryExpectation" : `fact: ${f}`];
    if (field.type === "number") {
      const nums = (f.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/,/g, ""));
      let n = nums[0];
      if (n && /\bk\b/i.test(f) && Number(n) < 1000) n = String(Number(n) * 1000);
      return n ? ans(n, 0.85, basis) : ans("", 0.3, basis);
    }
    if (hasOptions(field)) return null; // ranges need judgement → model
    return ans(f, 0.85, basis);
  }

  // Notice period / start date
  if (/notice period|earliest start|start date|when can you start|available to start|availability to start/.test(label)) {
    const f = std.noticePeriod ?? factMatching(facts, /notice|start date|available to start|can start/i);
    if (!f) return ans("", 0.3, ["no notice period on file"]);
    if (field.type === "date" || hasOptions(field)) return null; // needs conversion → model
    return ans(f, 0.85, [std.noticePeriod ? "standardAnswers.noticePeriod" : `fact: ${f}`]);
  }

  // Sponsorship
  if (/sponsor/.test(label)) {
    const src = std.needsSponsorship ?? factMatching(facts, /sponsor/i);
    let yn = yesNo(std.needsSponsorship);
    if (!yn && src) {
      if (/(do not|don't|does not|doesn't|never|no longer|without)\s+(need|require)[^.]*sponsor|no sponsorship (needed|required)/i.test(src)) yn = "no";
      else if (/(need|require)s?[^.]*sponsor/i.test(src)) yn = "yes";
    }
    if (!yn) return null;
    return yesNoAnswer(field, yn, 0.9, [std.needsSponsorship ? "standardAnswers.needsSponsorship" : `fact: ${src}`]);
  }

  // Work authorization
  if (/authori[sz]ed to work|legally (authori[sz]ed|eligible|permitted|allowed)|right to work|eligible to work|work permit|permission to work/.test(label)) {
    const raw = std.workAuthorization;
    const yn = yesNo(raw);
    // Country-specific question ("...to work in the United States?") — only trust a plain yes if
    // the stored answer mentions that country.
    const m = field.label.match(/\bin (?:the )?([A-Z][A-Za-z.]+(?: [A-Z][A-Za-z.]+)*)/);
    const place = m?.[1];
    if (yn === "no") return yesNoAnswer(field, "no", 0.85, ["standardAnswers.workAuthorization"]);
    if (yn === "yes") {
      if (!place || norm2(raw ?? "").includes(norm2(place)) || norm2(countryName(profile.country) ?? "") === norm2(place))
        return yesNoAnswer(field, "yes", 0.9, ["standardAnswers.workAuthorization"]);
    }
    return null; // model with strict rules (never guesses yes)
  }

  // Relocation
  if (/relocat/.test(label)) {
    const yn = yesNo(std.willingToRelocate);
    if (yn) return yesNoAnswer(field, yn, 0.85, ["standardAnswers.willingToRelocate"]);
    return null;
  }

  // Total years of experience (not "with X")
  const YRS = /years of (professional |total |work )?experience/;
  if (YRS.test(label) && !/\b(with|in|using|as)\b/.test(label.replace(YRS, ""))) {
    if (std.yearsExperience) {
      if (field.type === "number") {
        const n = std.yearsExperience.match(/\d+(\.\d+)?/)?.[0];
        if (n) return ans(n, 0.9, ["standardAnswers.yearsExperience"]);
      } else if (!hasOptions(field)) return ans(std.yearsExperience, 0.9, ["standardAnswers.yearsExperience"]);
    }
    return null;
  }

  return null;
}

const norm2 = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Questions where a guessed "yes" could be a false statement. */
export const LEGAL_RE =
  /authori[sz]|eligib|legal|lawful|citizen|visa|permit|sponsor|certif|licen[cs]e|accredit|degree|bachelor|master'?s|\bphd\b|doctorate|diploma|graduat|clearance|criminal|convict|felony|background check|drug|fluent|speak|language|proficien|native|over 18|18 years|age\b|security/i;
