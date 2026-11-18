// Indeed Apply ("Apply now" → smartapply.indeed.com multi-step flow). Requires input.contextId
// holding the user's Indeed login. Jobs whose button says "Apply on company site" are delegated
// to the generic applier in the same browser session.
//
// Assumptions (verify on live postings):
//  - Job page: indeed.com/viewjob?jk=… ; Indeed Apply button #indeedApplyButton (or a button whose
//    text is "Apply now"); external button #applyButtonLinkContainer a / "Apply on company site".
//  - The flow opens on smartapply.indeed.com (often in a NEW TAB). Steps: contact info → resume
//    (upload or pick the Indeed resume) → employer questions → review → "Submit your application".
//  - Navigation buttons are plain <button>s with text "Continue" / "Review your application" and
//    the final one "Submit your application".
//  - Logged out → secure.indeed.com/auth or an account login page → blocked.
//  - Indeed fronts pages with Cloudflare; visible challenges → blocked (handled by blockerResult).
import type { Applier, ApplyResult } from "../contracts";
import {
  adoptNewestPage,
  blockerResult,
  clickSelector,
  collectFields,
  fillForm,
  findButton,
  firstVisible,
  gotoPage,
  handleFileFields,
  outcomeResult,
  result,
  runSession,
  safeScreenshot,
  submitApplication,
  validationErrors,
  type Ctx,
} from "./common";
import { runGeneric } from "./generic";

const LOGIN_URL = /secure\.indeed\.com\/(auth|account)|indeed\.com\/account\/login|\/auth\?/i;
const FINAL = /^submit (your )?application$|^submit$/i;
const NEXT = /^(continue|next|review your application|continue to review|continue applying)$/i;

async function loginExpired(ctx: Ctx): Promise<ApplyResult | null> {
  const url = await ctx.page.url().catch(() => "");
  if (LOGIN_URL.test(url)) {
    return result(ctx, "blocked", { error: "Indeed login expired — reconnect in Settings", screenshot: await safeScreenshot(ctx.page) });
  }
  return null;
}

export async function runIndeed(ctx: Ctx): Promise<ApplyResult> {
  if (!ctx.input.contextId) return result(ctx, "blocked", { error: "Indeed is not connected — connect it in Settings" });
  const status = await gotoPage(ctx, ctx.input.job.applyUrl || ctx.input.job.url);
  const bl = await blockerResult(ctx, status);
  if (bl) return bl;
  const lo = await loginExpired(ctx);
  if (lo) return lo;

  // External application?
  const ext = await findButton(ctx, /apply on company site|apply on employer site/i);
  if (ext && !(await firstVisible(ctx, ["#indeedApplyButton", "button[id*='indeedApplyButton']"]))) {
    if (ext.href && /^https?:/i.test(ext.href)) {
      ctx.log(`external application → ${ext.href}`);
      return runGeneric(ctx, ext.href);
    }
    const before = (await ctx.b.browser.context.pages()).length;
    await clickSelector(ctx, ext.selector);
    await ctx.page.waitForTimeout(2500);
    await adoptNewestPage(ctx, before);
    return runGeneric(ctx, await ctx.page.url());
  }

  const apply =
    (await firstVisible(ctx, ["#indeedApplyButton", "button[id*='indeedApplyButton']", ".ia-IndeedApplyButton", "[data-testid='indeedApply-button']", "button[aria-label*='Apply now' i]"])) ??
    (await findButton(ctx, /^apply now$|^easily apply$/i))?.selector ??
    null;
  if (!apply) {
    return result(ctx, "unsupported", { error: "No 'Apply now' (Indeed Apply) button on this job", screenshot: await safeScreenshot(ctx.page) });
  }
  const before = (await ctx.b.browser.context.pages()).length;
  await clickSelector(ctx, apply);
  await ctx.page.waitForTimeout(3000);
  await adoptNewestPage(ctx, before);

  // Wait to land on the SmartApply flow (or a login page / redirect to employer site).
  const deadline = Date.now() + 20_000;
  let url = await ctx.page.url();
  while (Date.now() < deadline && !/smartapply\.indeed\.com|indeed\.com\/(apply|indeedapply)/i.test(url)) {
    if (LOGIN_URL.test(url)) break;
    if (/^https?:/i.test(url) && !/indeed\./i.test(new URL(url).hostname)) return runGeneric(ctx, url); // employer site
    await ctx.page.waitForTimeout(1000);
    url = await ctx.page.url();
  }
  const lo2 = await loginExpired(ctx);
  if (lo2) return lo2;

  let stuck = 0;
  for (let step = 0; step < 15; step++) {
    if (ctx.cancelled) throw new Error("cancelled");
    const blS = await blockerResult(ctx);
    if (blS) return blS;
    const loS = await loginExpired(ctx);
    if (loS) return loS;

    const { fields, hasPassword } = await collectFields(ctx);
    if (hasPassword) {
      return result(ctx, "blocked", { error: "Indeed asked for a password — reconnect Indeed in Settings", screenshot: await safeScreenshot(ctx.page) });
    }
    const fileQs = await handleFileFields(ctx, fields);
    const outcome = await fillForm(ctx, fields);
    if (fileQs.length || outcome.status === "waiting_input") {
      return outcomeResult(ctx, { status: "waiting_input", questions: [...fileQs, ...(outcome.status === "waiting_input" ? outcome.questions : [])] });
    }
    if (outcome.status === "failed") return outcomeResult(ctx, outcome);

    const final = await findButton(ctx, FINAL);
    if (final) {
      return submitApplication(ctx, {
        selectors: [final.selector],
        text: FINAL,
        nl: "Find the 'Submit your application' button",
        success: /your application has been submitted|application submitted|you.ve applied|application sent/i,
        successUrl: /\/post-apply|\/confirmation/i,
        timeoutMs: 30_000,
      });
    }
    const next = await findButton(ctx, NEXT);
    if (!next) {
      return result(ctx, "failed", { error: "Indeed Apply: no Continue/Submit button found", screenshot: await safeScreenshot(ctx.page) });
    }
    ctx.log(`step ${step + 1}: ${next.text}`);
    const beforeUrl = await ctx.page.url();
    await clickSelector(ctx, next.selector);
    await ctx.page.waitForTimeout(2500);
    const nowUrl = await ctx.page.url();
    if (nowUrl === beforeUrl) {
      stuck++;
      const errs = await validationErrors(ctx);
      if (stuck >= 2 || errs.messages.length) {
        return result(ctx, "failed", { error: `Indeed Apply step did not advance${errs.messages.length ? `: ${errs.messages.join(" | ")}` : ""}`, screenshot: await safeScreenshot(ctx.page) });
      }
    } else stuck = 0;
  }
  return result(ctx, "failed", { error: "Indeed Apply had too many steps", screenshot: await safeScreenshot(ctx.page) });
}

export const indeedApplier: Applier & { run: typeof runIndeed } = {
  methods: ["indeed"],
  run: runIndeed,
  apply: (input) => runSession(input, runIndeed, { requiresContext: { siteName: "Indeed" } }),
};
