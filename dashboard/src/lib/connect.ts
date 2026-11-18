// Connecting a job-site account (LinkedIn, Indeed, ...) through the hosted browser.
// The real implementation calls the agent API, which opens a Browserbase Live View where the
// user signs in themselves; the login is saved in a Browserbase Context. Until that API is
// deployed, this reports that connecting is not available yet.
export const AGENT_API_URL: string | undefined = import.meta.env.VITE_AGENT_API_URL;

export const canConnectSites = Boolean(AGENT_API_URL);

export interface ConnectStart {
  sessionId: string;
  liveViewUrl: string;
}

export async function startSiteLogin(siteId: string, idToken: string): Promise<ConnectStart> {
  if (!AGENT_API_URL) throw new Error("Account connections become available once the agent service is deployed.");
  const res = await fetch(`${AGENT_API_URL}/connect/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ siteId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function finishSiteLogin(siteId: string, sessionId: string, idToken: string): Promise<void> {
  if (!AGENT_API_URL) throw new Error("Agent service not deployed.");
  const res = await fetch(`${AGENT_API_URL}/connect/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ siteId, sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
}
