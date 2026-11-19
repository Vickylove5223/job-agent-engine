// Vite dev plugin providing `/connect/start` and `/connect/finish` endpoints
// for the embedded hosted browser (Browserbase Live View).
import type { Plugin } from "vite";

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY || "";
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || "acf01c7d-02cf-46fe-bf87-9237d0493caa";
const BROWSERBASE_REGION = process.env.BROWSERBASE_REGION || "us-east-1";

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

function checkAuthStatus(siteId: string, currentUrl: string, cookieNames: string[] = []): { ok: boolean; reason?: string } {
  const url = currentUrl.toLowerCase();
  if (!url || url === "about:blank") {
    return { ok: false, reason: "The browser window is still loading. Please wait for the site to display." };
  }

  if (siteId === "linkedin") {
    const hasLiAt = cookieNames.includes("li_at");
    const isStillLogin = url.includes("/login") || url.includes("/checkpoint") || url.includes("/uas/login") || url.includes("/authwall");
    const isFeed = url.includes("/feed") || url.includes("/jobs") || url.includes("/in/") || url.includes("/mynetwork");
    if (hasLiAt || isFeed || (!isStillLogin && url.includes("linkedin.com"))) {
      return { ok: true };
    }
    if (url.includes("/checkpoint")) {
      return { ok: false, reason: "LinkedIn is showing a security check. Please finish solving it in the browser first." };
    }
    return { ok: false, reason: "You appear to still be on the LinkedIn sign-in page. Please complete signing in before confirming." };
  }

  if (siteId === "indeed") {
    const hasCookie = cookieNames.some((c) => ["SURF", "JSESSIONID", "INDEED_CSRF_TOKEN", "SHOE", "CSRF"].includes(c));
    const isStillLogin = url.includes("/auth") || url.includes("/login") || url.includes("/account/login");
    if (hasCookie || (!isStillLogin && url.includes("indeed.com"))) {
      return { ok: true };
    }
    return { ok: false, reason: "You appear to still be on the Indeed sign-in page. Please complete signing in before confirming." };
  }

  if (siteId === "jobberman") {
    const isStillLogin = url.includes("/login") || url.includes("/account/login");
    const isSeeker = url.includes("/seeker") || url.includes("/dashboard");
    if (isSeeker || (!isStillLogin && url.includes("jobberman.com"))) {
      return { ok: true };
    }
    return { ok: false, reason: "You appear to still be on the Jobberman sign-in page. Please complete signing in before confirming." };
  }

  const isGenericLogin = url.includes("/login") || url.includes("/signin") || url.includes("/auth");
  if (!isGenericLogin) {
    return { ok: true };
  }
  return { ok: false, reason: `Please complete signing in to ${siteId} before confirming.` };
}

export function connectPlugin(): Plugin {
  return {
    name: "hosted-browser-connect",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/connect", async (req, res) => {
        const send = (code: number, data: unknown) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        };

        if (req.method === "OPTIONS") {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
          return send(204, {});
        }

        const url = req.url ?? "/";
        let body = "";
        req.on("data", (chunk) => (body += chunk));

        req.on("end", async () => {
          let parsedBody: Record<string, unknown> = {};
          try {
            if (body) parsedBody = JSON.parse(body);
          } catch {
            // ignore
          }

          if (url.startsWith("/start") && req.method === "POST") {
            try {
              const siteId = String(parsedBody.siteId || "linkedin");
              let contextId = parsedBody.contextId ? String(parsedBody.contextId) : undefined;

              // 1. Create or use context
              if (!contextId) {
                try {
                  const ctxRes = await fetch("https://api.browserbase.com/v1/contexts", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "X-BB-API-Key": BROWSERBASE_API_KEY,
                    },
                    body: JSON.stringify({ projectId: BROWSERBASE_PROJECT_ID }),
                  });
                  if (ctxRes.ok) {
                    const ctxData = (await ctxRes.json()) as { id?: string };
                    contextId = ctxData.id;
                  }
                } catch {
                  // ignore context error, session will launch without context
                }
              }

              // 2. Launch keepAlive Browserbase session with ad-blocking and fast region
              const sessionPayload: Record<string, unknown> = {
                projectId: BROWSERBASE_PROJECT_ID,
                keepAlive: true,
                region: BROWSERBASE_REGION,
                browserSettings: {
                  blockAds: true,
                  recordSession: false,
                  logSession: false,
                  viewport: { width: 1280, height: 800 },
                  ...(contextId ? { context: { id: contextId, persist: true } } : {}),
                },
              };

              const sRes = await fetch("https://api.browserbase.com/v1/sessions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-BB-API-Key": BROWSERBASE_API_KEY,
                },
                body: JSON.stringify(sessionPayload),
              });

              if (!sRes.ok) {
                const errText = await sRes.text();
                throw new Error(`Browserbase session failed: ${errText}`);
              }

              const session = (await sRes.json()) as { id: string };

              // 3. Retrieve Live View debugger URLs
              const dRes = await fetch(`https://api.browserbase.com/v1/sessions/${session.id}/debug`, {
                headers: { "X-BB-API-Key": BROWSERBASE_API_KEY },
              });
              const debug = (await dRes.json()) as {
                debuggerFullscreenUrl?: string;
                debuggerUrl?: string;
                wsUrl?: string;
                pages?: { id: string; debuggerFullscreenUrl?: string; debuggerUrl?: string }[];
              };

              const targetUrl = LOGIN_URLS[siteId] || (siteId.startsWith("http") ? siteId : `https://${siteId}.com`);

              // 4. Navigate first page via CDP WebSocket using the session's actual regional host
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
                        const m = JSON.parse(event.data.toString());
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
                  // fallback to standard debug page
                }
              }

              // 5. Fetch updated debug page with navigated URL
              let liveViewUrl = debug.pages?.[0]?.debuggerFullscreenUrl || debug.debuggerFullscreenUrl || debug.debuggerUrl;
              try {
                const dRes2 = await fetch(`https://api.browserbase.com/v1/sessions/${session.id}/debug`, {
                  headers: { "X-BB-API-Key": BROWSERBASE_API_KEY },
                });
                if (dRes2.ok) {
                  const debug2 = (await dRes2.json()) as {
                    debuggerFullscreenUrl?: string;
                    debuggerUrl?: string;
                    pages?: { debuggerFullscreenUrl?: string; debuggerUrl?: string }[];
                  };
                  liveViewUrl =
                    debug2.pages?.[0]?.debuggerFullscreenUrl ||
                    debug2.debuggerFullscreenUrl ||
                    debug2.pages?.[0]?.debuggerUrl ||
                    debug2.debuggerUrl ||
                    liveViewUrl;
                }
              } catch {
                // keep previous liveViewUrl
              }

              return send(200, {
                sessionId: session.id,
                liveViewUrl,
                contextId,
              });
            } catch (err) {
              console.error("[connectPlugin] start failed:", err);
              return send(500, { error: (err as Error).message });
            }
          }

          if (url.startsWith("/finish") && req.method === "POST") {
            try {
              const sessionId = String(parsedBody.sessionId || "");
              const siteId = String(parsedBody.siteId || "");
              const force = Boolean(parsedBody.force);

              if (!sessionId) {
                return send(400, { error: "Missing sessionId" });
              }

              // 1. Verify that user actually signed in before closing
              if (!force && siteId) {
                try {
                  const dRes = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, {
                    headers: { "X-BB-API-Key": BROWSERBASE_API_KEY },
                  });
                  if (dRes.ok) {
                    const debug = (await dRes.json()) as {
                      pages?: { id: string; url: string }[];
                      wsUrl?: string;
                    };
                    const page = debug.pages?.[0];
                    const currentUrl = page?.url || "";
                    let cookies: string[] = [];

                    // Check cookies via CDP if wsUrl available
                    if (page?.id && debug.wsUrl && typeof WebSocket !== "undefined") {
                      try {
                        const urlObj = new URL(debug.wsUrl);
                        const host = urlObj.host;
                        const token = urlObj.searchParams.get("t");
                        const pageWsUrl = `wss://${host}/debug/${sessionId}/devtools/page/${page.id}${token ? "?t=" + token : ""}`;
                        const ws = new WebSocket(pageWsUrl);
                        cookies = await new Promise<string[]>((resolve) => {
                          const timer = setTimeout(() => {
                            try { ws.close(); } catch {}
                            resolve([]);
                          }, 1500);
                          ws.onopen = () => {
                            ws.send(JSON.stringify({ id: 10, method: "Network.enable" }));
                            ws.send(JSON.stringify({ id: 11, method: "Network.getCookies" }));
                          };
                          ws.onmessage = (event) => {
                            try {
                              const m = JSON.parse(event.data.toString());
                              if (m.id === 11 && m.result?.cookies) {
                                clearTimeout(timer);
                                ws.close();
                                resolve(m.result.cookies.map((c: { name: string }) => c.name));
                              }
                            } catch {
                              // ignore
                            }
                          };
                          ws.onerror = () => {
                            clearTimeout(timer);
                            resolve([]);
                          };
                        });
                      } catch {
                        // ignore cookie check error
                      }
                    }

                    const check = checkAuthStatus(siteId, currentUrl, cookies);
                    if (!check.ok) {
                      return send(400, {
                        ok: false,
                        error: check.reason,
                        currentUrl,
                        canForce: true,
                      });
                    }
                  }
                } catch {
                  // If debug check fails, proceed
                }
              }

              // 2. Verified or forced: release the session so cookies persist
              await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-BB-API-Key": BROWSERBASE_API_KEY,
                },
                body: JSON.stringify({
                  projectId: BROWSERBASE_PROJECT_ID,
                  status: "REQUEST_RELEASE",
                }),
              }).catch(() => {});

              return send(200, { ok: true, verified: true });
            } catch (err) {
              console.error("[connectPlugin] finish failed:", err);
              return send(500, { error: (err as Error).message });
            }
          }

          send(404, { error: "not found" });
        });
      });
    },
  };
}
