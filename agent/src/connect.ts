// "Connect LinkedIn/Indeed/…" flow. The user signs in themselves inside a Browserbase
// Live View embedded in the dashboard; we never see or store passwords. The login is saved
// in the user's Browserbase Context and reused by every later application run.
import { JOB_SITES } from "@shared/sites";
import { createContext, liveViewUrl, openBrowser, releaseSession } from "./browser";

const LOGIN_URLS: Record<string, string> = {
  linkedin: "https://www.linkedin.com/login",
  indeed: "https://secure.indeed.com/auth",
  glassdoor: "https://www.glassdoor.com/profile/login_input.htm",
  wellfound: "https://wellfound.com/login",
  jobberman: "https://www.jobberman.com/login",
};

export async function startSiteLogin(siteId: string, existingContextId?: string) {
  const site = JOB_SITES.find((s) => s.id === siteId);
  if (!site) throw new Error(`Unknown site ${siteId}`);
  const contextId = existingContextId ?? (await createContext());
  const b = await openBrowser({ contextId, persist: true, keepAlive: true, timeoutSec: 900 });
  await b.page.goto(LOGIN_URLS[siteId] ?? site.url);
  const url = await liveViewUrl(b.sessionId);
  // Drop our CDP connection but leave the keepAlive session running for the user.
  await b.stagehand.close().catch(() => {});
  return { sessionId: b.sessionId, liveViewUrl: url, contextId };
}

export async function finishSiteLogin(sessionId: string) {
  await releaseSession(sessionId);
  // Browserbase needs a few seconds to write the context after release.
  await new Promise((r) => setTimeout(r, 5000));
}
