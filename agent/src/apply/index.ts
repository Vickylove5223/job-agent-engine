// Applier entry point. applyTo(input) picks the applier for job.applyMethod, runs it in ONE hosted
// Browserbase session with a time budget (default 6 min), measures browser seconds and always
// closes the browser. In dryRun everything is filled and screenshotted but the final submit is
// never clicked (enforced in common.submitApplication) → status "dry_run_ok".
import type { ApplyMethod } from "@shared/types";
import type { Applier, ApplyInput, ApplyResult } from "../contracts";
import { ashbyApplier } from "./ashby";
import { DEFAULT_TIMEOUT_MS, methodFromUrl, runSession, type Runner } from "./common";
import { genericApplier } from "./generic";
import { greenhouseApplier } from "./greenhouse";
import { indeedApplier } from "./indeed";
import { leverApplier } from "./lever";
import { linkedinApplier } from "./linkedin";

export { ashbyApplier, genericApplier, greenhouseApplier, indeedApplier, leverApplier, linkedinApplier };
export { methodFromUrl } from "./common";

export const appliers: Applier[] = [greenhouseApplier, leverApplier, ashbyApplier, genericApplier, linkedinApplier, indeedApplier];

const RUNNERS: Record<ApplyMethod, { run: Runner; site?: string }> = {
  greenhouse: { run: (c) => greenhouseApplier.run(c) },
  lever: { run: (c) => leverApplier.run(c) },
  ashby: { run: (c) => ashbyApplier.run(c) },
  external: { run: (c) => genericApplier.run(c) },
  linkedin_easy: { run: linkedinApplier.run, site: "LinkedIn" },
  indeed: { run: indeedApplier.run, site: "Indeed" },
};

export interface ApplyToOptions {
  /** overall budget for the browser session (default 6 min — Browserbase free sessions are short) */
  timeoutMs?: number;
}

export async function applyTo(input: ApplyInput, opts: ApplyToOptions = {}): Promise<ApplyResult> {
  let method = input.job.applyMethod;
  // A job tagged "external" whose apply URL is actually on a known ATS goes straight to that applier.
  if (method === "external") {
    const byUrl = methodFromUrl(input.job.applyUrl || input.job.url);
    if (byUrl === "greenhouse" || byUrl === "lever" || byUrl === "ashby") method = byUrl;
  }
  const r = RUNNERS[method];
  if (!r) {
    return { status: "unsupported", answers: [], error: `No applier for apply method "${String(method)}"`, browserSeconds: 0 };
  }
  try {
    return await runSession(input, r.run, {
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      requiresContext: r.site ? { siteName: r.site } : undefined,
    });
  } catch (e) {
    // runSession already catches everything; this is a last line of defence (e.g. bad input).
    return { status: "failed", answers: [], error: e instanceof Error ? e.message : String(e), browserSeconds: 0 };
  }
}
