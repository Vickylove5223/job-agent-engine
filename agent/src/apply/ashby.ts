// Ashby applier: jobs.ashbyhq.com/{company}/{jobId}/application (SPA).
//
// Assumptions (verify on a live posting):
//  - The form renders client-side; we wait for #_systemfield_email / #_systemfield_name.
//  - System fields: #_systemfield_name, #_systemfield_email, #_systemfield_phone (some boards),
//    #_systemfield_location (combobox), #_systemfield_resume (file). There is ALSO an
//    "Autofill from resume" file input at the top — we never use it (it can overwrite answers).
//  - Custom questions live in .ashby-application-form-field-entry with
//    label.ashby-application-form-question-title; booleans are rendered as Yes/No BUTTONS
//    (handled by the "buttons" field kind); multi-choice as checkboxes/radios; selects as comboboxes.
//  - Required fields carry a class containing "required" on the label (asterisk is a CSS ::after).
//  - Submit: button.ashby-application-form-submit-button "Submit Application".
//    Success: ".ashby-application-form-success-container" or "Thank you for applying".
//  - Ashby runs invisible reCAPTCHA; spam-flagged submissions show an error we surface.
import type { Applier, ApplyResult } from "../contracts";
import {
  collectUploadFill,
  openJobPage,
  outcomeResult,
  result,
  resumePayload,
  runSession,
  safeScreenshot,
  submitApplication,
  uploadFile,
  uploadViaObserve,
  waitForAny,
  type Ctx,
} from "./common";

export function ashbyApplicationUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const parts = u.pathname.split("/").filter(Boolean); // [company, jobId, ("application")?]
    if (parts.length === 2) u.pathname = `/${parts[0]}/${parts[1]}/application`;
    return u.toString();
  } catch {
    return url;
  }
}

export async function runAshby(ctx: Ctx, url?: string): Promise<ApplyResult> {
  const target = ashbyApplicationUrl(url ?? ctx.input.job.applyUrl ?? ctx.input.job.url);
  const blocked = await openJobPage(ctx, target);
  if (blocked) return blocked;

  const form = await waitForAny(
    ctx,
    ["#_systemfield_email", "#_systemfield_name", ".ashby-application-form-container", "form input[type=email]"],
    25_000,
  );
  if (!form) return result(ctx, "failed", { error: "Ashby application form not found (page did not render)", screenshot: await safeScreenshot(ctx.page) });
  const scopeSel = (await waitForAny(ctx, [".ashby-application-form-container", "form"], 1000)) ?? undefined;

  const resume = await resumePayload(ctx);
  let up = await uploadFile(ctx, ["input#_systemfield_resume", "input[type=file][id*='resume' i]:not([id*='autofill' i])"], resume);
  if (!up && (await uploadViaObserve(ctx, "resume (the Resume field of the form, NOT the 'Autofill from resume' box)", resume))) up = "observe";
  if (up) ctx.answers.push({ question: "Resume", answer: resume.name, basis: ["resume"] });

  const outcome = await collectUploadFill(ctx, { scope: scopeSel, probeComboboxes: true });
  if (outcome.status !== "ok") return outcomeResult(ctx, outcome);

  return submitApplication(ctx, {
    selectors: ["button.ashby-application-form-submit-button", "form button[type=submit]"],
    text: /^submit( application)?$/i,
    nl: "Find the 'Submit Application' button at the bottom of the Ashby application form",
    success: /thank you for applying|thanks for applying|application (was |has been )?(submitted|received)|successfully submitted/i,
    successSelector: ".ashby-application-form-success-container",
    scope: scopeSel,
    timeoutMs: 40_000,
  });
}

export const ashbyApplier: Applier & { run: typeof runAshby } = {
  methods: ["ashby"],
  run: runAshby,
  apply: (input) => runSession(input, (ctx) => runAshby(ctx)),
};
