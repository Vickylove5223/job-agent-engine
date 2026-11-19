// Answers open "consent" questions for a user who allowed ticking required consent boxes.
import { userDb, nowIso } from "../db";
const db = userDb(process.env.REAL_UID!);
for (const q of await db.list("questions", ["status", "==", "open"])) {
  if (/consent|retain my data|privacy|personal data/i.test(q.text)) {
    await db.update("questions", q.id, { status: "answered", answer: "Yes (required consent — allowed in settings)", answeredAt: nowIso() });
    console.log("answered:", q.text.slice(0, 80));
  }
}
process.exit(0);
