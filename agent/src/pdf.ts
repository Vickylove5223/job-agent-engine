// Renders a tailored resume / cover letter to a clean, ATS-friendly single-column PDF.
// Pure JS (pdf-lib) — no browser minutes spent.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Profile, Resume } from "@shared/types";

const A4 = { w: 595.28, h: 841.89 };
const M = 50;

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - M;
  }
  private ensure(h: number) {
    if (this.y - h < M) this.newPage();
  }
  /** WinAnsi-safe text (standard fonts can't encode e.g. ₦ or emoji). */
  private safe(s: string) {
    return s.replace(/₦/g, "NGN ").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/•/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
  }
  text(s: string, opts: { size?: number; bold?: boolean; color?: number; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const f = opts.bold ? this.bold : this.font;
    const maxW = A4.w - 2 * M - (opts.indent ?? 0);
    const words = this.safe(s).split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      this.ensure(size + 3);
      this.page.drawText(l, { x: M + (opts.indent ?? 0), y: this.y - size, size, font: f, color: rgb(opts.color ?? 0.1, opts.color ?? 0.1, opts.color ?? 0.1) });
      this.y -= size + 3;
    }
    this.y -= opts.gap ?? 0;
  }
  heading(s: string) {
    this.y -= 6;
    this.ensure(30);
    this.text(s.toUpperCase(), { size: 10.5, bold: true, gap: 2 });
    this.page.drawLine({ start: { x: M, y: this.y + 2 }, end: { x: A4.w - M, y: this.y + 2 }, thickness: 0.6, color: rgb(0.75, 0.75, 0.75) });
    this.y -= 6;
  }
  space(h: number) {
    this.y -= h;
  }
}

const human = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export async function renderResumePdf(resume: Resume, profile: Profile): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  w.text(profile.fullName, { size: 18, bold: true, gap: 2 });
  if (profile.headline) w.text(profile.headline, { size: 11, color: 0.3, gap: 2 });
  w.text([profile.email, profile.phone, profile.location, profile.links.linkedin, profile.links.portfolio].filter(Boolean).join("  |  "), { size: 9, color: 0.35, gap: 4 });
  if (resume.summary) {
    w.heading("Summary");
    w.text(resume.summary);
  }
  const skills = Object.entries(resume.skills ?? {}).filter(([, v]) => v?.length);
  if (skills.length) {
    w.heading("Skills");
    for (const [k, v] of skills) w.text(`${human(k)}: ${v.join(", ")}`, { gap: 1 });
  }
  if (resume.experience?.length) {
    w.heading("Experience");
    for (const e of resume.experience) {
      w.text(`${e.title} - ${e.company}${e.location ? `, ${e.location}` : ""}`, { bold: true });
      w.text(`${e.start} - ${e.end}${e.type ? ` (${e.type})` : ""}`, { size: 9, color: 0.4, gap: 1 });
      for (const b of e.bullets) w.text(`- ${b}`, { indent: 8 });
      w.space(5);
    }
  }
  if (resume.projects?.length) {
    w.heading("Projects");
    for (const p of resume.projects) w.text(`- ${p}`, { indent: 8 });
  }
  if (resume.education?.length) {
    w.heading("Education");
    for (const e of resume.education) w.text(`${e.degree} - ${e.school}${e.end ? ` (${e.end})` : ""}`);
  }
  if (resume.certifications?.length) {
    w.heading("Certifications");
    for (const c of resume.certifications) w.text(`${c.name}${c.issued ? ` (${c.issued})` : ""}`);
  }
  if (resume.awards?.length) {
    w.heading("Awards");
    for (const a of resume.awards) w.text(`- ${a}`, { indent: 8 });
  }
  if (resume.languages?.length) {
    w.heading("Languages");
    w.text(resume.languages.join(", "));
  }
  return Buffer.from(await doc.save());
}

export async function renderCoverLetterPdf(text: string, profile: Profile): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  w.text(profile.fullName, { size: 14, bold: true, gap: 2 });
  w.text([profile.email, profile.phone, profile.location].filter(Boolean).join("  |  "), { size: 9, color: 0.35, gap: 14 });
  for (const para of text.split(/\n\s*\n/)) w.text(para.replace(/\n/g, " "), { size: 10.5, gap: 8 });
  return Buffer.from(await doc.save());
}
