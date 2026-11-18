// Greenhouse applier: job-boards.greenhouse.io (new React board) and boards.greenhouse.io
// (legacy board + /embed/job_app iframe pages).
//
// Assumptions (verify against a live board when a Browserbase key is available):
//  - New board: form#application-form; inputs #first_name #last_name #email #phone; file inputs
//    #resume / #cover_letter (visually hidden, with "Attach" / "Enter manually" buttons);
//    location = #candidate-location (async combobox); custom questions #question_<id>
//    (text / textarea / react-select comboboxes); EEO: #gender #hispanic_ethnicity
//    #veteran_status #disability_status (react-select). Submit "Submit application".
//    Success: /confirmation URL or "Thank you for applying".
//  - Legacy board: form#application_form, file inputs inside #resume_fieldset /
//    #cover_letter_fieldset, submit #submit_app.
//  - Company sites embed the form in iframe#grnhse_iframe — we navigate to its src instead
//    (page.evaluate does not cross frames).
//  - Some boards send an email security code after submit → reported as blocked by
//    confirmSubmitted().
import type { Applier, ApplyResult } from "../contracts";
import {
  collectUploadFill,
  coverLetterPayload,
  findButton,
  clickSelector,
  openJobPage,
  outcomeResult,
  result,
  resumePayload,
  run,
  runSession,
  safeScreenshot,
  submitApplication,
  uploadFile,
  uploadViaObserve,
  waitForAny,
  type Ctx,
} from "./common";

const FORM_SELECTORS = ["form#application-form", "form#application_form", "#application-form", "#application_form", "form[action*='greenhouse']", "input#first_name", "input#email"];

/** Normalise a Greenhouse URL to the page that holds the application form. */
export function greenhouseFormUrl(url: string): string {
  try {
    const u = new URL(url);
    // Legacy "…/jobs/123#app" anchors are fine as-is; strip only tracking noise.
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

const IFRAME_SRC = String.raw`() => {
  const f = document.querySelector('iframe#grnhse_iframe, iframe[src*="greenhouse.io/embed/job_app"], iframe[src*="job-boards.greenhouse.io"], iframe[src*="boards.greenhouse.io"]');
  return f ? f.src : null;
}`;

export async function runGreenhouse(ctx: Ctx, url?: string): Promise<ApplyResult> {
  const target = greenhouseFormUrl(url ?? ctx.input.job.applyUrl ?? ctx.input.job.url);
  const blocked = await openJobPage(ctx, target);
  if (blocked) return blocked;

  let form = await waitForAny(ctx, FORM_SELECTORS, 12_000);
  if (!form) {
    const iframeSrc = await run<string | null>(ctx.page, IFRAME_SRC).catch(() => null);
    if (iframeSrc) {
      ctx.log(`following embedded Greenhouse iframe ${iframeSrc}`);
      const b2 = await openJobPage(ctx, iframeSrc);
      if (b2) return b2;
      form = await waitForAny(ctx, FORM_SELECTORS, 12_000);
    }
  }
  if (!form) {
    // Some legacy boards hide the form behind an "Apply" button that scrolls / reveals it.
    const btn = await findButton(ctx, /^(apply( for this job| now)?|apply here)$/i);
    if (btn) {
      await clickSelector(ctx, btn.selector);
      form = await waitForAny(ctx, FORM_SELECTORS, 10_000);
    }
  }
  if (!form) {
    return result(ctx, "failed", { error: "Greenhouse application form not found on the page", screenshot: await safeScreenshot(ctx.page) });
  }
  const scopeSel = (await waitForAny(ctx, ["form#application-form", "form#application_form", "#application-form", "#application_form"], 1000)) ?? undefined;

  // Resume first: specific selectors, then the generic file-field logic in collectUploadFill,
  // then Stagehand observe as last resort.
  const resume = await resumePayload(ctx);
  let resumeDone = await uploadFile(ctx, ["input#resume", "#resume_fieldset input[type=file]", "input[type=file][name*='resume' i]", "input[type=file][id*='resume' i]"], resume);
  if (!resumeDone) {
    resumeDone = (await uploadViaObserve(ctx, "resume / CV", resume)) ? "observe" : null;
  }
  if (resumeDone) ctx.answers.push({ question: "Resume/CV", answer: resume.name, basis: ["resume"] });

  const cover = await coverLetterPayload(ctx);
  if (cover) {
    const ok = await uploadFile(ctx, ["input#cover_letter", "#cover_letter_fieldset input[type=file]", "input[type=file][name*='cover' i]", "input[type=file][id*='cover' i]"], cover);
    if (ok) ctx.answers.push({ question: "Cover Letter", answer: cover.name, basis: ["coverLetter"] });
  }

  const outcome = await collectUploadFill(ctx, { scope: scopeSel, probeComboboxes: true });
  if (outcome.status !== "ok") return outcomeResult(ctx, outcome);

  return submitApplication(ctx, {
    selectors: ["form#application-form button[type=submit]", "#submit_app", "input#submit_app", "button[type=submit]"],
    text: /^submit( application)?$/i,
    nl: "Find the 'Submit application' button at the bottom of the job application form",
    success: /thank you for applying|thanks for applying|application (has been )?(submitted|received)|we.ve received your application|your application was submitted/i,
    successUrl: /\/confirmation(\b|\/|\?|$)/,
    scope: scopeSel,
    timeoutMs: 40_000,
  });
}

export const greenhouseApplier: Applier & { run: typeof runGreenhouse } = {
  methods: ["greenhouse"],
  run: runGreenhouse,
  apply: (input) => runSession(input, (ctx) => runGreenhouse(ctx)),
};
