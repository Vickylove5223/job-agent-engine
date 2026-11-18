import { useMemo, useState } from "react";
import type { CollectionName } from "@shared/types";
import { Button } from "@/components/ui";
import { deleteDocument, logActivity, updateDocument, useCollection } from "@/lib/db";
import { SettingsSection } from "./SettingsSection";

const isSample = (d: { id: string; sample?: boolean }) => d.sample === true || d.id.startsWith("a-sample");

export function DangerZone() {
  const jobs = useCollection("jobs");
  const apps = useCollection("applications");
  const activity = useCollection("activity");
  const resumes = useCollection("resumes");
  const letters = useCollection("coverLetters");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [rerunning, setRerunning] = useState(false);

  const rerunSetup = async () => {
    if (!window.confirm("Re-run the setup wizard? Your current settings, profile and jobs are kept.")) return;
    setRerunning(true);
    try {
      await updateDocument("settings", "main", { onboardedAt: "" });
    } finally {
      setRerunning(false);
    }
  };

  const loading = jobs.loading || apps.loading || activity.loading || resumes.loading || letters.loading;

  const plan = useMemo(() => {
    const jobIds = jobs.data.filter(isSample).map((d) => d.id);
    const appIds = apps.data.filter(isSample).map((d) => d.id);
    const related = new Set([...jobIds, ...appIds]);
    const actIds = activity.data
      .filter((d) => isSample(d as { id: string; sample?: boolean }) || (!!d.jobId && related.has(d.jobId)))
      .map((d) => d.id);
    const resumeIds = resumes.data.filter((d) => related.has(d.id) || isSample(d as { id: string; sample?: boolean })).map((d) => d.id);
    const letterIds = letters.data.filter((d) => related.has(d.id) || isSample(d as { id: string; sample?: boolean })).map((d) => d.id);
    const groups: [CollectionName, string[]][] = [
      ["jobs", jobIds], ["applications", appIds], ["activity", actIds], ["resumes", resumeIds], ["coverLetters", letterIds],
    ];
    return { groups, total: groups.reduce((n, [, ids]) => n + ids.length, 0) };
  }, [jobs.data, apps.data, activity.data, resumes.data, letters.data]);

  const counts = plan.groups.filter(([, ids]) => ids.length).map(([col, ids]) => `${ids.length} ${col === "coverLetters" ? "cover letters" : col}`);

  const run = async () => {
    if (!window.confirm(`Delete ${plan.total} sample records (${counts.join(", ")})? This cannot be undone.`)) return;
    setBusy(true);
    try {
      for (const [col, ids] of plan.groups) for (const id of ids) await deleteDocument(col, id);
      setDone(plan.total);
      await logActivity("info", "sample_data_deleted", `Deleted ${plan.total} sample records`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection title="Danger zone" tone="danger" hideFooter description="Actions that reset or remove data.">
      <div className="flex flex-col gap-4 border-b border-border pb-5 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Re-run setup wizard</div>
          <p className="text-sm text-muted mt-0.5">Walk through roles, locations and job sites again. Nothing is deleted.</p>
        </div>
        <Button variant="danger" loading={rerunning} onClick={rerunSetup}>
          Re-run setup wizard
        </Button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Delete sample data</div>
          <p className="text-sm text-muted mt-0.5">
            {loading
              ? "Counting sample records…"
              : plan.total === 0
                ? done !== null ? `Removed ${done} sample records.` : "No sample data found."
                : `Will remove ${counts.join(", ")}.`}
          </p>
        </div>
        <Button variant="danger" loading={busy} disabled={loading || plan.total === 0} onClick={run}>
          Delete sample data
        </Button>
      </div>
    </SettingsSection>
  );
}
