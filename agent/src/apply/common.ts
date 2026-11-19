// Shared applier machinery: session lifecycle, page loading, blocker detection, screenshots,
// file uploads, deterministic form-field collection, field filling and the fillForm loop.
//
// Everything runs in a HOSTED Browserbase browser driven by Stagehand 4 (see ../browser.ts).
// Stagehand 4 API facts this file relies on (checked against dist/index.d.mts, v4.4.0):
//   - page.goto(url, { waitUntil, timeout }) → Response | null; page.url() is ASYNC.
//   - page.evaluate(expressionString | fn, arg) runs in the main frame only (no iframes).
//   - page.locator(selector) accepts CSS, "xpath=…" / "/…" and "text=…"; "iframe >> css" hops frames.
//     Locator has fill/type/click/isVisible/isChecked/inputValue/selectOption/setInputFiles/count/first/nth.
//   - Locator.setInputFiles(FileInput) where FileInput = path | FilePayload{name,mimeType,buffer};
//     paths are read by the Node SDK and streamed to the remote browser, so uploads work on Browserbase.
//   - page.screenshot({ type: "jpeg", quality, fullPage }) → Uint8Array.
//   - stagehand.act(instruction | Action, { page, variables, timeout }), observe(instruction, { page }),
//     extract(instruction, zodSchema, { page }) → { data }.
//
// In-page scripts are passed to page.evaluate as STRINGS on purpose: tsx/esbuild may inject
// helpers such as __name() into compiled functions, which do not exist inside the page.
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";
import type { FilePayload, Page, Stagehand } from "@browserbasehq/stagehand";
import type { ApplyMethod } from "@shared/types";
import { openBrowser, type AgentBrowser } from "../browser";
import type { ApplyInput, ApplyResult, FieldAnswer, FieldQuestion } from "../contracts";

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export interface Ctx {
  b: AgentBrowser;
  stagehand: Stagehand;
  /** Current page. Appliers may switch it when a flow opens a new tab. */
  page: Page;
  input: ApplyInput;
  answers: ApplyResult["answers"];
  /** Set by the session wrapper when the time budget is exhausted; checked before submitting. */
  cancelled: boolean;
  log(msg: string): void;
}

export type Runner = (ctx: Ctx) => Promise<ApplyResult>;

export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "combobox"
  | "radio"
  | "checkbox"
  | "checkboxes"
  | "buttons"
  | "file"
  /** field found by stagehand.extract only (no DOM handle); filled with stagehand.act */
  | "ai";

export interface DomOption {
  label: string;
  value: string;
  /** data-ja-id of the clickable element (radio/checkbox input or button) */
  id?: string;
}

export interface DomField {
  /** data-ja-id of the element (or of the group container for radios/checkboxes/buttons) */
  id: string;
  kind: FieldKind;
  type: FieldQuestion["type"];
  label: string;
  required: boolean;
  options?: DomOption[];
  /** current value (text / selected option label / "checked") — empty when not filled */
  value: string;
  name: string;
  /** raw element id attribute, useful for site-specific rules */
  elId: string;
}

export interface CollectOptions {
  /** CSS selector of the form/modal to restrict collection to */
  scope?: string;
  /** open react-select style comboboxes to read their options (costs a few clicks) */
  probeComboboxes?: boolean;
}

export interface FillOptions {
  /** custom answers that take precedence (e.g. Lever's "Additional information" ← cover letter) */
  preset?: (f: DomField) => FieldAnswer | null;
  /** fields to leave alone */
  skip?: (f: DomField) => boolean;
  /** fill even when the field already has a value (default: only profile-known fields overwrite) */
  overwriteAll?: boolean;
}

export type FillOutcome =
  | { status: "ok"; filled: number }
  | { status: "waiting_input"; questions: NonNullable<ApplyResult["questions"]> }
  | { status: "failed"; error: string };

export const MIN_CONFIDENCE = 0.8;

// ---------------------------------------------------------------------------------------------
// Small utils
// ---------------------------------------------------------------------------------------------

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
const sel = (id: string) => `[data-ja-id="${id}"]`;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export class ApplyTimeoutError extends Error {
  constructor(ms: number) {
    super(`Application timed out after ${Math.round(ms / 1000)}s`);
  }
}

export function result(
  ctx: Ctx | undefined,
  status: ApplyResult["status"],
  extra: Partial<ApplyResult> = {},
): ApplyResult {
  return { status, answers: ctx?.answers ?? [], ...extra };
}

/** Run an in-page script (a JS function source string) with a JSON-serialisable argument. */
export async function run<R>(page: Page, fnSource: string, arg?: unknown): Promise<R> {
  return page.evaluate<R>(`(${fnSource})(${JSON.stringify(arg ?? null)})`);
}

/** Which applier handles a URL, by host. */
export function methodFromUrl(url: string): ApplyMethod {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "external";
  }
  if (/(^|\.)greenhouse\.io$/.test(host)) return "greenhouse";
  if (/(^|\.)lever\.co$/.test(host)) return "lever";
  if (/(^|\.)ashbyhq\.com$/.test(host)) return "ashby";
  if (/(^|\.)linkedin\.com$/.test(host)) return "linkedin_easy";
  if (/(^|\.)indeed\.[a-z.]+$/.test(host)) return "indeed";
  return "external";
}

// ---------------------------------------------------------------------------------------------
// Session wrapper: open hosted browser, time-box, always close, measure browser seconds
// ---------------------------------------------------------------------------------------------

export interface SessionOptions {
  timeoutMs?: number;
  /** the flow needs the user's saved login (LinkedIn / Indeed) */
  requiresContext?: { siteName: string };
}

export const DEFAULT_TIMEOUT_MS = 6 * 60 * 1000;

export async function runSession(input: ApplyInput, runner: Runner, opts: SessionOptions = {}): Promise<ApplyResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (opts.requiresContext && !input.contextId) {
    return {
      status: "blocked",
      answers: [],
      error: `${opts.requiresContext.siteName} is not connected — connect it in Settings`,
      browserSeconds: 0,
    };
  }
  const started = Date.now();
  let b: AgentBrowser | undefined;
  let ctx: Ctx | undefined;
  let out: ApplyResult;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    b = await openBrowser({
      contextId: input.contextId,
      // Session hard limit slightly above our own budget so we can still screenshot + close.
      timeoutSec: Math.ceil(timeoutMs / 1000) + 90,
    });
    const tag = `[apply ${input.job.applyMethod} ${input.job.id}]`;
    ctx = {
      b,
      stagehand: b.stagehand,
      page: b.page,
      input,
      answers: [],
      cancelled: false,
      log: (m) => console.log(`${tag} ${m}`),
    };
    const c = ctx;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        c.cancelled = true;
        reject(new ApplyTimeoutError(timeoutMs));
      }, timeoutMs);
    });
    out = await Promise.race([runner(c), timeout]);
    // Belt and braces: a dry run can never report "applied".
    if (input.dryRun && out.status === "applied") out = { ...out, status: "dry_run_ok" };
    if (!out.screenshot) out.screenshot = await safeScreenshot(c.page);
  } catch (e) {
    if (ctx) ctx.cancelled = true;
    const shot = ctx ? await safeScreenshot(ctx.page) : undefined;
    out = {
      status: "failed",
      answers: ctx?.answers ?? [],
      error: e instanceof ApplyTimeoutError ? e.message : `Applier crashed: ${errMsg(e)}`,
      screenshot: shot,
    };
  } finally {
    if (timer) clearTimeout(timer);
    await b?.close().catch(() => {});
  }
  out.browserSeconds = Math.round((Date.now() - started) / 1000);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Page loading + blockers
// ---------------------------------------------------------------------------------------------

/** Navigate and wait for the page to settle. Returns the HTTP status (0 if unknown). */
export async function gotoPage(ctx: Ctx, url: string): Promise<number> {
  ctx.log(`goto ${url}`);
  const res = await ctx.page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await ctx.page.waitForLoadState("load", 15_000).catch(() => {});
  // SPAs (Ashby, Indeed SmartApply) render after load; a short settle helps everyone.
  await ctx.page.waitForTimeout(1500);
  return res ? res.status() : 0;
}

const BLOCKER_SCRIPT = String.raw`(arg) => {
  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true, checkOpacity: true, opacityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 40 && r.height > 40 && r.bottom > -50 && r.top < (window.innerHeight * 4);
  };
  const frames = Array.from(document.querySelectorAll('iframe'));
  for (const f of frames) {
    const src = String(f.getAttribute('src') || '') + ' ' + String(f.getAttribute('title') || '');
    if (!vis(f)) continue;
    if (/size=invisible/i.test(src)) continue;
    if (f.closest('.grecaptcha-badge')) continue;
    if (/recaptcha\/(api2|enterprise)\/(bframe|anchor)|recaptcha challenge|hcaptcha|challenges\.cloudflare\.com|turnstile|arkoselabs|funcaptcha|geo\.captcha-delivery|captcha/i.test(src)) {
      return { kind: 'captcha', detail: src.slice(0, 160) };
    }
  }
  if (document.querySelector('#challenge-form, #challenge-running, #cf-challenge-running, .cf-turnstile, #px-captcha, .h-captcha[data-size="normal"]')) {
    const el = document.querySelector('#challenge-form, #challenge-running, #cf-challenge-running, .cf-turnstile, #px-captcha, .h-captcha[data-size="normal"]');
    if (vis(el) || /just a moment/i.test(document.title)) return { kind: 'captcha', detail: 'challenge element present' };
  }
  const text = String((document.body && document.body.innerText) || '').slice(0, 6000);
  const title = document.title || '';
  if (/^just a moment/i.test(title) || /verify (that )?you are (a )?human|are you a robot|unusual traffic from your|press (and|&) hold|checking (if the site connection is secure|your browser)|let.s do a quick security check|complete the security check|security verification/i.test(text)) {
    return { kind: 'human', detail: title };
  }
  if (/(job|position|posting|role|vacancy)( you are looking for)? (is )?(no longer (available|open|accepting applications|active)|has (been )?(closed|filled|expired|removed))|no longer accepting applications|this job (has expired|is closed)|job not found|posting not found|page not found|couldn.t find (that|this|anything here)|the page you.re looking for|this position has been filled|404 error|error 404/i.test(text)) {
    return { kind: 'closed', detail: title };
  }
  const pw = Array.from(document.querySelectorAll('input[type=password]')).some(vis);
  if (pw) return { kind: 'password', detail: location.host };
  return { kind: null, detail: '' };
}`;

export type BlockerKind = "captcha" | "human" | "closed" | "password" | null;

export async function detectBlocker(ctx: Ctx): Promise<{ kind: BlockerKind; detail: string }> {
  try {
    return await run<{ kind: BlockerKind; detail: string }>(ctx.page, BLOCKER_SCRIPT);
  } catch {
    return { kind: null, detail: "" };
  }
}

/** Map a blocker to a terminal ApplyResult (password walls are left to the caller). */
export async function blockerResult(ctx: Ctx, httpStatus = 0): Promise<ApplyResult | null> {
  if (httpStatus === 404 || httpStatus === 410) {
    return result(ctx, "failed", { error: `Position closed or not found (HTTP ${httpStatus})`, screenshot: await safeScreenshot(ctx.page) });
  }
  const bl = await detectBlocker(ctx);
  if (bl.kind === "captcha" || bl.kind === "human") {
    return result(ctx, "blocked", {
      error: `Bot check / CAPTCHA on ${await hostOf(ctx)} — the agent will not solve CAPTCHAs (${bl.detail || bl.kind})`,
      screenshot: await safeScreenshot(ctx.page),
    });
  }
  if (bl.kind === "closed") {
    return result(ctx, "failed", { error: "Position closed or no longer accepting applications", screenshot: await safeScreenshot(ctx.page) });
  }
  return null;
}

/** goto + blocker check in one call. Returns a terminal result or null when the page is usable. */
export async function openJobPage(ctx: Ctx, url: string): Promise<ApplyResult | null> {
  const status = await gotoPage(ctx, url);
  return blockerResult(ctx, status);
}

export async function hostOf(ctx: Ctx): Promise<string> {
  try {
    return new URL(await ctx.page.url()).hostname;
  } catch {
    return "the site";
  }
}

/** Wait until any of the selectors is present. Returns the one that matched, or null. */
export async function waitForAny(ctx: Ctx, selectors: string[], timeoutMs = 15_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const s of selectors) {
      try {
        if ((await ctx.page.locator(s).count()) > 0) return s;
      } catch {
        /* invalid selector on this engine — ignore */
      }
    }
    await ctx.page.waitForTimeout(500);
  }
  return null;
}

/** If the flow opened a new tab, switch ctx.page to the newest one. */
export async function adoptNewestPage(ctx: Ctx, before: number): Promise<boolean> {
  const pages = await ctx.b.browser.context.pages();
  if (pages.length > before) {
    const p = pages[pages.length - 1]!;
    ctx.page = p;
    await ctx.b.browser.context.setActivePage(p).catch(() => {});
    await p.waitForLoadState("domcontentloaded", 20_000).catch(() => {});
    await p.waitForTimeout(1500);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Screenshots (JPEG, < 300 KB)
// ---------------------------------------------------------------------------------------------

const MAX_SHOT = 300 * 1024;

export async function screenshotJpeg(page: Page): Promise<Buffer> {
  const attempts: { fullPage: boolean; quality: number }[] = [
    { fullPage: true, quality: 55 },
    { fullPage: true, quality: 35 },
    { fullPage: false, quality: 50 },
    { fullPage: false, quality: 25 },
    { fullPage: false, quality: 10 },
  ];
  let last: Buffer | undefined;
  for (const a of attempts) {
    try {
      const bytes = await page.screenshot({ type: "jpeg", quality: a.quality, fullPage: a.fullPage, timeout: 15_000, animations: "disabled", caret: "hide" });
      last = Buffer.from(bytes);
      if (last.byteLength < MAX_SHOT) return last;
    } catch {
      /* try the next, cheaper variant */
    }
  }
  if (last && last.byteLength < MAX_SHOT) return last;
  throw new Error("Could not produce a screenshot under 300 KB");
}

/** Screenshot that never throws and never hangs more than ~20 s. */
export async function safeScreenshot(page: Page): Promise<Buffer | undefined> {
  try {
    return await Promise.race([screenshotJpeg(page), sleep(20_000).then(() => undefined)]);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------

export async function filePayload(path: string, mimeType = "application/pdf"): Promise<FilePayload> {
  return { name: basename(path), mimeType, buffer: new Uint8Array(await readFile(path)) };
}

/**
 * Minimal text → PDF (Helvetica, Latin-1, wrapped, multi-page). Used for cover letters that only
 * exist as text and for the dry-run resume. No dependencies.
 */
export function textToPdf(text: string, title = ""): Buffer {
  const toLatin1 = (s: string) =>
    s
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/•/g, "*")
      .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "?");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const wrap = (line: string, width = 92): string[] => {
    if (line.length <= width) return [line];
    const out: string[] = [];
    let cur = "";
    for (const w of line.split(/\s+/)) {
      if ((cur + " " + w).trim().length > width) {
        if (cur) out.push(cur);
        cur = w;
      } else cur = (cur + " " + w).trim();
    }
    if (cur) out.push(cur);
    return out;
  };
  const lines = [...(title ? [title, ""] : []), ...toLatin1(text).split(/\r?\n/)].flatMap((l) => wrap(l));
  const perPage = 54;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length || pages.length === 0; i += perPage) pages.push(lines.slice(i, i + perPage));

  const objs: string[] = [];
  const add = (s: string) => objs.push(s); // returns the 1-based object number
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("PAGES_PLACEHOLDER");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  for (const pl of pages) {
    const body = ["BT", "/F1 11 Tf", "14 TL", "56 790 Td", ...pl.map((l) => `(${esc(l)}) '`), "ET"].join("\n");
    const contentNo = add(`<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNo} 0 R >>`));
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

export async function resumePayload(ctx: Ctx): Promise<FilePayload> {
  return filePayload(ctx.input.resumePdfPath);
}

/** Cover letter as an uploadable file (their PDF, or one generated from the text), or null. */
export async function coverLetterPayload(ctx: Ctx): Promise<FilePayload | null> {
  const cl = ctx.input.coverLetter;
  if (!cl) return null;
  if (cl.pdfPath) return filePayload(cl.pdfPath);
  if (!cl.text.trim()) return null;
  const safe = (ctx.input.profile.fullName || "Cover Letter").replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "_");
  return { name: `${safe || "Cover"}_Cover_Letter.pdf`, mimeType: "application/pdf", buffer: new Uint8Array(textToPdf(cl.text)) };
}

/** Try each selector; upload to the first <input type=file> that exists. Returns the selector used. */
export async function uploadFile(ctx: Ctx, selectors: string[], file: FilePayload): Promise<string | null> {
  for (const s of selectors) {
    try {
      const loc = ctx.page.locator(s).first();
      if ((await loc.count()) === 0) continue;
      await loc.setInputFiles(file, { timeout: 20_000 });
      ctx.log(`uploaded ${file.name} → ${s}`);
      await ctx.page.waitForTimeout(1500);
      return s;
    } catch (e) {
      ctx.log(`upload via ${s} failed: ${errMsg(e)}`);
    }
  }
  return null;
}

/** Natural-language fallback: let Stagehand locate the upload input, then upload deterministically. */
export async function uploadViaObserve(ctx: Ctx, what: string, file: FilePayload): Promise<boolean> {
  try {
    const { data } = await ctx.stagehand.observe(
      `Find the file input (input type=file) used to upload the ${what}. If the input is hidden, return the hidden input element itself, not the button.`,
      { page: ctx.page },
    );
    for (const a of data.slice(0, 3)) {
      if (await uploadFile(ctx, [a.selector], file)) return true;
    }
  } catch (e) {
    ctx.log(`observe upload failed: ${errMsg(e)}`);
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Field collection (deterministic DOM first)
// ---------------------------------------------------------------------------------------------

const COLLECT_SCRIPT = String.raw`(opts) => {
  const root = (opts && opts.scope && document.querySelector(opts.scope)) || document.body;
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const isVis = (el) => {
    if (!el || !el.isConnected) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  if (typeof window.__jaSeq !== 'number') window.__jaSeq = 0;
  const tag = (el) => {
    let id = el.getAttribute('data-ja-id');
    if (!id) { id = 'f' + (++window.__jaSeq); el.setAttribute('data-ja-id', id); }
    return id;
  };
  const FIELD_SEL = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=search]):not([type=password]), select, textarea, [role=combobox]';
  const txt = (el) => clean(el ? (el.innerText || el.textContent) : '').slice(0, 400);
  const isOptionLabel = (l) => {
    const f = l.getAttribute('for');
    const t = f ? document.getElementById(f) : null;
    if (t && (t.type === 'radio' || t.type === 'checkbox')) return true;
    return !!l.querySelector('input[type=radio], input[type=checkbox]');
  };
  const reqLike = (el) => !!el && (/required/i.test(String(el.className || '')) || !!el.querySelector('.required, [class*="required" i], abbr[title*="required" i]'));
  // Walk up from el looking for the nearest preceding label-ish element inside a container that
  // does not contain other fields (so we do not steal a neighbour's label).
  const containerLabel = (el, ownNames) => {
    let c = el.parentElement;
    for (let depth = 0; c && c !== document.body && depth < 7; depth++, c = c.parentElement) {
      const foreign = Array.from(c.querySelectorAll(FIELD_SEL)).filter((f) => f !== el && !el.contains(f) && !f.contains(el) && !(f.name && ownNames.indexOf(f.name) >= 0) && isVis(f)).length;
      if (foreign > 1) return null;
      const cands = Array.from(c.querySelectorAll('label, legend, [class*="label" i], [class*="question-title" i], [class*="questionTitle"], [data-testid*="label" i]'))
        .filter((l) => !l.contains(el) && !isOptionLabel(l) && txt(l) && (l.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (cands.length) return cands[cands.length - 1];
    }
    return null;
  };
  const labelOf = (el, ownNames, group) => {
    // returns { text, el }
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const parts = lb.split(/\s+/).map((i) => document.getElementById(i)).filter(Boolean);
      const t = clean(parts.map(txt).join(' '));
      if (t) return { text: t, el: parts[0] };
    }
    if (!group) {
      if (el.id) {
        const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (l && txt(l)) return { text: txt(l), el: l };
      }
      const wrap = el.closest('label');
      if (wrap && txt(wrap)) return { text: txt(wrap), el: wrap };
    }
    const aria = el.getAttribute('aria-label');
    if (aria && !group) return { text: clean(aria), el: null };
    const fs = group ? el.closest('fieldset') : null;
    if (fs) { const lg = fs.querySelector('legend'); if (lg && txt(lg)) return { text: txt(lg), el: lg }; }
    const rg = group ? el.closest('[role=radiogroup], [role=group]') : null;
    if (rg) {
      const rlb = rg.getAttribute('aria-labelledby');
      const rl = rlb ? document.getElementById(rlb.split(/\s+/)[0]) : null;
      if (rl && txt(rl)) return { text: txt(rl), el: rl };
      if (rg.getAttribute('aria-label')) return { text: clean(rg.getAttribute('aria-label')), el: null };
    }
    const cl = containerLabel(el, ownNames);
    if (cl) return { text: txt(cl), el: cl };
    if (aria) return { text: clean(aria), el: null };
    return { text: clean(el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('name') || el.id || ''), el: null };
  };
  const stripReq = (s) => clean(String(s).replace(/\s*(\*|✱|\(required\)|required)\s*$/i, '').replace(/\s*\*\s*/g, ' '));
  const hasReqMark = (s) => /(\*|✱)\s*$|\*|\(required\)/i.test(String(s));
  const optText = (input) => {
    if (input.id) { const l = document.querySelector('label[for="' + CSS.escape(input.id) + '"]'); if (l && txt(l)) return txt(l); }
    const w = input.closest('label'); if (w && txt(w)) return txt(w);
    if (input.getAttribute('aria-label')) return clean(input.getAttribute('aria-label'));
    const sib = input.nextElementSibling; if (sib && txt(sib)) return txt(sib);
    const p = input.parentElement; if (p && txt(p) && txt(p).length < 200) return txt(p);
    return clean(input.value || '');
  };
  const inputType = (el) => {
    const t = String(el.getAttribute('type') || 'text').toLowerCase();
    if (['email', 'tel', 'url', 'number', 'date'].indexOf(t) >= 0) return t;
    if (t === 'month' || t === 'datetime-local') return 'date';
    return 'text';
  };
  const out = [];
  const seenGroups = {};
  const els = Array.from(root.querySelectorAll(FIELD_SEL));
  let hasPassword = Array.from(root.querySelectorAll('input[type=password]')).some(isVis);
  for (const el of els) {
    if (el.closest('[data-ja-ignore]')) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    if (el.disabled) continue;
    const tagName = el.tagName.toLowerCase();
    const type = String(el.getAttribute('type') || '').toLowerCase();
    const role = String(el.getAttribute('role') || '').toLowerCase();
    if (type === 'file') {
      const l = labelOf(el, [], false);
      const container = el.closest('[class*="field" i], [class*="upload" i], fieldset, li, div');
      out.push({ node: el, id: tag(el), kind: 'file', type: 'file', label: stripReq(l.text), required: el.required || el.getAttribute('aria-required') === 'true' || hasReqMark(l.text) || reqLike(l.el), value: el.files && el.files.length ? el.files[0].name : '', name: el.name || '', elId: el.id || '', accept: el.getAttribute('accept') || '' });
      continue;
    }
    if (role === 'combobox' || (tagName === 'input' && el.getAttribute('aria-autocomplete') === 'list')) {
      const control = el.closest('[class*="control" i]') || el.parentElement;
      if (!isVis(el) && !isVis(control)) continue;
      const l = labelOf(el, [], false);
      const container = (control && control.parentElement) || el.parentElement;
      let value = '';
      const sv = container ? container.querySelector('[class*="singleValue" i], [class*="single-value" i], [class*="multiValue" i], [class*="multi-value" i]') : null;
      if (sv) value = txt(sv);
      else if (tagName === 'input') value = clean(el.value);
      else if (tagName !== 'input') { const t = txt(el); if (t && !/^(select|choose|search)/i.test(t)) value = t; }
      out.push({ node: el, id: tag(el), kind: 'combobox', type: 'select', label: stripReq(l.text), required: el.required || el.getAttribute('aria-required') === 'true' || hasReqMark(l.text) || reqLike(l.el), value: value, name: el.name || '', elId: el.id || '' });
      continue;
    }
    if (type === 'radio' || type === 'checkbox') {
      const key = (el.name || '') ? type + ':' + el.name : '';
      const members = key ? Array.from(root.querySelectorAll('input[type=' + type + ']')).filter((x) => x.name === el.name) : [el];
      if (key && seenGroups[key]) continue;
      if (key) seenGroups[key] = true;
      const visible = members.filter((m) => isVis(m) || isVis(m.closest('label')) || (m.id && isVis(document.querySelector('label[for="' + CSS.escape(m.id) + '"]'))) || isVis(m.parentElement));
      if (!visible.length) continue;
      if (type === 'checkbox' && members.length === 1) {
        const l = labelOf(el, [], false);
        out.push({ node: el, id: tag(el), kind: 'checkbox', type: 'checkbox', label: stripReq(l.text), required: el.required || el.getAttribute('aria-required') === 'true' || hasReqMark(l.text), value: el.checked ? 'checked' : '', name: el.name || '', elId: el.id || '' });
        continue;
      }
      const container = members[0].closest('fieldset, [role=radiogroup], [role=group]') || members[0].parentElement;
      const l = labelOf(members[0], [el.name], true);
      const options = members.map((m) => ({ label: optText(m), value: m.value, id: tag(m) }));
      const checked = members.filter((m) => m.checked).map(optText);
      out.push({ node: members[0], id: tag(container || members[0]), kind: type === 'radio' ? 'radio' : 'checkboxes', type: type === 'radio' ? 'radio' : 'checkbox', label: stripReq(l.text), required: members.some((m) => m.required || m.getAttribute('aria-required') === 'true') || hasReqMark(l.text) || reqLike(l.el), options: options, value: checked.join(', '), name: el.name || '', elId: el.id || '' });
      continue;
    }
    if (!isVis(el)) continue;
    if (tagName === 'select') {
      const l = labelOf(el, [], false);
      const opts2 = Array.from(el.options).filter((o) => clean(o.text) && !(o.value === '' && /^(select|choose|please|--|—|-)/i.test(clean(o.text))) && !(o.value === '' && o.index === 0)).map((o) => ({ label: clean(o.text), value: o.value }));
      const so = el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
      const value = so && so.value !== '' && !/^(select|choose|please|--)/i.test(clean(so.text)) ? clean(so.text) : '';
      out.push({ node: el, id: tag(el), kind: 'select', type: 'select', label: stripReq(l.text), required: el.required || el.getAttribute('aria-required') === 'true' || hasReqMark(l.text) || reqLike(l.el), options: opts2, value: value, name: el.name || '', elId: el.id || '' });
      continue;
    }
    if (el.getAttribute('tabindex') === '-1' && el.getBoundingClientRect().width < 3) continue; // honeypots / react-select requiredInput
    const l = labelOf(el, [], false);
    const kind = tagName === 'textarea' ? 'textarea' : 'text';
    out.push({ node: el, id: tag(el), kind: kind, type: kind === 'textarea' ? 'textarea' : inputType(el), label: stripReq(l.text), required: el.required || el.getAttribute('aria-required') === 'true' || hasReqMark(l.text) || reqLike(l.el), value: clean(el.value), name: el.name || '', elId: el.id || '' });
  }
  // Yes/No button groups (Ashby and similar)
  const btns = Array.from(root.querySelectorAll('button')).filter((b) => /^(yes|no)$/i.test(txt(b)) && isVis(b));
  const parents = Array.from(new Set(btns.map((b) => b.parentElement))).filter(Boolean);
  for (const p of parents) {
    const kids = Array.from(p.querySelectorAll(':scope > button'));
    if (!kids.some((k) => /^yes$/i.test(txt(k))) || !kids.some((k) => /^no$/i.test(txt(k)))) continue;
    const l = labelOf(p, [], true);
    const sel = kids.find((k) => k.getAttribute('aria-pressed') === 'true' || k.getAttribute('aria-checked') === 'true' || /(^|[\s_-])(active|selected|checked)/i.test(String(k.className)));
    out.push({ node: p, id: tag(p), kind: 'buttons', type: 'radio', label: stripReq(l.text), required: hasReqMark(l.text) || reqLike(l.el) || reqLike(p.parentElement), options: kids.map((k) => ({ label: txt(k), value: txt(k), id: tag(k) })), value: sel ? txt(sel) : '', name: '', elId: p.id || '' });
  }
  out.sort((a, b) => (a.node === b.node ? 0 : (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)));
  return { hasPassword: hasPassword, fields: out.map((f) => { const c = Object.assign({}, f); delete c.node; delete c.accept; return c; }) };
}`;

const PROBE_OPTIONS_SCRIPT = String.raw`() => {
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const opts = Array.from(document.querySelectorAll('[role=option], [class*="option" i][id*="option" i]'))
    .filter((o) => { const r = o.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .map((o) => clean(o.innerText || o.textContent))
    .filter(Boolean);
  return Array.from(new Set(opts)).slice(0, 80);
}`;

export async function collectFields(ctx: Ctx, opts: CollectOptions = {}): Promise<{ fields: DomField[]; hasPassword: boolean }> {
  const res = await run<{ fields: DomField[]; hasPassword: boolean }>(ctx.page, COLLECT_SCRIPT, { scope: opts.scope ?? null });
  const fields = res.fields.map((f) => ({ ...f, label: f.label || f.name || f.elId || "(unlabelled field)" }));
  if (opts.probeComboboxes) {
    let probed = 0;
    for (const f of fields) {
      if (f.kind !== "combobox" || f.options?.length || probed >= 30) continue;
      probed++;
      try {
        const loc = ctx.page.locator(sel(f.id));
        await loc.click({ timeout: 5000 });
        await ctx.page.waitForTimeout(500);
        const labels = await run<string[]>(ctx.page, PROBE_OPTIONS_SCRIPT);
        await ctx.page.keyPress("Escape").catch(() => {});
        // Async (search-as-you-type) comboboxes list nothing or "No options" — leave options empty.
        const usable = labels.filter((l) => !/^(no options|no results|loading|type to search)/i.test(l));
        if (usable.length) f.options = usable.map((l) => ({ label: l, value: l }));
      } catch (e) {
        ctx.log(`probe ${f.label}: ${errMsg(e)}`);
      }
    }
  }
  ctx.log(`collected ${fields.length} fields${res.hasPassword ? " (password field present)" : ""}`);
  return { fields, hasPassword: res.hasPassword };
}

/** Last-resort field listing through Stagehand extract (for forms the DOM heuristics miss). */
export async function collectFieldsAI(ctx: Ctx): Promise<DomField[]> {
  const schema = z.object({
    fields: z.array(
      z.object({
        label: z.string().describe("the question / label shown to the applicant"),
        type: z.enum(["text", "textarea", "select", "radio", "checkbox", "number", "date", "email", "tel", "url", "file"]),
        required: z.boolean().describe("true if marked required (asterisk or 'required')"),
        options: z.array(z.string()).nullable().describe("choices for select/radio/checkbox, else null"),
        value: z.string().nullable().describe("current value if already filled, else null"),
      }),
    ),
  });
  const { data } = await ctx.stagehand.extract(
    "List every input field of the job application form on this page, in order. Ignore search boxes, newsletter sign-ups, cookie banners and login fields.",
    schema,
    { page: ctx.page },
  );
  return data.fields.map((f, i) => ({
    id: `ai${i}`,
    kind: f.type === "file" ? ("file" as const) : ("ai" as const),
    type: f.type,
    label: f.label,
    required: f.required,
    options: f.options?.map((o) => ({ label: o, value: o })),
    value: f.value ?? "",
    name: "",
    elId: "",
  }));
}

export function toQuestion(f: DomField): FieldQuestion {
  const opts = f.options?.map((o) => o.label).filter(Boolean);
  const type: FieldQuestion["type"] = f.kind === "combobox" && !opts?.length ? "text" : f.type;
  return { label: f.label, type, options: opts?.length ? opts : undefined, required: f.required };
}

// ---------------------------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------------------------

/** Profile facts we can fill without asking anybody. */
export function profileAnswer(f: DomField, input: ApplyInput): FieldAnswer | null {
  if (f.kind === "file") return null;
  const p = input.profile;
  const L = norm(f.label + " " + (f.kind === "text" ? f.name : ""));
  const parts = p.fullName.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  const a = (answer: string | undefined, basis: string): FieldAnswer | null => (answer ? { answer, confidence: 1, basis: [basis] } : null);
  const textish = f.kind === "text" || f.kind === "textarea";
  if (textish || f.kind === "ai") {
    if (/\b(first|given) name\b|^first$|\bfirstname\b|^first name/.test(L) && !/preferred/.test(L)) return a(first, "profile.fullName");
    if (/\b(last|family) name\b|\bsurname\b|\blastname\b/.test(L)) return a(last, "profile.fullName");
    if (/^(full |legal |your )?name( full)?$|^full name|^legal name|^name name$/.test(L)) return a(p.fullName, "profile.fullName");
    if (/\be ?mail\b/.test(L) && !/referr|recruiter|manager/.test(L)) return a(p.email, "profile.email");
    if (/\b(phone|mobile|cell|telephone)\b/.test(L) && !/(type|country code|extension)/.test(L)) return a(p.phone, "profile.phone");
    if (/linkedin/.test(L)) return a(p.links.linkedin, "profile.links.linkedin");
    if (/github/.test(L)) return a(p.links.github, "profile.links.github");
    if (/\b(portfolio|personal (web)?site|website)\b/.test(L) && !/company/.test(L)) return a(p.links.portfolio ?? p.links.github, "profile.links.portfolio");
    if (/^(current )?(location|city)( city)?$|^where are you (currently )?(located|based)|^current location|^location city/.test(L)) return a(p.location, "profile.location");
    if (/^(current )?(company|employer|organization)$|^current (company|employer|organization)/.test(L)) {
      return a(p.masterResume?.structured?.experience[0]?.company, "profile.masterResume.experience[0].company");
    }
  }
  if (f.kind === "combobox" && !f.options?.length && /^(location|city|current location)/.test(norm(f.label))) {
    return a(p.location, "profile.location");
  }
  if (/^country$|^country of residence/.test(norm(f.label)) && p.country) {
    let name = p.country;
    try {
      name = new Intl.DisplayNames(["en"], { type: "region" }).of(p.country.toUpperCase()) ?? p.country;
    } catch {
      /* keep code */
    }
    return a(name, "profile.country");
  }
  return null;
}

const DEMOGRAPHIC = /\b(gender|sex|race|ethnic|hispanic|latino|veteran|disabilit|sexual orientation|transgender|pronoun)/i;
const DECLINE = /decline|prefer not|don.?t wish|do not wish|not to (say|answer|disclose)|choose not|rather not|i don.?t want/i;

/** Pick the option that best matches a free-text answer. */
export function matchOption<T extends { label: string }>(options: T[], answer: string): T | null {
  const a = norm(answer);
  if (!a) return null;
  let best: { o: T; s: number } | null = null;
  for (const o of options) {
    const l = norm(o.label);
    if (!l) continue;
    let s = 0;
    if (l === a) s = 100;
    else if (l.startsWith(a) || a.startsWith(l)) s = 70 + Math.min(l.length, a.length) / Math.max(l.length, a.length) * 20;
    else if (l.includes(a) || a.includes(l)) s = 50 + Math.min(l.length, a.length) / Math.max(l.length, a.length) * 20;
    else {
      const yn = /^(yes|no)\b/.exec(a)?.[1];
      if (yn && new RegExp(`^${yn}\\b`).test(l)) s = 60;
      else {
        const aw = new Set(a.split(" "));
        const lw = l.split(" ");
        const common = lw.filter((w) => w.length > 2 && aw.has(w)).length;
        if (common) s = 20 + (common / Math.max(lw.length, aw.size)) * 30;
      }
    }
    if (s > 0 && (!best || s > best.s)) best = { o, s };
  }
  return best && best.s >= 35 ? best.o : null;
}

function isTruthy(answer: string): boolean {
  return /^(yes|y|true|checked|check|agree|i agree|accept|on|1)\b/i.test(answer.trim());
}

// ---------------------------------------------------------------------------------------------
// Filling one field
// ---------------------------------------------------------------------------------------------

const PICK_OPTION_SCRIPT = String.raw`(arg) => {
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const norm = (s) => clean(s).toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim();
  const opts = Array.from(document.querySelectorAll('[role=option]')).filter((o) => { const r = o.getBoundingClientRect(); return r.width > 0 && r.height > 0 && o.getAttribute('aria-disabled') !== 'true'; });
  if (!opts.length) return { picked: null, count: 0 };
  const a = norm(arg.answer);
  let best = null, bestS = 0;
  for (const o of opts) {
    const l = norm(o.innerText || o.textContent);
    let s = 0;
    if (l === a) s = 100; else if (l.startsWith(a) || a.startsWith(l)) s = 80; else if (l.includes(a) || a.includes(l)) s = 60;
    if (s > bestS) { best = o; bestS = s; }
  }
  if (!best && arg.allowFirst) best = opts[0];
  if (!best) return { picked: null, count: opts.length };
  if (!best.getAttribute('data-ja-id')) best.setAttribute('data-ja-id', 'opt' + Date.now());
  return { picked: best.getAttribute('data-ja-id'), label: clean(best.innerText), count: opts.length };
}`;

const SET_SELECT_SCRIPT = String.raw`(arg) => {
  const el = document.querySelector('[data-ja-id="' + arg.id + '"]');
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(el, arg.value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value === arg.value;
}`;

const DOM_CLICK_SCRIPT = String.raw`(arg) => {
  const el = document.querySelector('[data-ja-id="' + arg.id + '"]');
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  el.click();
  return true;
}`;

const STATE_SCRIPT = String.raw`(arg) => {
  const el = document.querySelector('[data-ja-id="' + arg.id + '"]');
  if (!el) return null;
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  if (el.tagName === 'SELECT') return clean(el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : '');
  if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'checked' : '';
  if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list') {
    const control = el.closest('[class*="control" i]') || el.parentElement;
    const container = (control && control.parentElement) || el.parentElement;
    const sv = container && container.querySelector('[class*="singleValue" i], [class*="single-value" i], [class*="multiValue" i], [class*="multi-value" i]');
    if (sv) return clean(sv.innerText);
    return clean(el.value || (el.tagName !== 'INPUT' ? el.innerText : ''));
  }
  if (el.tagName === 'BUTTON') return (el.getAttribute('aria-pressed') === 'true' || /(^|[\s_-])(active|selected|checked)/i.test(String(el.className))) ? 'checked' : '';
  return clean(el.value);
}`;

async function stateOf(ctx: Ctx, id: string): Promise<string | null> {
  return run<string | null>(ctx.page, STATE_SCRIPT, { id }).catch(() => null);
}

async function clickById(ctx: Ctx, id: string): Promise<void> {
  try {
    await ctx.page.locator(sel(id)).click({ timeout: 5000 });
  } catch {
    await run(ctx.page, DOM_CLICK_SCRIPT, { id });
  }
}

async function ensureChecked(ctx: Ctx, id: string, want: boolean): Promise<boolean> {
  const cur = (await stateOf(ctx, id)) === "checked";
  if (cur === want) return true;
  await clickById(ctx, id);
  await ctx.page.waitForTimeout(200);
  if (((await stateOf(ctx, id)) === "checked") === want) return true;
  await run(ctx.page, DOM_CLICK_SCRIPT, { id });
  await ctx.page.waitForTimeout(200);
  return ((await stateOf(ctx, id)) === "checked") === want;
}

/** Fill a single collected field. Returns the value actually set (for the audit trail) or null. */
export async function fillField(ctx: Ctx, f: DomField, answer: string): Promise<string | null> {
  const page = ctx.page;
  const loc = page.locator(sel(f.id));
  switch (f.kind) {
    case "text":
    case "textarea": {
      try {
        await loc.fill(answer, { timeout: 8000 });
      } catch {
        try {
          await loc.click({ timeout: 5000 });
          await loc.type(answer);
        } catch {
          /* fall through to verification */
        }
      }
      const v = await stateOf(ctx, f.id);
      if (v && norm(v) === norm(answer)) return answer;
      if (v && v.length > 0 && answer.length > 0 && norm(v).startsWith(norm(answer).slice(0, 10))) return v;
      // Some inputs reformat (phone masks) — accept any non-empty value for tel inputs.
      if (v && f.type === "tel") return v;
      return null;
    }
    case "select": {
      const opt = matchOption(f.options ?? [], answer);
      if (!opt) return null;
      try {
        await loc.selectOption(opt.value, { timeout: 8000 });
      } catch {
        await run(page, SET_SELECT_SCRIPT, { id: f.id, value: opt.value });
      }
      const v = await stateOf(ctx, f.id);
      if (v && norm(v) === norm(opt.label)) return opt.label;
      if (await run<boolean>(page, SET_SELECT_SCRIPT, { id: f.id, value: opt.value })) return opt.label;
      return null;
    }
    case "combobox": {
      const known = f.options?.length ? matchOption(f.options, answer) : null;
      if (f.options?.length && !known) return null;
      const typed = (known?.label ?? answer).slice(0, 60);
      try {
        await loc.click({ timeout: 5000 });
        await page.waitForTimeout(250);
        await loc.type(typed);
      } catch {
        return null;
      }
      // async search results take a moment
      let pick: { picked: string | null; label?: string; count: number } = { picked: null, count: 0 };
      for (let i = 0; i < 6 && !pick.picked; i++) {
        await page.waitForTimeout(500);
        pick = await run<typeof pick>(page, PICK_OPTION_SCRIPT, { answer: known?.label ?? answer, allowFirst: !f.options?.length });
      }
      if (pick.picked) await clickById(ctx, pick.picked);
      else await page.keyPress("Enter").catch(() => {});
      await page.waitForTimeout(300);
      const v = await stateOf(ctx, f.id);
      return v ? pick.label ?? v : null;
    }
    case "radio":
    case "buttons": {
      const opt = matchOption(f.options ?? [], answer);
      if (!opt?.id) return null;
      if (f.kind === "buttons") {
        await clickById(ctx, opt.id);
        return opt.label;
      }
      return (await ensureChecked(ctx, opt.id, true)) ? opt.label : null;
    }
    case "checkbox": {
      return (await ensureChecked(ctx, f.id, isTruthy(answer))) ? (isTruthy(answer) ? "checked" : "unchecked") : null;
    }
    case "checkboxes": {
      const opts = f.options ?? [];
      const wanted = opts.filter((o) => {
        const l = norm(o.label);
        return l && (norm(answer).includes(l) || answer.split(/[,;|\n]/).some((p) => norm(p) === l));
      });
      const chosen = wanted.length ? wanted : [matchOption(opts, answer)].filter((x): x is DomOption => !!x);
      if (!chosen.length) return null;
      for (const o of chosen) if (o.id) await ensureChecked(ctx, o.id, true);
      return chosen.map((o) => o.label).join(", ");
    }
    case "ai":
      return (await aiFill(ctx, f, answer)) ? answer : null;
    case "file":
      return null;
  }
}

/** Stagehand natural-language fallback for one field. */
export async function aiFill(ctx: Ctx, f: DomField, answer: string): Promise<boolean> {
  const choice = f.options?.length || ["select", "radio", "checkbox"].includes(f.type);
  const instruction = choice
    ? `For the application question labelled "${f.label}", choose the option %value%`
    : `Type %value% into the application form field labelled "${f.label}"`;
  try {
    const r = await ctx.stagehand.act(instruction, { page: ctx.page, variables: { value: answer }, timeout: 45_000 });
    ctx.log(`act(${f.label}) → ${r.data.success ? "ok" : r.data.message}`);
    return r.data.success;
  } catch (e) {
    ctx.log(`act(${f.label}) failed: ${errMsg(e)}`);
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Files on the form
// ---------------------------------------------------------------------------------------------

/**
 * Upload resume / cover letter into the collected file fields. Unknown REQUIRED uploads become
 * questions. Returns questions (empty when fine).
 */
export async function handleFileFields(ctx: Ctx, fields: DomField[]): Promise<NonNullable<ApplyResult["questions"]>> {
  const questions: NonNullable<ApplyResult["questions"]> = [];
  const files = fields.filter((f) => f.kind === "file");
  for (const f of files) {
    const L = norm(f.label + " " + f.name + " " + f.elId);
    if (/autofill/.test(L)) continue; // Ashby "autofill from resume" helper
    const isCover = /cover/.test(L);
    const isResume = !isCover && (/resume|cv|curriculum/.test(L) || files.length === 1);
    if (f.value) continue; // already uploaded in this session (or a saved file the site shows)
    if (isResume) {
      const ok = await uploadFile(ctx, [sel(f.id)], await resumePayload(ctx));
      if (ok) ctx.answers.push({ question: f.label, answer: basename(ctx.input.resumePdfPath), basis: ["resume"] });
      else if (f.required) questions.push({ text: `Upload failed for "${f.label}"`, whyNeeded: "The resume upload did not take; please check the file." });
      continue;
    }
    if (isCover) {
      const cl = await coverLetterPayload(ctx);
      if (cl && (await uploadFile(ctx, [sel(f.id)], cl))) {
        ctx.answers.push({ question: f.label, answer: cl.name, basis: ["coverLetter"] });
      } else if (f.required) {
        questions.push({ text: "This application requires a cover letter.", whyNeeded: `Required upload "${f.label}"; generate a cover letter for this job and retry.` });
      }
      continue;
    }
    if (f.required) {
      questions.push({ text: `The form requires a file upload: "${f.label}".`, whyNeeded: "The agent only has your resume and cover letter; provide this document or skip the job." });
    }
  }
  return questions;
}

// ---------------------------------------------------------------------------------------------
// The fill loop
// ---------------------------------------------------------------------------------------------

/**
 * Ask for an answer to every non-file field and fill it. If ANY required field gets confidence
 * below MIN_CONFIDENCE (or an empty / unmatchable answer), nothing is submitted: the caller gets
 * waiting_input with all such questions at once.
 */
export async function fillForm(
  ctx: Ctx,
  fields: DomField[],
  answer: (q: FieldQuestion) => Promise<FieldAnswer> = ctx.input.answer,
  opts: FillOptions = {},
): Promise<FillOutcome> {
  const questions: NonNullable<ApplyResult["questions"]> = [];
  const failures: string[] = [];
  let filled = 0;
  for (const f of fields) {
    if (f.kind === "file") continue;
    if (opts.skip?.(f)) continue;
    const q = toQuestion(f);
    let ans: FieldAnswer | null = opts.preset?.(f) ?? profileAnswer(f, ctx.input);
    const fromProfile = !!ans;
    if (f.value && !fromProfile && !opts.overwriteAll) {
      ctx.log(`keep prefilled "${f.label}" = ${f.value}`);
      continue;
    }
    if (!ans) {
      try {
        ans = await answer(q);
      } catch (e) {
        ans = { answer: "", confidence: 0, basis: [`answer() error: ${errMsg(e)}`] };
      }
    }
    // Voluntary EEO self-identification: decline when we are not sure.
    if ((ans.confidence < MIN_CONFIDENCE || !ans.answer.trim()) && DEMOGRAPHIC.test(f.label) && f.options?.length) {
      const decline = f.options.find((o) => DECLINE.test(o.label));
      if (decline) ans = { answer: decline.label, confidence: 0.9, basis: ["policy: decline voluntary self-identification"] };
    }
    const lowConf = ans.confidence < MIN_CONFIDENCE || !ans.answer.trim();
    const unmatchable = !!f.options?.length && f.kind !== "checkbox" && !matchOption(f.options, ans.answer) && !(f.kind === "checkboxes");
    if (lowConf || unmatchable) {
      if (f.required) {
        const why = lowConf
          ? `Required by the ${ctx.input.job.company} application; the agent is only ${Math.round(ans.confidence * 100)}% sure${ans.answer ? ` (best guess: "${ans.answer}")` : ""}.`
          : `Required by the ${ctx.input.job.company} application; the answer "${ans.answer}" does not match any option.`;
        questions.push({ text: q.options?.length ? `${f.label} (options: ${q.options.slice(0, 15).join(" / ")})` : f.label, whyNeeded: why });
      } else {
        ctx.log(`skip optional "${f.label}" (confidence ${ans.confidence})`);
      }
      continue;
    }
    if (questions.length) continue; // we will not submit anyway — do not waste time filling
    let set = await fillField(ctx, f, ans.answer).catch((e) => {
      ctx.log(`fill "${f.label}" error: ${errMsg(e)}`);
      return null;
    });
    if (set === null && f.kind !== "ai") set = (await aiFill(ctx, f, ans.answer)) ? ans.answer : null;
    if (set === null) {
      if (f.required) failures.push(f.label);
      else ctx.log(`could not fill optional "${f.label}"`);
      continue;
    }
    filled++;
    ctx.answers.push({ question: f.label, answer: set, basis: ans.basis });
  }
  if (questions.length) return { status: "waiting_input", questions };
  if (failures.length) return { status: "failed", error: `Could not fill required field(s): ${failures.join("; ")}` };
  return { status: "ok", filled };
}

/** Convenience: turn a non-ok FillOutcome into an ApplyResult (with screenshot). */
export async function outcomeResult(ctx: Ctx, o: Exclude<FillOutcome, { status: "ok" }>): Promise<ApplyResult> {
  const screenshot = await safeScreenshot(ctx.page);
  if (o.status === "waiting_input") return result(ctx, "waiting_input", { questions: o.questions, screenshot });
  return result(ctx, "failed", { error: o.error, screenshot });
}

// ---------------------------------------------------------------------------------------------
// Buttons + submit
// ---------------------------------------------------------------------------------------------

const FIND_BUTTON_SCRIPT = String.raw`(arg) => {
  const root = (arg.scope && document.querySelector(arg.scope)) || document.body;
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const re = new RegExp(arg.pattern, 'i');
  const vis = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
  const cands = Array.from(root.querySelectorAll('button, input[type=submit], input[type=button], a, [role=button]'));
  for (const el of cands) {
    const t = clean(el.innerText || el.value || '') || clean(el.getAttribute('aria-label') || '');
    const aria = clean(el.getAttribute('aria-label') || '');
    if (!(re.test(t) || re.test(aria))) continue;
    if (!vis(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    if (!el.getAttribute('data-ja-id')) el.setAttribute('data-ja-id', 'b' + Math.random().toString(36).slice(2, 9));
    return { id: el.getAttribute('data-ja-id'), text: t || aria, href: el.tagName === 'A' ? el.href : null, target: el.getAttribute('target') };
  }
  return null;
}`;

export interface FoundButton {
  id: string;
  text: string;
  href: string | null;
  target: string | null;
  selector: string;
}

/** Find a visible, enabled button/link whose text or aria-label matches. */
export async function findButton(ctx: Ctx, pattern: RegExp, scope?: string): Promise<FoundButton | null> {
  const r = await run<Omit<FoundButton, "selector"> | null>(ctx.page, FIND_BUTTON_SCRIPT, { pattern: pattern.source, scope: scope ?? null }).catch(() => null);
  return r ? { ...r, selector: sel(r.id) } : null;
}

/** First visible match among CSS selectors. */
export async function firstVisible(ctx: Ctx, selectors: string[]): Promise<string | null> {
  for (const s of selectors) {
    try {
      const loc = ctx.page.locator(s).first();
      if ((await loc.count()) > 0 && (await loc.isVisible())) return s;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function clickSelector(ctx: Ctx, selector: string): Promise<void> {
  try {
    await ctx.page.locator(selector).first().click({ timeout: 8000 });
  } catch {
    // e.g. covered by a sticky footer: dispatch a DOM click instead
    await ctx.page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { el.scrollIntoView({block:'center'}); el.click(); } return !!el; })()`);
  }
}

const VALIDATION_SCRIPT = String.raw`(arg) => {
  const root = (arg && arg.scope && document.querySelector(arg.scope)) || document.body;
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const msgs = new Set();
  for (const el of Array.from(root.querySelectorAll('[role=alert], .error, .field-error, .error-message, [class*="error-message" i], [class*="errorMessage"], [class*="inline-feedback--error"], [class*="_error_"], .application-error, [data-testid*="error" i]'))) {
    if (!vis(el)) continue;
    const t = clean(el.innerText);
    if (t && t.length > 1 && t.length < 240) msgs.add(t);
  }
  const invalid = Array.from(root.querySelectorAll('[aria-invalid="true"]')).filter(vis).length;
  return { messages: Array.from(msgs).slice(0, 8), invalid: invalid };
}`;

export async function validationErrors(ctx: Ctx, scope?: string): Promise<{ messages: string[]; invalid: number }> {
  return run<{ messages: string[]; invalid: number }>(ctx.page, VALIDATION_SCRIPT, { scope: scope ?? null }).catch(() => ({ messages: [], invalid: 0 }));
}

export interface SubmitSpec {
  /** CSS selectors for the final submit button, tried in order */
  selectors: string[];
  /** text pattern fallback for the final submit button */
  text: RegExp;
  /** Stagehand observe instruction (last fallback) */
  nl: string;
  /** page text that proves success */
  success: RegExp;
  successUrl?: RegExp;
  successSelector?: string;
  scope?: string;
  timeoutMs?: number;
}

const PAGE_TEXT = `(() => String((document.body && document.body.innerText) || '').slice(0, 20000))()`;

/**
 * The ONLY place that clicks a final submit button. In dry-run mode it never clicks: it takes the
 * screenshot of the completed form and returns dry_run_ok.
 */
export async function submitApplication(ctx: Ctx, spec: SubmitSpec): Promise<ApplyResult> {
  if (ctx.input.dryRun) {
    ctx.log("dry run — not submitting");
    return result(ctx, "dry_run_ok", { screenshot: await safeScreenshot(ctx.page) });
  }
  if (ctx.cancelled) throw new Error("cancelled before submit");
  // Remember what the page said BEFORE the click so pre-existing "thank you for your interest"
  // copy is not mistaken for a confirmation.
  const beforeText = await ctx.page.evaluate<string>(PAGE_TEXT).catch(() => "");
  const beforeUrl = await ctx.page.url().catch(() => "");

  let selector = await firstVisible(ctx, spec.selectors);
  if (!selector) selector = (await findButton(ctx, spec.text, spec.scope))?.selector ?? null;
  if (selector) {
    ctx.log(`submit via ${selector}`);
    await clickSelector(ctx, selector);
  } else {
    const { data } = await ctx.stagehand.observe(spec.nl, { page: ctx.page });
    const action = data[0];
    if (!action) return result(ctx, "failed", { error: "Submit button not found", screenshot: await safeScreenshot(ctx.page) });
    ctx.log(`submit via observe: ${action.description}`);
    await ctx.stagehand.act(action, { page: ctx.page });
  }
  const first = await confirmSubmitted(ctx, spec, { text: beforeText, url: beforeUrl });

  // The user allowed ticking REQUIRED consent boxes: only after the form rejected the submission
  // for a missing required entry do we tick unchecked consent/privacy checkboxes and resubmit once.
  if (first.status === "failed" && ctx.input.acceptRequiredConsent && /required|missing|corrections|invalid/i.test(first.error ?? "")) {
    const ticked = await ctx.page.evaluate<string[]>(TICK_CONSENT).catch(() => [] as string[]);
    if (ticked.length) {
      ctx.log(`ticked required consent: ${ticked.map((t) => `"${t.slice(0, 60)}…"`).join(", ")}`);
      const again = selector ?? (await findButton(ctx, spec.text, spec.scope))?.selector ?? null;
      if (again) {
        await clickSelector(ctx, again);
        const second = await confirmSubmitted(ctx, spec, { text: beforeText, url: beforeUrl });
        second.answers.push(...ticked.map((t) => ({ question: t.slice(0, 200), answer: "checked (required consent)", basis: ["settings.consent.acceptRequired"] })));
        return second;
      }
    }
  }
  return first;
}

/** Ticks unchecked checkboxes whose label reads like a data-processing / privacy consent. Returns their labels. */
const TICK_CONSENT = `(() => {
  const RE = /(consent|privacy|personal data|data protection|gdpr|recruitment policy|terms|agree|processing of my)/i;
  const out = [];
  for (const cb of Array.from(document.querySelectorAll('input[type=checkbox]'))) {
    if (cb.checked || cb.disabled) continue;
    const label = (cb.labels && cb.labels[0] && cb.labels[0].innerText) || (cb.closest('label, div, li') || cb.parentElement || {}).innerText || '';
    if (!RE.test(label)) continue;
    cb.click();
    if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    out.push(label.trim());
  }
  return out;
})()`;

/** Poll for the success state after a submit click. */
export async function confirmSubmitted(ctx: Ctx, spec: SubmitSpec, before = { text: "", url: "" }): Promise<ApplyResult> {
  const preMatched = spec.success.test(before.text);
  const deadline = Date.now() + (spec.timeoutMs ?? 30_000);
  let errors: { messages: string[]; invalid: number } = { messages: [], invalid: 0 };
  const started = Date.now();
  while (Date.now() < deadline) {
    await ctx.page.waitForTimeout(1000);
    const url = await ctx.page.url().catch(() => "");
    const text = await ctx.page.evaluate<string>(PAGE_TEXT).catch(() => "");
    let selHit = false;
    if (spec.successSelector) selHit = (await ctx.page.locator(spec.successSelector).count().catch(() => 0)) > 0;
    const textHit = spec.success.test(text) && (!preMatched || (url !== before.url && url !== ""));
    const urlHit = !!spec.successUrl && spec.successUrl.test(url) && !spec.successUrl.test(before.url);
    if (selHit || textHit || urlHit) {
      ctx.log("submission confirmed");
      return result(ctx, "applied", { screenshot: await safeScreenshot(ctx.page) });
    }
    if (/(security|verification) code|we (just )?sent (a|an) (code|email)|enter the code|check your (email|inbox) for/i.test(text)) {
      return result(ctx, "blocked", {
        error: "The site asked for an email verification code after submit — finish this one manually",
        screenshot: await safeScreenshot(ctx.page),
      });
    }
    const bl = await detectBlocker(ctx);
    if (bl.kind === "captcha" || bl.kind === "human") {
      return result(ctx, "blocked", { error: "CAPTCHA appeared on submit — the agent will not solve it", screenshot: await safeScreenshot(ctx.page) });
    }
    errors = await validationErrors(ctx, spec.scope);
    // Give the page a few seconds before deciding the visible errors are real.
    if (Date.now() - started > 6000 && (errors.messages.length || errors.invalid)) break;
  }
  const msg = errors.messages.length
    ? `Form rejected the submission: ${errors.messages.join(" | ")}`
    : errors.invalid
      ? `Form rejected the submission: ${errors.invalid} field(s) marked invalid`
      : "Submitted but no confirmation was detected — check the screenshot";
  return result(ctx, "failed", { error: msg, screenshot: await safeScreenshot(ctx.page) });
}

/** Collect → upload files → fill. Shared by the single-page ATS appliers. */
export async function collectUploadFill(
  ctx: Ctx,
  collect: CollectOptions,
  fill: FillOptions = {},
): Promise<FillOutcome> {
  let { fields } = await collectFields(ctx, collect);
  if (!fields.filter((f) => f.kind !== "file").length) {
    ctx.log("no DOM fields found — falling back to stagehand.extract");
    fields = await collectFieldsAI(ctx).catch(() => []);
  }
  const fileQs = await handleFileFields(ctx, fields);
  // Uploading a resume can reveal / prefill fields — re-read the DOM afterwards.
  if (fields.some((f) => f.kind === "file") && fields.every((f) => f.kind !== "ai")) {
    ({ fields } = await collectFields(ctx, collect));
  }
  const res = await fillForm(ctx, fields, ctx.input.answer, fill);
  if (fileQs.length) {
    const qs = res.status === "waiting_input" ? [...fileQs, ...res.questions] : fileQs;
    return { status: "waiting_input", questions: qs };
  }
  return res;
}
