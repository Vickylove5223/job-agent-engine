// Generic ("external") applier: any company careers page.
//
// Strategy:
//  1. If the URL (or wherever the "Apply" button leads, or an embedded iframe) is on Greenhouse,
//     Lever or Ashby → delegate to that applier in the SAME browser session.
//  2. Otherwise find the application form: deterministic "Apply" button search first, Stagehand
//     observe as fallback.
//  3. Never create accounts or type passwords: any login / registration wall (password input,
//     Workday / Taleo / SuccessFactors / iCIMS sign-in) → status "unsupported".
//  4. Fill with the shared fillForm loop (DOM collection, Stagehand extract fallback), follow up to
//     a few "Next/Continue" pages, then submit through submitApplication (dry-run safe).
import type { Applier, ApplyResult } from "../contracts";
import { runAshby } from "./ashby";
import {
  adoptNewestPage,
  blockerResult,
  clickSelector,
  collectFields,
  collectFieldsAI,
  findButton,
  fillForm,
  gotoPage,
  handleFileFields,
  hostOf,
  methodFromUrl,
  outcomeResult,
  result,
  run,
  runSession,
  safeScreenshot,
  submitApplication,
  type Ctx,
  type DomField,
} from "./common";
import { runGreenhouse } from "./greenhouse";
import { runLever } from "./lever";

const ATS_IFRAME = String.raw`() => {
  const f = Array.from(document.querySelectorAll('iframe')).find((x) => /greenhouse\.io|lever\.co|ashbyhq\.com/i.test(String(x.src || '')));
  return f ? f.src : null;
}`;

/** Hosts that always require an applicant account — we do not register on the user's behalf. */
const ACCOUNT_HOSTS = /myworkdayjobs\.com|myworkday\.com|taleo\.net|successfactors\.(com|eu)|icims\.com|brassring\.com|oraclecloud\.com\/hcmUI|ultipro\.com|adp\.com/i;

const APPLY_TEXT = /^(apply|apply now|apply online|apply for (this )?(job|position|role)|apply to (this )?(job|position|role)|start (your )?application|i.?m interested|easy apply)$/i;
const NEXT_TEXT = /^(next|continue|save (and|&) continue|next step|proceed)$/i;
const SUBMIT_TEXT = /^(submit|submit application|submit my application|send application|apply|complete application|finish)$/i;

async function delegateIfAts(ctx: Ctx, url: string): Promise<ApplyResult | null> {
  const m = methodFromUrl(url);
  if (m === "greenhouse") return runGreenhouse(ctx, url);
  if (m === "lever") return runLever(ctx, url);
  if (m === "ashby") return runAshby(ctx, url);
  return null;
}

function looksLikeApplication(fields: DomField[]): boolean {
  const labels = fields.map((f) => `${f.label} ${f.name} ${f.type}`.toLowerCase());
  const hasEmail = labels.some((l) => /e-?mail/.test(l));
  const hasName = labels.some((l) => /name/.test(l));
  const hasFile = fields.some((f) => f.kind === "file");
  return (hasEmail && (hasName || hasFile)) || (hasFile && fields.length >= 3);
}

async function accountWall(ctx: Ctx, hasPassword: boolean): Promise<ApplyResult | null> {
  const url = await ctx.page.url().catch(() => "");
  if (hasPassword || ACCOUNT_HOSTS.test(url)) {
    const host = await hostOf(ctx);
    return result(ctx, "unsupported", {
      error: `${host} requires signing in or creating an applicant account — the agent never creates accounts or enters passwords. Apply to this one manually.`,
      screenshot: await safeScreenshot(ctx.page),
    });
  }
  return null;
}

/** Click the page's Apply control (deterministic, then Stagehand). Returns true if something was clicked. */
async function clickApply(ctx: Ctx): Promise<boolean> {
  const before = (await ctx.b.browser.context.pages()).length;
  const btn = await findButton(ctx, APPLY_TEXT);
  if (btn) {
    ctx.log(`apply control: "${btn.text}"`);
    if (btn.href && /^https?:/i.test(btn.href)) {
      await gotoPage(ctx, btn.href);
      return true;
    }
    await clickSelector(ctx, btn.selector);
  } else {
    let action;
    try {
      const { data } = await ctx.stagehand.observe(
        "Find the button or link that starts the job application (for example 'Apply', 'Apply now', 'Apply for this job'). Do not return sign-in, sign-up, share or save buttons.",
        { page: ctx.page },
      );
      action = data[0];
    } catch (e) {
      ctx.log(`observe apply failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!action) return false;
    ctx.log(`apply control via observe: ${action.description}`);
    await ctx.stagehand.act(action, { page: ctx.page });
  }
  await ctx.page.waitForTimeout(2500);
  await adoptNewestPage(ctx, before);
  return true;
}

export async function runGeneric(ctx: Ctx, url?: string): Promise<ApplyResult> {
  const target = url ?? ctx.input.job.applyUrl ?? ctx.input.job.url;
  const direct = await delegateIfAts(ctx, target);
  if (direct) return direct;

  const status = await gotoPage(ctx, target);
  const bl = await blockerResult(ctx, status);
  if (bl) return bl;

  // Redirected to an ATS, or the ATS is embedded?
  const landed = await ctx.page.url();
  const viaRedirect = await delegateIfAts(ctx, landed);
  if (viaRedirect) return viaRedirect;
  const iframe = await run<string | null>(ctx.page, ATS_IFRAME).catch(() => null);
  if (iframe) {
    const viaIframe = await delegateIfAts(ctx, iframe);
    if (viaIframe) return viaIframe;
  }

  let { fields, hasPassword } = await collectFields(ctx);
  if (!looksLikeApplication(fields)) {
    const wall = await accountWall(ctx, hasPassword);
    if (wall) return wall;
    if (!(await clickApply(ctx))) {
      return result(ctx, "failed", { error: "Could not find an Apply button or application form", screenshot: await safeScreenshot(ctx.page) });
    }
    const after = await ctx.page.url();
    const delegated = await delegateIfAts(ctx, after);
    if (delegated) return delegated;
    const bl2 = await blockerResult(ctx);
    if (bl2) return bl2;
    const iframe2 = await run<string | null>(ctx.page, ATS_IFRAME).catch(() => null);
    if (iframe2) {
      const viaIframe = await delegateIfAts(ctx, iframe2);
      if (viaIframe) return viaIframe;
    }
    ({ fields, hasPassword } = await collectFields(ctx));
  }
  const wall = await accountWall(ctx, hasPassword);
  if (wall) return wall;

  // Multi-page forms: fill, then Next/Continue, up to 5 pages.
  for (let step = 0; step < 5; step++) {
    if (!fields.filter((f) => f.kind !== "file").length) {
      ctx.log("DOM collection empty — using stagehand.extract");
      fields = await collectFieldsAI(ctx).catch(() => []);
      if (!fields.length) {
        return result(ctx, "failed", { error: "No application form fields found", screenshot: await safeScreenshot(ctx.page) });
      }
    }
    const fileQs = await handleFileFields(ctx, fields);
    if (fields.some((f) => f.kind === "file") && fields.every((f) => f.kind !== "ai")) ({ fields } = await collectFields(ctx));
    const outcome = await fillForm(ctx, fields);
    if (fileQs.length) {
      return outcomeResult(ctx, { status: "waiting_input", questions: [...fileQs, ...(outcome.status === "waiting_input" ? outcome.questions : [])] });
    }
    if (outcome.status !== "ok") return outcomeResult(ctx, outcome);

    const submit = await findButton(ctx, SUBMIT_TEXT);
    const next = submit ? null : await findButton(ctx, NEXT_TEXT);
    if (next) {
      ctx.log(`page ${step + 1}: ${next.text}`);
      await clickSelector(ctx, next.selector);
      await ctx.page.waitForTimeout(2500);
      const blN = await blockerResult(ctx);
      if (blN) return blN;
      let pw: boolean;
      ({ fields, hasPassword: pw } = await collectFields(ctx));
      const wallN = await accountWall(ctx, pw);
      if (wallN) return wallN;
      continue;
    }
    return submitApplication(ctx, {
      selectors: submit ? [submit.selector] : ["form button[type=submit]", "form input[type=submit]"],
      text: SUBMIT_TEXT,
      nl: "Find the button that submits this job application form (e.g. 'Submit', 'Submit application', 'Send application')",
      success: /thank you( for (applying|your (application|interest)))?|application (has been |was )?(submitted|received|sent)|we.ve received your application|successfully (submitted|applied)/i,
      timeoutMs: 40_000,
    });
  }
  return result(ctx, "failed", { error: "Application has too many pages for the generic applier", screenshot: await safeScreenshot(ctx.page) });
}

export const genericApplier: Applier & { run: typeof runGeneric } = {
  methods: ["external"],
  run: runGeneric,
  apply: (input) => runSession(input, (ctx) => runGeneric(ctx)),
};
