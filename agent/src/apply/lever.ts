// Lever applier: jobs.lever.co/{company}/{postingId}/apply (also jobs.eu.lever.co).
//
// Assumptions (verify on a live posting):
//  - form#application-form (older: form[action$="/apply"]). Resume input #resume-upload-input
//    (name="resume"). Uploading it first makes Lever parse the resume and prefill name / email /
//    phone / org — we upload, wait for ".resume-upload-success" (or ~6 s), then fill.
//  - Standard inputs: name, email, phone, org (current company), urls[LinkedIn], urls[GitHub],
//    urls[Portfolio], urls[Other], location (#location-input, with a suggestions dropdown).
//  - "Additional information" textarea name="comments" — we put the cover letter text there.
//  - Custom question cards: cards[<uuid>][fieldN] (text, textarea, radios, checkboxes, selects).
//  - EEO selects eeo[gender], eeo[race], eeo[veteran], eeo[disability…].
//  - Submit: #btn-submit / button[type=submit] "Submit application"; success page /thanks with
//    "Application submitted!". Lever runs an invisible hCaptcha on submit: if a visible challenge
//    appears we return blocked.
import type { Applier, ApplyResult } from "../contracts";
import {
  collectUploadFill,
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
  type DomField,
} from "./common";

export function leverApplyUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const parts = u.pathname.split("/").filter(Boolean); // [company, id, ("apply")?]
    if (parts.length === 2) u.pathname = `/${parts[0]}/${parts[1]}/apply`;
    return u.toString();
  } catch {
    return url;
  }
}

const PICK_LOCATION = String.raw`() => {
  const o = Array.from(document.querySelectorAll('.dropdown-location, .location-dropdown .dropdown-results > div, [class*="dropdown-results"] [class*="location"]'))
    .find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (!o) return false;
  o.click();
  return true;
}`;

export async function runLever(ctx: Ctx, url?: string): Promise<ApplyResult> {
  const target = leverApplyUrl(url ?? ctx.input.job.applyUrl ?? ctx.input.job.url);
  const blocked = await openJobPage(ctx, target);
  if (blocked) return blocked;

  const form = await waitForAny(ctx, ["form#application-form", "form[action*='/apply']", "#resume-upload-input", "input[name=email]"], 15_000);
  if (!form) return result(ctx, "failed", { error: "Lever application form not found", screenshot: await safeScreenshot(ctx.page) });
  const scopeSel = (await waitForAny(ctx, ["form#application-form", "form[action*='/apply']"], 1000)) ?? undefined;

  // 1) Resume first so Lever's parser runs before we fill.
  const resume = await resumePayload(ctx);
  let up = await uploadFile(ctx, ["input#resume-upload-input", "input[type=file][name=resume]", "input[type=file]"], resume);
  if (!up && (await uploadViaObserve(ctx, "resume / CV", resume))) up = "observe";
  if (up) {
    ctx.answers.push({ question: "Resume/CV", answer: resume.name, basis: ["resume"] });
    await waitForAny(ctx, [".resume-upload-success", ".resume-upload-filename:not(:empty)"], 8000);
  }

  // 2) Cover letter: Lever has no dedicated field; use "Additional information" for the text,
  //    and if the posting has a cover-letter upload card, handleFileFields uploads the PDF.
  const coverText = ctx.input.coverLetter?.text?.trim();
  const preset = (f: DomField) =>
    coverText && (f.name === "comments" || /additional information|cover letter/i.test(f.label)) && f.kind === "textarea"
      ? { answer: coverText, confidence: 1, basis: ["coverLetter"] }
      : null;

  const outcome = await collectUploadFill(ctx, { scope: scopeSel, probeComboboxes: false }, { preset });
  if (outcome.status !== "ok") return outcomeResult(ctx, outcome);

  // Location needs a pick from Lever's suggestion dropdown to be accepted.
  if ((await ctx.page.locator("#location-input").count().catch(() => 0)) > 0) {
    await ctx.page.waitForTimeout(1200);
    const picked = await run<boolean>(ctx.page, PICK_LOCATION).catch(() => false);
    ctx.log(`lever location suggestion ${picked ? "picked" : "not shown"}`);
  }

  return submitApplication(ctx, {
    selectors: ["#btn-submit", "button[data-qa='btn-submit']", "form#application-form button[type=submit]", "button[type=submit]"],
    text: /^submit( (your )?application)?$/i,
    nl: "Find the 'Submit application' button at the bottom of the Lever application form",
    success: /application submitted|thanks for applying|thank you for applying|we.ve received your application|application has been (submitted|received)/i,
    successUrl: /\/thanks(\b|\/|\?|$)/,
    scope: scopeSel,
    timeoutMs: 40_000,
  });
}

export const leverApplier: Applier & { run: typeof runLever } = {
  methods: ["lever"],
  run: runLever,
  apply: (input) => runSession(input, (ctx) => runLever(ctx)),
};
