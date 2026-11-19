// Moves records that claim actions which never happened (agency "submissions", "sent" cold emails,
// discovered-company lists from a hard-coded catalog, and their activity lines) into
// users/{uid}/_archived_fake/* so the dashboard stops showing them. Nothing is destroyed: each doc is
// copied to the archive before the original is removed.
// Usage: FIREBASE_SERVICE_ACCOUNT=... REAL_UID=... npx tsx src/dev/archive-fake.ts
import { firestore } from "../db";

const root = firestore().collection("users").doc(process.env.REAL_UID!);
const archive = root.collection("_archived_fake");
let moved = 0;
async function move(col: string, filter: (d: FirebaseFirestore.DocumentData) => boolean = () => true) {
  for (const d of (await root.collection(col).get()).docs) {
    if (!filter(d.data())) continue;
    await archive.doc(`${col}__${d.id}`).set({ collection: col, id: d.id, data: d.data(), archivedAt: new Date().toISOString(), reason: "claimed an action that never happened" });
    await d.ref.delete();
    moved++;
  }
}
await move("agencies");
await move("outreachCompanies");
await move("coldEmails");
await move("activity", (a) => a.type === "agency" || a.type === "outreach");
console.log(`archived ${moved} records`);
process.exit(0);
