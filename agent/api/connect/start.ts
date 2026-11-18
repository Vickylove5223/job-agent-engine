// POST /api/connect/start { siteId } → { sessionId, liveViewUrl }
// Opens a hosted browser on the site's login page; the user signs in inside the Live View.
import { JOB_SITES } from "../../../shared/src/sites";
import { userDb, nowIso } from "../../src/db";
import { startSiteLogin } from "../../src/connect";
import { HttpError, handle, requireUid } from "../_lib";

export const config = { maxDuration: 60 };

async function run(req: Request) {
  const uid = await requireUid(req);
  const { siteId } = (await req.json()) as { siteId?: string };
  if (!siteId || !JOB_SITES.some((s) => s.id === siteId)) throw new HttpError(400, "Unknown site.");
  const db = userDb(uid);
  // One Browserbase context per user holds all their logins.
  const existing = (await db.list("connections")).find((c) => c.contextId)?.contextId;
  const r = await startSiteLogin(siteId, existing);
  await db.update("connections", siteId, { status: "pending", contextId: r.contextId, lastCheckedAt: nowIso() });
  return { sessionId: r.sessionId, liveViewUrl: r.liveViewUrl };
}

export function OPTIONS(req: Request) {
  return handle(req, async () => null);
}
export function POST(req: Request) {
  return handle(req, () => run(req));
}
