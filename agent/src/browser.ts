// Hosted browser layer: every browser runs on Browserbase — nothing is self-hosted.
// Stagehand drives the page with natural-language act/extract on top of it.
import Browserbase from "@browserbasehq/sdk";
import { Stagehand, browserbase, type Page, type StagehandBrowser } from "@browserbasehq/stagehand";
import { env } from "./env";

let sdk: Browserbase | null = null;
export function bb(): Browserbase {
  sdk ??= new Browserbase({ apiKey: env.browserbaseApiKey });
  return sdk;
}

export interface OpenOptions {
  /** Browserbase Context holding the user's saved logins (one per user). */
  contextId?: string;
  /** Write cookies back to the context when the session ends (true while logging in). */
  persist?: boolean;
  /** Keep the session alive after our connection drops (used for Live View logins). */
  keepAlive?: boolean;
  /** Session timeout in seconds (free plan caps sessions at ~15 min). */
  timeoutSec?: number;
}

export interface AgentBrowser {
  browser: StagehandBrowser;
  stagehand: Stagehand;
  page: Page;
  sessionId: string;
  close(): Promise<void>;
}

export async function openBrowser(opts: OpenOptions = {}): Promise<AgentBrowser> {
  const browser = await browserbase.launch({
    apiKey: env.browserbaseApiKey,
    projectId: env.browserbaseProjectId,
    keepAlive: opts.keepAlive,
    api_timeout: opts.timeoutSec ?? 600,
    browserSettings: opts.contextId ? { context: { id: opts.contextId, persist: opts.persist ?? false } } : undefined,
  });
  const stagehand = await Stagehand.create({
    browser,
    apiKey: env.browserbaseApiKey,
    model: { modelName: env.model, apiKey: env.modelApiKey },
  });
  const page = (await browser.context.activePage()) ?? (await browser.context.newPage());
  return {
    browser,
    stagehand,
    page,
    sessionId: browser.sessionId!,
    async close() {
      await stagehand.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

/** One context per user; it stores cookies for every site they sign into. */
export async function createContext(): Promise<string> {
  const ctx = await bb().contexts.create({ projectId: env.browserbaseProjectId });
  return ctx.id;
}

/** Embeddable Live View URL where the user can see and control the hosted browser. */
export async function liveViewUrl(sessionId: string): Promise<string> {
  const urls = await bb().sessions.debug(sessionId);
  return urls.debuggerFullscreenUrl;
}

/** Ends a keepAlive session so its context (and the user's login) is saved. */
export async function releaseSession(sessionId: string): Promise<void> {
  await bb().sessions.update(sessionId, { projectId: env.browserbaseProjectId, status: "REQUEST_RELEASE" });
}
