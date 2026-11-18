// Shared helpers for the agent API (Vercel Functions, free Hobby plan).
import { getAuth } from "firebase-admin/auth";
import { firestore } from "../src/db";

const ALLOWED = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5180").split(",").map((s) => s.trim());

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req) } });
}

/** Verifies the Firebase ID token from the dashboard and returns the user's uid. */
export async function requireUid(req: Request): Promise<string> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in first.");
  firestore(); // initializes the Admin app
  try {
    return (await getAuth().verifyIdToken(token)).uid;
  } catch {
    throw new HttpError(401, "Your session expired — sign in again.");
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function handle(req: Request, fn: () => Promise<unknown>) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  try {
    return json(req, 200, await fn());
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json(req, status, { error: (e as Error).message });
  }
}
