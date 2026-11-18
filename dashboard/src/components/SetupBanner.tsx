import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useDoc } from "@/lib/db";
import { canImportSeed, importSeed } from "@/lib/seed";
import { Button, Switch } from "./ui";

/** Shown until profile/main exists. Imports the profile built from the resume + portfolio. */
export function SetupBanner() {
  const { data: profile, loading } = useDoc("profile", "main");
  const [busy, setBusy] = useState(false);
  const [samples, setSamples] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  if (loading || profile) return null;
  return (
    <div className="mb-6 rounded-lg border border-accent bg-accent-soft p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Sparkles className="size-5 shrink-0 text-accent-strong mt-0.5" />
          <div>
            <div className="font-semibold">Finish setup</div>
            <p className="text-sm text-muted mt-0.5">
              {canImportSeed
                ? "Import your profile built from your resume and portfolio. The AI's questions for you will appear under Questions."
                : "Open the dashboard locally with `npm run dev` once to import your profile."}
            </p>
            {err && <p className="text-sm text-danger mt-1">{err}</p>}
          </div>
        </div>
        {canImportSeed && (
          <div className="flex items-center gap-4">
            <Switch checked={samples} onChange={setSamples} label="Include sample jobs" />
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await importSeed({ includeSamples: samples });
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Import my profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
