// Deterministic anti-fabrication checks for tailored resumes and generated text.
import type { Resume } from "@shared/types";

export const norm = (s: string | undefined | null): string =>
  (s ?? "").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

/** Every human-readable string in a resume, joined. */
export function resumeToText(r: Resume): string {
  const parts: string[] = [r.summary];
  for (const [cat, items] of Object.entries(r.skills)) parts.push(`${cat}: ${items.join(", ")}`);
  for (const e of r.experience) {
    parts.push([e.title, e.company, e.location, e.type, e.start, e.end].filter(Boolean).join(" | "));
    parts.push(...e.bullets);
  }
  for (const ed of r.education) parts.push([ed.degree, ed.school, ed.country, ed.start, ed.end, ed.thesis].filter(Boolean).join(" | "));
  for (const c of r.certifications) parts.push([c.name, c.issued].filter(Boolean).join(" "));
  parts.push(...r.projects, ...r.awards, ...r.languages, ...r.interests);
  return parts.filter(Boolean).join("\n");
}

/** Numeric tokens (digits only, separators removed): "1,200" → "1200", "40%" → "40", "3.5x" → "3.5". */
export function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d+(?:[.,]\d+)*/g)) {
    let t = m[0];
    // "1,200" thousands separator → "1200"; "3.5" keeps the decimal point
    if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, "");
    out.push(t.replace(/,/g, "."));
  }
  return out;
}

/** Numbers in `text` that do not occur anywhere in `sources`. */
export function unsupportedNumbers(text: string, sources: string[]): string[] {
  const known = new Set(numbersIn(sources.join("\n")));
  const bad = new Set<string>();
  for (const n of numbersIn(text)) if (!known.has(n)) bad.add(n);
  return [...bad];
}

const expKey = (e: Resume["experience"][number]) => [e.company, e.title, e.start, e.end].map(norm).join(" | ");
const eduKey = (e: Resume["education"][number]) => [e.school, e.degree, e.start, e.end].map(norm).join(" | ");

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
}

/**
 * Deterministic check: companies/titles/dates/education identical to master, no new
 * certifications/languages/awards, no new skills, every number supported by master or facts.
 * Returns human-readable violations (empty = ok).
 */
export function verifyTailoredDeterministic(master: Resume, tailored: Resume, facts: string[]): string[] {
  const v: string[] = [];
  const masterText = resumeToText(master);
  const sourceText = norm([masterText, ...facts].join("\n"));

  const mExp = master.experience.map(expKey);
  const tExp = tailored.experience.map(expKey);
  if (!sameMultiset(mExp, tExp)) {
    for (const k of tExp) if (!mExp.includes(k)) v.push(`Experience entry not in master: ${k}`);
    for (const k of mExp) if (!tExp.includes(k)) v.push(`Master experience entry missing or altered: ${k}`);
  }
  const mEdu = master.education.map(eduKey);
  const tEdu = tailored.education.map(eduKey);
  if (!sameMultiset(mEdu, tEdu)) {
    for (const k of tEdu) if (!mEdu.includes(k)) v.push(`Education entry not in master: ${k}`);
    for (const k of mEdu) if (!tEdu.includes(k)) v.push(`Master education entry missing or altered: ${k}`);
  }

  const subset = (label: string, mine: string[], theirs: string[]) => {
    const m = new Set(theirs.map(norm));
    for (const x of mine) if (!m.has(norm(x))) v.push(`${label} not in master: ${x}`);
  };
  subset("Certification", tailored.certifications.map((c) => c.name), master.certifications.map((c) => c.name));
  subset("Language", tailored.languages, master.languages);
  subset("Award", tailored.awards, master.awards);

  for (const items of Object.values(tailored.skills)) {
    for (const s of items) {
      if (!sourceText.includes(norm(s))) v.push(`Skill not supported by master or facts: ${s}`);
    }
  }

  const tailoredText = [tailored.summary, ...tailored.experience.flatMap((e) => e.bullets), ...tailored.projects].join("\n");
  for (const n of unsupportedNumbers(tailoredText, [masterText, ...facts])) v.push(`Number not in master or facts: ${n}`);

  return v;
}
