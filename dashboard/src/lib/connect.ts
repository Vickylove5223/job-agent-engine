// Connecting job-site accounts (LinkedIn, Indeed, etc.) through the hosted browser.
// Uses Browserbase Live View so the user signs in directly in a secure remote browser session.
import { getCollectionOnce, logActivity, nowIso, setDocument } from "./db";

export const AGENT_API_URL: string | undefined =
  typeof import.meta !== "undefined"
    ? import.meta.env.VITE_AGENT_API_URL
    : typeof process !== "undefined"
      ? process.env?.VITE_AGENT_API_URL
      : undefined;

// SECURITY: secret keys must never ship in the public site bundle. The direct-to-Browserbase
// fallback below only works in LOCAL development with keys from the private dashboard/.env file;
// in production the dashboard must go through the agent API (VITE_AGENT_API_URL).
const BB_KEY: string = import.meta.env.DEV ? (import.meta.env.VITE_BROWSERBASE_API_KEY ?? "") : "";
const BB_PROJECT: string = import.meta.env.DEV ? (import.meta.env.VITE_BROWSERBASE_PROJECT_ID ?? "") : "";

const BB_REGION =
  (typeof import.meta !== "undefined" && import.meta.env.VITE_BROWSERBASE_REGION) ||
  (typeof process !== "undefined" && (process.env?.VITE_BROWSERBASE_REGION || process.env?.BROWSERBASE_REGION)) ||
  "us-east-1";

const LOGIN_URLS: Record<string, string> = {
  linkedin: "https://www.linkedin.com/login?locale=en_US",
  indeed: "https://secure.indeed.com/auth",
  glassdoor: "https://www.glassdoor.com/profile/login_input.htm",
  wellfound: "https://wellfound.com/login",
  jobberman: "https://www.jobberman.com/login",
  myjobmag: "https://www.myjobmag.com/login",
  dribbble: "https://dribbble.com/session/new",
  behance: "https://www.behance.net/gallery/login",
};

export const canConnectSites = true;

export interface ConnectStart {
  sessionId: string;
  liveViewUrl: string;
  contextId?: string;
}

export async function startSiteLogin(siteId: string, idToken?: string): Promise<ConnectStart> {
  const baseUrl = AGENT_API_URL ? AGENT_API_URL : "";

  // Check if we already have a saved Browserbase context for this user
  const existingConns = (await getCollectionOnce("connections").catch(() => [])) as any[];
  let contextId = existingConns.find((c: any) => c.contextId)?.contextId;

  // 1. Try local dev server / agent API endpoint first
  try {
    const res = await fetch(`${baseUrl}/connect/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ siteId, contextId }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fall back to direct Browserbase client call
  }

  // 2. Direct Browserbase API fallback
  try {
    if (!contextId) {
      try {
        const ctxRes = await fetch("https://api.browserbase.com/v1/contexts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BB-API-Key": BB_KEY,
          },
          body: JSON.stringify({ projectId: BB_PROJECT }),
        });
        if (ctxRes.ok) {
          const ctxData = (await ctxRes.json()) as { id?: string };
          contextId = ctxData.id;
        }
      } catch {
        // ignore
      }
    }

    const sessionRes = await fetch("https://api.browserbase.com/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BB-API-Key": BB_KEY,
      },
      body: JSON.stringify({
        projectId: BB_PROJECT,
        keepAlive: true,
        region: BB_REGION,
        browserSettings: {
          blockAds: true,
          recordSession: false,
          logSession: false,
          viewport: { width: 1280, height: 800 },
          ...(contextId ? { context: { id: contextId, persist: true } } : {}),
        },
      }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      throw new Error(`Could not start hosted browser: ${err}`);
    }

    const session = await sessionRes.json();
    const debugRes = await fetch(`https://api.browserbase.com/v1/sessions/${session.id}/debug`, {
      headers: { "X-BB-API-Key": BB_KEY },
    });
    const debug = await debugRes.json();

    const targetUrl = LOGIN_URLS[siteId] || (siteId.startsWith("http") ? siteId : `https://${siteId}.com`);

    // Navigate the first page via CDP WebSocket using the session's actual regional host
    if (debug.pages?.length && debug.wsUrl && typeof WebSocket !== "undefined") {
      const page = debug.pages[0];
      try {
        const urlObj = new URL(debug.wsUrl);
        const host = urlObj.host;
        const token = urlObj.searchParams.get("t");
        const wsUrl = `wss://${host}/debug/${session.id}/devtools/page/${page.id}${token ? "?t=" + token : ""}`;

        const ws = new WebSocket(wsUrl);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            try { ws.close(); } catch {}
            resolve();
          }, 4000);

          ws.onopen = () => {
            ws.send(JSON.stringify({ id: 1, method: "Emulation.setLocaleOverride", params: { locale: "en-US" } }));
            ws.send(JSON.stringify({ id: 2, method: "Network.enable" }));
            ws.send(JSON.stringify({ id: 3, method: "Network.setExtraHTTPHeaders", params: { headers: { "Accept-Language": "en-US,en;q=0.9" } } }));
            ws.send(JSON.stringify({ id: 4, method: "Page.navigate", params: { url: targetUrl } }));
          };
          ws.onmessage = (event) => {
            try {
              const m = JSON.parse(typeof event.data === "string" ? event.data : "");
              if (m.id === 4) {
                clearTimeout(timer);
                ws.close();
                resolve();
              }
            } catch {
              // ignore
            }
          };
          ws.onerror = () => {
            clearTimeout(timer);
            resolve();
          };
        });
      } catch {
        // ignore navigation errors
      }
    }

    let liveViewUrl = debug.pages?.[0]?.debuggerFullscreenUrl || debug.debuggerFullscreenUrl || debug.debuggerUrl;
    try {
      const dRes2 = await fetch(`https://api.browserbase.com/v1/sessions/${session.id}/debug`, {
        headers: { "X-BB-API-Key": BB_KEY },
      });
      if (dRes2.ok) {
        const debug2 = await dRes2.json();
        liveViewUrl =
          debug2.pages?.[0]?.debuggerFullscreenUrl ||
          debug2.debuggerFullscreenUrl ||
          debug2.pages?.[0]?.debuggerUrl ||
          debug2.debuggerUrl ||
          liveViewUrl;
      }
    } catch {
      // keep initial liveViewUrl
    }

    if (!liveViewUrl) {
      throw new Error("Browser session started, but live view URL was not generated.");
    }

    return {
      sessionId: session.id,
      liveViewUrl,
      contextId,
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to open hosted browser session");
  }
}

export async function finishSiteLogin(
  siteId: string,
  sessionId: string,
  idToken?: string,
  force = false,
  contextId?: string,
): Promise<void> {
  const baseUrl = AGENT_API_URL ? AGENT_API_URL : "";

  // 1. Check and release session via API endpoint
  try {
    const res = await fetch(`${baseUrl}/connect/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ siteId, sessionId, force }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || `Could not confirm sign-in to ${siteId}.`);
    }
  } catch (err) {
    if (err instanceof Error && (err.message.includes("sign-in page") || err.message.includes("security check") || err.message.includes("still"))) {
      throw err;
    }

    // Direct Browserbase fallback verification
    if (!force) {
      try {
        const dRes = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, {
          headers: { "X-BB-API-Key": BB_KEY },
        });
        if (dRes.ok) {
          const debug = await dRes.json();
          const currentUrl = (debug.pages?.[0]?.url || "").toLowerCase();
          if (currentUrl.includes("/login") || currentUrl.includes("/checkpoint") || currentUrl.includes("/auth")) {
            throw new Error(`You appear to still be on the sign-in page. Please complete signing in before confirming.`);
          }
        }
      } catch (checkErr) {
        if (checkErr instanceof Error && checkErr.message.includes("sign-in page")) throw checkErr;
      }
    }

    // Direct Browserbase release fallback
    try {
      await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BB-API-Key": BB_KEY,
        },
        body: JSON.stringify({
          projectId: BB_PROJECT,
          status: "REQUEST_RELEASE",
        }),
      });
    } catch {
      // ignore release error
    }
  }

  // 2. Record successful connection in database with persistent contextId
  await setDocument("connections", siteId, {
    status: "connected",
    ...(contextId ? { contextId } : {}),
    connectedAt: nowIso(),
    lastCheckedAt: nowIso(),
  });

  await logActivity("success", "connection", `Connected ${siteId} account via hosted browser (session saved).`);
}
