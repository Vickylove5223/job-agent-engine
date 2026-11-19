// Shared helpers for the API job sources: HTTP with timeouts, HTML → text, apply-method detection.
import type { ApplyMethod } from "@shared/types";
import type { SourceContext } from "../contracts";

export const REQUEST_TIMEOUT_MS = 15_000;
export const USER_AGENT = "JobAgent/0.1";
export const MAX_DESCRIPTION = 8_000;

/** SourceContext plus an optional sink for non-fatal errors (one board failing, etc.). */
export interface ScanContext extends SourceContext {
  onError?: (message: string) => void;
}

export class HttpError extends Error {
  constructor(public status: number, public url: string) {
    super(`HTTP ${status} for ${url}`);
  }
}

async function request(url: string, headers: Record<string, string> = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json, application/xml, text/xml, */*", ...headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    const err = e as Error;
    const reason = err.name === "TimeoutError" ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : err.message;
    throw new Error(`${reason} (${url})`);
  }
  if (!res.ok) {
    // drain the body so the socket can be reused
    await res.text().catch(() => "");
    throw new HttpError(res.status, url);
  }
  return res;
}

export async function fetchJson<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await request(url, headers);
  return (await res.json()) as T;
}

export async function fetchText(url: string, headers?: Record<string, string>): Promise<string> {
  const res = await request(url, headers);
  return res.text();
}

/** Run `fn` over `items` with at most `concurrency` in flight. Never rejects; failures go to onError. */
export async function pool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  onError?: (item: T, err: unknown) => void,
): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        out.push(await fn(item));
      } catch (e) {
        onError?.(item, e);
      }
    }
  });
  await Promise.all(workers);
  return out;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", middot: "·", euro: "€", pound: "£",
  copy: "©", reg: "®", trade: "™", eacute: "é", egrave: "è", ouml: "ö", uuml: "ü", auml: "ä", szlig: "ß",
  laquo: "«", raquo: "»", times: "×", deg: "°", zwj: "", zwnj: "", shy: "",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** HTML (possibly entity-escaped, as Greenhouse returns it) → readable plain text. */
export function htmlToText(html: string | null | undefined, max = MAX_DESCRIPTION): string {
  if (!html) return "";
  let s = html;
  // Greenhouse / RSS double-encode: "&lt;p&gt;" → "<p>"
  if (/&lt;[a-z/!]/i.test(s)) s = decodeEntities(s);
  s = s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = decodeEntities(s)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return truncate(s, max);
}

export function truncate(s: string, max = MAX_DESCRIPTION): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/** Which applier can handle this URL. */
export function detectApplyMethod(url: string | undefined | null): ApplyMethod {
  if (!url) return "external";
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "external";
  }
  if (host === "greenhouse.io" || host.endsWith(".greenhouse.io")) return "greenhouse";
  if (host === "lever.co" || host.endsWith(".lever.co")) return "lever";
  if (host === "ashbyhq.com" || host.endsWith(".ashbyhq.com")) return "ashby";
  return "external";
}

const ATS_LINK_RE =
  /https?:\/\/(?:job-boards(?:\.eu)?\.greenhouse\.io|boards(?:\.eu)?\.greenhouse\.io|jobs(?:\.eu)?\.lever\.co|jobs\.ashbyhq\.com)\/[^\s"'<>)]+/i;

/**
 * Aggregators (Remotive, RemoteOK, Himalayas, WWR) link to their own listing page. When the
 * description itself links to a supported ATS posting, prefer that as the apply URL.
 */
export function resolveApply(listingUrl: string, ...texts: (string | undefined | null)[]): { applyUrl: string; applyMethod: ApplyMethod } {
  const direct = detectApplyMethod(listingUrl);
  if (direct !== "external") return { applyUrl: listingUrl, applyMethod: direct };
  for (const t of texts) {
    if (!t) continue;
    const m = (/&lt;|&quot;/.test(t) ? decodeEntities(t) : t).match(ATS_LINK_RE);
    if (m) {
      const url = m[0].replace(/[.,;]+$/, "");
      return { applyUrl: url, applyMethod: detectApplyMethod(url) };
    }
  }
  return { applyUrl: listingUrl, applyMethod: "external" };
}

const CURRENCY_SYMBOL: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "₦": "NGN" };

/**
 * Best-effort yearly salary parse from free text such as "$170k - $200k", "€60,000–€75,000",
 * "EUR 55.000 - 70.000". Returns undefined for hourly/unclear figures.
 */
export function parseSalaryText(text: string | undefined | null, fallbackCurrency?: string): { min?: number; max?: number; currency: string } | undefined {
  if (!text) return undefined;
  const t = text.replace(/ /g, " ");
  if (/\b(per hour|\/ ?h(ou)?r|hourly|an hour)\b/i.test(t)) return undefined;
  const re = /([$€£₦]|\b(?:USD|EUR|GBP|NGN|CAD|AUD)\b)?\s?(\d{1,3}(?:[.,]\d{3})+|\d+(?:\.\d+)?)\s?(k\b|K\b)?/g;
  const nums: { v: number; cur?: string }[] = [];
  for (const m of t.matchAll(re)) {
    const raw = m[2];
    let v = /[.,]\d{3}$/.test(raw) ? Number(raw.replace(/[.,]/g, "")) : Number(raw);
    if (m[3]) v *= 1000;
    if (!Number.isFinite(v) || v < 10_000 || v > 2_000_000) continue;
    const cur = m[1] ? CURRENCY_SYMBOL[m[1]] ?? m[1].toUpperCase() : undefined;
    nums.push({ v, cur });
    if (nums.length === 2) break;
  }
  if (!nums.length) return undefined;
  const currency = nums.find((n) => n.cur)?.cur ?? fallbackCurrency;
  if (!currency) return undefined;
  const vals = nums.map((n) => n.v).sort((a, b) => a - b);
  return vals.length === 2 ? { min: vals[0], max: vals[1], currency } : { min: vals[0], currency };
}

/** Looks remote from location / workplace text. */
export function looksRemote(...texts: (string | undefined | null)[]): boolean {
  return texts.some((t) => !!t && /\b(remote|anywhere|distributed|work from home|wfh|home[- ]based)\b/i.test(t));
}

export function toIso(v: string | number | undefined | null): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Newest first, then cap. */
export function newestFirst<T extends { postedAt?: string }>(jobs: T[], limit: number): T[] {
  return [...jobs].sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "")).slice(0, Math.max(0, limit));
}
