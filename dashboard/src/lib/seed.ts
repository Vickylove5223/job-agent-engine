// First-run import: copies the seed built from data/profile.local.json (served by the dev
// server only) into the active backend. Only available while running `npm run dev` locally,
// so personal data never ships in the public build.
import type { CollectionName, Collections } from "@shared/types";
import { backend, setDocument } from "./db";

export const canImportSeed = import.meta.env.DEV;

export async function importSeed(opts: { includeSamples: boolean }) {
  const res = await fetch("/__db/_seed");
  if (!res.ok) throw new Error("Seed endpoint unavailable — run the dashboard with `npm run dev`.");
  const seed = (await res.json()) as Record<string, Record<string, Record<string, unknown>>>;
  let n = 0;
  for (const [col, docs] of Object.entries(seed)) {
    for (const [id, data] of Object.entries(docs)) {
      if (!opts.includeSamples && (data as { sample?: boolean }).sample) continue;
      if (!opts.includeSamples && id.startsWith("a-sample")) continue;
      await setDocument(col as CollectionName, id, data as unknown as Collections[CollectionName]);
      n++;
    }
  }
  return { written: n, backend: backend.kind };
}
