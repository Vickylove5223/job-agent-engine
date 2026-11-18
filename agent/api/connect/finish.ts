// POST /api/connect/finish { siteId, sessionId } — ends the Live View session so the login is
// saved to the user's Browserbase context, then marks the site connected.
import { userDb, nowIso } from "../../src/db";
import { finishSiteLogin } from "../../src/connect";
import { HttpError, handle, requireUid } from "../_lib";

export const config = { maxDuration: 30 };

async function run(req: Request) {
  const uid = await requireUid(req);
  const { siteId, sessionId } = (await req.json()) as { siteId?: string; sessionId?: string };
  if (!siteId || !sessionId) throw new HttpError(400, "siteId and sessionId are required.");
  await finishSiteLogin(sessionId);
  await userDb(uid).update("connections", siteId, { status: "connected", connectedAt: nowIso(), lastCheckedAt: nowIso(), error: "" });
  return { ok: true };
}

export function OPTIONS(req: Request) {
  return handle(req, async () => null);
}
export function POST(req: Request) {
  return handle(req, () => run(req));
}
