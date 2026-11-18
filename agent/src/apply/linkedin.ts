// LinkedIn Easy Apply. Requires input.contextId — the user's Browserbase Context with a saved
// LinkedIn login (created through the Live View "Connect LinkedIn" flow in connect.ts).
//
// Assumptions (LinkedIn markup changes often; every step has a text / Stagehand fallback):
//  - Job page: https://www.linkedin.com/jobs/view/<id>/ ; "?currentJobId=<id>" URLs are normalised.
//  - Logged out → redirect to /login, /authwall, /uas/login, /signup or a guest page with
//    "Sign in" buttons and no global nav "Me" menu.
//  - Security checkpoint → /checkpoint/ URL or "Let's do a quick security check".
//  - Easy Apply button: button.jobs-apply-button with aria-label "Easy Apply to …".
//    An "Apply" button without "Easy" means an external application → unsupported here.
//  - Modal: .jobs-easy-apply-modal (role=dialog). Footer buttons carry aria-labels
//    "Continue to next step", "Review your application", "Submit application".
//  - Resume step: input[type=file] (id contains "jobs-document-upload") to upload; otherwise a
//    previously uploaded resume is already selected — we upload ours when the input exists.
//  - Review step has #follow-company-checkbox (checked by default) → we uncheck it.
//  - Success: "Your application was sent" / "Application sent".
import type { Applier, ApplyResult } from "../contracts";
import {
  clickSelector,
  collectFields,
  fillForm,
  findButton,
  firstVisible,
  gotoPage,
  handleFileFields,
  outcomeResult,
  result,
  run,
  runSession,
  safeScreenshot,
  submitApplication,
  validationErrors,
  waitForAny,
  type Ctx,
} from "./common";

const MODAL = "[data-ja-scope='li-modal']";

export function linkedinJobUrl(url: string): string {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("currentJobId") ?? /\/jobs\/view\/(?:[^/]*-)?(\d+)/.exec(u.pathname)?.[1];
    return id ? `https://www.linkedin.com/jobs/view/${id}/` : url;
  } catch {
    return url;
  }
}

const STATE_SCRIPT = String.raw`() => {
  const text = String((document.body && document.body.innerText) || '').slice(0, 8000);
  const url = location.href;
  const checkpoint = /\/checkpoint\//.test(url) || /let.s do a quick security check|security verification|verify your identity/i.test(text);
  const loggedOut = /\/(login|authwall|signup|uas\/login)/.test(url) ||
    (!!document.querySelector('a[href*="/login"].nav__button-secondary, a[data-tracking-control-name*="sign-in" i], .authwall-join-form, button[data-modal="base-sign-in-modal"]') &&
     !document.querySelector('.global-nav__me, #global-nav, .global-nav__primary-items'));
  const applied = /applied \d+ (second|minute|hour|day|week|month)s? ago|application submitted|you applied/i.test(
    String((document.querySelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card__container--two-pane, .jobs-s-apply, .job-details-jobs-unified-top-card__primary-description-container, main') || document.body).innerText || '').slice(0, 3000));
  const closed = /no longer accepting applications/i.test(text);
  return { checkpoint, loggedOut, applied, closed };
}`;

const TAG_MODAL = String.raw`() => {
  const m = document.querySelector('.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], div[role=dialog][aria-labelledby*="jobs-apply"], .artdeco-modal[role=dialog]');
  if (!m) return false;
  document.querySelectorAll('[data-ja-scope="li-modal"]').forEach((x) => { if (x !== m) x.removeAttribute('data-ja-scope'); });
  m.setAttribute('data-ja-scope', 'li-modal');
  return true;
}`;

const STEP_SIGNATURE = String.raw`() => {
  const m = document.querySelector('[data-ja-scope="li-modal"]');
  if (!m) return 'closed';
  const pb = m.querySelector('[role=progressbar], progress');
  const h = m.querySelector('h3, h2');
  return String((pb && (pb.getAttribute('aria-valuenow') || pb.getAttribute('value'))) || '') + '|' + String((h && h.innerText) || '').trim();
}`;

const UNFOLLOW = String.raw`() => {
  const cb = document.querySelector('#follow-company-checkbox, input[type=checkbox][id*="follow-company"]');
  if (!cb || !cb.checked) return false;
  const label = cb.id ? document.querySelector('label[for="' + CSS.escape(cb.id) + '"]') : null;
  (label || cb).click();
  return true;
}`;

const SENT = /your application was sent|application sent|application submitted/i;

export async function runLinkedIn(ctx: Ctx): Promise<ApplyResult> {
  if (!ctx.input.contextId) {
    return result(ctx, "blocked", { error: "LinkedIn is not connected — connect it in Settings" });
  }
  await gotoPage(ctx, linkedinJobUrl(ctx.input.job.applyUrl || ctx.input.job.url));
  const st = await run<{ checkpoint: boolean; loggedOut: boolean; applied: boolean; closed: boolean }>(ctx.page, STATE_SCRIPT);
  if (st.checkpoint) {
    return result(ctx, "blocked", { error: "LinkedIn security checkpoint — open LinkedIn yourself, pass the check, then reconnect in Settings", screenshot: await safeScreenshot(ctx.page) });
  }
  if (st.loggedOut) {
    return result(ctx, "blocked", { error: "LinkedIn login expired — reconnect in Settings", screenshot: await safeScreenshot(ctx.page) });
  }
  if (st.closed) return result(ctx, "failed", { error: "LinkedIn: no longer accepting applications", screenshot: await safeScreenshot(ctx.page) });
  if (st.applied) return result(ctx, "failed", { error: "LinkedIn shows this job as already applied", screenshot: await safeScreenshot(ctx.page) });

  // Easy Apply button
  let easy = await firstVisible(ctx, ["button.jobs-apply-button[aria-label*='Easy Apply']", "button[aria-label*='Easy Apply']", ".jobs-apply-button--top-card button.jobs-apply-button"]);
  if (easy && !/easy apply/i.test(await ctx.page.locator(easy).first().innerText().catch(() => "easy apply"))) easy = null;
  if (!easy) easy = (await findButton(ctx, /^easy apply$/i))?.selector ?? null;
  if (!easy) {
    const external = await findButton(ctx, /^apply$/i);
    return result(ctx, "unsupported", {
      error: external ? "This LinkedIn job uses an external application (no Easy Apply)" : "No Easy Apply button found",
      screenshot: await safeScreenshot(ctx.page),
    });
  }
  await clickSelector(ctx, easy);
  await waitForAny(ctx, [".jobs-easy-apply-modal", "[data-test-modal-id='easy-apply-modal']", "div[role=dialog]"], 12_000);
  if (!(await run<boolean>(ctx.page, TAG_MODAL))) {
    const st2 = await run<{ checkpoint: boolean; loggedOut: boolean }>(ctx.page, STATE_SCRIPT);
    if (st2.checkpoint || st2.loggedOut) return result(ctx, "blocked", { error: st2.checkpoint ? "LinkedIn security checkpoint" : "LinkedIn login expired — reconnect in Settings", screenshot: await safeScreenshot(ctx.page) });
    return result(ctx, "failed", { error: "Easy Apply dialog did not open", screenshot: await safeScreenshot(ctx.page) });
  }

  let lastSig = "";
  let sameCount = 0;
  for (let step = 0; step < 15; step++) {
    if (ctx.cancelled) throw new Error("cancelled");
    await run<boolean>(ctx.page, TAG_MODAL);
    const st3 = await run<{ checkpoint: boolean }>(ctx.page, STATE_SCRIPT);
    if (st3.checkpoint) return result(ctx, "blocked", { error: "LinkedIn security checkpoint during Easy Apply", screenshot: await safeScreenshot(ctx.page) });

    const { fields } = await collectFields(ctx, { scope: MODAL });
    const fileQs = await handleFileFields(ctx, fields);
    const fillable = fields.filter((f) => !/follow-company/i.test(f.elId) && !/^follow /i.test(f.label));
    const outcome = await fillForm(ctx, fillable);
    if (fileQs.length || outcome.status === "waiting_input") {
      return outcomeResult(ctx, { status: "waiting_input", questions: [...fileQs, ...(outcome.status === "waiting_input" ? outcome.questions : [])] });
    }
    if (outcome.status === "failed") return outcomeResult(ctx, outcome);

    const submitSel =
      (await firstVisible(ctx, [`${MODAL} button[aria-label='Submit application']`, `${MODAL} button[aria-label*='Submit application']`])) ??
      (await findButton(ctx, /^submit application$/i, MODAL))?.selector ??
      null;
    if (submitSel) {
      const unf = await run<boolean>(ctx.page, UNFOLLOW).catch(() => false);
      if (unf) ctx.log("unchecked 'Follow company'");
      const res = await submitApplication(ctx, {
        selectors: [submitSel],
        text: /^submit application$/i,
        nl: "Find the 'Submit application' button in the Easy Apply dialog",
        success: SENT,
        scope: undefined,
        timeoutMs: 30_000,
      });
      if (res.status === "applied") {
        // Close the post-apply dialog; harmless if it fails.
        const done = await findButton(ctx, /^(done|dismiss|not now)$/i);
        if (done) await clickSelector(ctx, done.selector).catch(() => {});
      }
      return res;
    }

    const nextSel =
      (await firstVisible(ctx, [
        `${MODAL} button[aria-label='Review your application']`,
        `${MODAL} button[aria-label='Continue to next step']`,
        `${MODAL} button[aria-label*='Review']`,
        `${MODAL} button[aria-label*='next step']`,
      ])) ??
      (await findButton(ctx, /^(next|review|continue)$/i, MODAL))?.selector ??
      null;
    if (!nextSel) {
      return result(ctx, "failed", { error: "Easy Apply: no Next/Review/Submit button found", screenshot: await safeScreenshot(ctx.page) });
    }
    await clickSelector(ctx, nextSel);
    await ctx.page.waitForTimeout(1500);

    const sig = await run<string>(ctx.page, STEP_SIGNATURE).catch(() => "");
    if (sig === "closed") return result(ctx, "failed", { error: "Easy Apply dialog closed unexpectedly", screenshot: await safeScreenshot(ctx.page) });
    if (sig === lastSig) {
      sameCount++;
      const errs = await validationErrors(ctx, MODAL);
      if (sameCount >= 2 || errs.messages.length) {
        return result(ctx, "failed", {
          error: `Easy Apply step did not advance${errs.messages.length ? `: ${errs.messages.join(" | ")}` : ""}`,
          screenshot: await safeScreenshot(ctx.page),
        });
      }
    } else sameCount = 0;
    lastSig = sig;
  }
  return result(ctx, "failed", { error: "Easy Apply had too many steps", screenshot: await safeScreenshot(ctx.page) });
}

export const linkedinApplier: Applier & { run: typeof runLinkedIn } = {
  methods: ["linkedin_easy"],
  run: runLinkedIn,
  apply: (input) => runSession(input, runLinkedIn, { requiresContext: { siteName: "LinkedIn" } }),
};
