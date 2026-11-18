// Smoke test for the hosted browser setup: `npm run check` (in agent/).
// Opens a Browserbase browser, loads a page, asks Stagehand to read it, then closes.
import { z } from "zod";
import { openBrowser } from "./browser";

const t0 = Date.now();
console.log("1/4 Starting a hosted browser on Browserbase…");
const b = await openBrowser({ timeoutSec: 120 });
try {
  console.log(`    session ${b.sessionId}`);
  console.log(`    watch: https://www.browserbase.com/sessions/${b.sessionId}`);

  console.log("2/4 Loading a job board page…");
  await b.page.goto("https://boards.greenhouse.io/");

  console.log("3/4 Asking Stagehand (AI) to read the page…");
  const res = await b.stagehand.extract("What is the main heading of this page?", z.object({ heading: z.string() }));
  console.log("    page heading:", JSON.stringify(res));

  console.log("4/4 Closing…");
} finally {
  await b.close();
}
console.log(`OK — hosted browser + Stagehand work. Took ${((Date.now() - t0) / 1000).toFixed(1)}s of browser time.`);
