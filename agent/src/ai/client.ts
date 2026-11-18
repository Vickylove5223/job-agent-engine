// Gemini client for the AI module: structured JSON output, zod validation, rate limiting,
// backoff on 429/503 and an on-disk response cache (agent/.cache/ai/).
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** agent/.cache/ai */
export const CACHE_DIR = path.resolve(HERE, "../../.cache/ai");

export function hasModelKey(): boolean {
  return Boolean(process.env.MODEL_API_KEY);
}

export function modelName(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("Missing MODEL_API_KEY (Google AI Studio key). Add it to agent/.env.");
  client = new GoogleGenAI({ apiKey });
  return client;
}

// ---------------- rate limiter (sliding 60 s window) ----------------
const callTimes: number[] = [];
let queue: Promise<void> = Promise.resolve();

function rpm(): number {
  const n = Number(process.env.GEMINI_RPM);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolves when a request slot is free. Calls are serialized through a promise chain. */
function acquireSlot(): Promise<void> {
  const next = queue.then(async () => {
    for (;;) {
      const now = Date.now();
      while (callTimes.length && now - callTimes[0]! >= 60_000) callTimes.shift();
      if (callTimes.length < rpm()) {
        callTimes.push(now);
        return;
      }
      await sleep(60_000 - (now - callTimes[0]!) + 50);
    }
  });
  queue = next.catch(() => undefined);
  return next;
}

// ---------------- backoff ----------------
function statusOf(err: unknown): number | undefined {
  const e = err as { status?: unknown; code?: unknown; message?: unknown };
  if (typeof e?.status === "number") return e.status;
  if (typeof e?.code === "number") return e.code;
  const m = typeof e?.message === "string" ? e.message : "";
  const hit = m.match(/\b(429|500|503)\b/);
  return hit ? Number(hit[1]) : undefined;
}

function retryDelayHint(err: unknown): number | undefined {
  const m = String((err as { message?: unknown })?.message ?? "");
  const hit = m.match(/retry(?:Delay|\s+in)["':\s]*([\d.]+)s/i);
  return hit ? Math.ceil(Number(hit[1]) * 1000) : undefined;
}

const MAX_TRIES = 4;

async function callModel(args: {
  prompt: string;
  system?: string;
  jsonSchema: unknown;
  temperature: number;
}): Promise<string> {
  const ai = getClient();
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    await acquireSlot();
    try {
      const res = await ai.models.generateContent({
        model: modelName(),
        contents: args.prompt,
        config: {
          ...(args.system ? { systemInstruction: args.system } : {}),
          temperature: args.temperature,
          responseMimeType: "application/json",
          responseJsonSchema: args.jsonSchema,
        },
      });
      const text = res.text;
      if (!text) throw new Error("Gemini returned an empty response");
      return text;
    } catch (err) {
      lastErr = err;
      const status = statusOf(err);
      const retryable = status === 429 || status === 503 || status === 500;
      if (!retryable || attempt === MAX_TRIES) break;
      const base = 2000 * 2 ** (attempt - 1);
      const wait = Math.max(base, retryDelayHint(err) ?? 0) + Math.floor(Math.random() * 500);
      await sleep(Math.min(wait, 60_000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ---------------- cache ----------------
async function ensureCacheDir(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  // Keep cached model output (contains resume text) out of git.
  const ignore = path.resolve(CACHE_DIR, "..", ".gitignore");
  if (!existsSync(ignore)) await writeFile(ignore, "*\n", "utf8").catch(() => undefined);
}

function cacheKey(prompt: string): string {
  return createHash("sha256").update(modelName() + "\n" + prompt).digest("hex");
}

async function cacheGet(key: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, key + ".json"), "utf8"));
  } catch {
    return undefined;
  }
}

async function cachePut(key: string, value: unknown): Promise<void> {
  try {
    await ensureCacheDir();
    await writeFile(path.join(CACHE_DIR, key + ".json"), JSON.stringify(value), "utf8");
  } catch {
    /* cache is best-effort */
  }
}

// ---------------- JSON schema ----------------
/** zod → JSON Schema, minus keys Gemini's responseJsonSchema does not accept. */
export function toGeminiSchema(schema: z.ZodType): unknown {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "$schema" || k === "pattern" || k === "default") continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(raw);
}

export interface GenerateOpts {
  /** system instruction */
  system?: string;
  /** default 0.2 */
  temperature?: number;
  /** default true */
  cache?: boolean;
}

/**
 * Ask Gemini for JSON matching `schema`. Validates with zod; on invalid output retries once
 * with the validation error appended. Valid results are cached by sha256(model + prompt).
 */
export async function generateJson<T>(prompt: string, schema: z.ZodType<T>, opts: GenerateOpts = {}): Promise<T> {
  const useCache = opts.cache !== false;
  const jsonSchema = toGeminiSchema(schema);
  const fullPrompt = (opts.system ? `SYSTEM:\n${opts.system}\n\n` : "") + prompt + "\n\nSCHEMA:" + JSON.stringify(jsonSchema);
  const key = cacheKey(fullPrompt);

  if (useCache) {
    const hit = await cacheGet(key);
    if (hit !== undefined) {
      const parsed = schema.safeParse(hit);
      if (parsed.success) return parsed.data;
    }
  }

  const temperature = opts.temperature ?? 0.2;
  let currentPrompt = prompt;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callModel({ prompt: currentPrompt, system: opts.system, jsonSchema, temperature });
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      lastError = `Response was not valid JSON: ${(e as Error).message}`;
      currentPrompt = `${prompt}\n\nYour previous answer was rejected. ${lastError}\nPrevious answer:\n${text.slice(0, 4000)}\nReturn only valid JSON that matches the schema.`;
      continue;
    }
    const parsed = schema.safeParse(data);
    if (parsed.success) {
      if (useCache) await cachePut(key, parsed.data);
      return parsed.data;
    }
    lastError = z.prettifyError(parsed.error);
    currentPrompt = `${prompt}\n\nYour previous answer failed validation:\n${lastError}\nPrevious answer:\n${text.slice(0, 4000)}\nReturn corrected JSON that matches the schema exactly.`;
  }
  throw new Error(`Gemini output failed validation twice: ${lastError}`);
}
