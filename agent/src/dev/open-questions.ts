// Read-only: open questions + job statuses for a real user.
import { userDb } from "../db";
const db = userDb(process.env.REAL_UID!);
for (const q of await db.list("questions", ["status", "==", "open"])) console.log(`Q [${q.origin}] ${q.text}${q.suggestedAnswer ? `\n   suggested: ${q.suggestedAnswer}` : ""}`);
for (const j of await db.list("jobs")) console.log(`JOB ${j.status.padEnd(14)} ${j.score?.master ?? "-"} ${j.title} @ ${j.company} ${j.error ? "| " + j.error : ""}`);
process.exit(0);
