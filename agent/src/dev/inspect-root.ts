// Read-only: lists top-level collections and the users/* docs in the real Firestore.
import { firestore } from "../db";
const fs = firestore();
for (const c of await fs.listCollections()) {
  const s = await c.limit(5).get();
  console.log(`/${c.id}: ${s.size}+ docs`, s.docs.map((d) => d.id).join(", "));
}
for (const u of await fs.collection("users").listDocuments()) {
  const cols = await u.listCollections();
  const counts = await Promise.all(cols.map(async (c) => `${c.id}=${(await c.get()).size}`));
  console.log(`users/${u.id}: ${counts.join(" ")}`);
}
process.exit(0);
