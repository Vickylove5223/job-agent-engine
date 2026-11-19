export {};
// Shows each Gemini model's current status for this key (one tiny request each).
// npx tsx --env-file-if-exists=.env src/dev/probe-models.ts
const key = process.env.MODEL_API_KEY!;
const models = (process.env.GEMINI_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
for (const m of models) {
  const t = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with the JSON {\"ok\":true}" }] }], generationConfig: { responseMimeType: "application/json" } }),
  });
  const body = await r.text();
  const quota = body.match(/"quotaId":\s*"([^"]+)"/)?.[1] ?? "";
  const limit = body.match(/"quotaValue":\s*"([^"]+)"/)?.[1] ?? "";
  console.log(`${m.padEnd(26)} ${r.status} ${Date.now() - t}ms ${quota} ${limit}`);
}
