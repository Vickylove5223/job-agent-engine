function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Copy agent/.env.example to agent/.env and fill it in.`);
  return v;
}

export const env = {
  get browserbaseApiKey() {
    return need("BROWSERBASE_API_KEY");
  },
  get browserbaseProjectId() {
    return need("BROWSERBASE_PROJECT_ID");
  },
  get model() {
    return (process.env.STAGEHAND_MODEL ?? "google/gemini-2.5-flash") as `google/${string}`;
  },
  get modelApiKey() {
    return need("MODEL_API_KEY");
  },
};
