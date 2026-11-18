import { useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import type { Profile, WithId } from "@shared/types";
import { logActivity, nowIso, updateDocument } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";
import { Button, EmptyState, Panel } from "@/components/ui";
import { ResumeView } from "./ResumeView";

const MAX_BYTES = 900 * 1024;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(r.error ?? new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

function downloadPdf(base64: string, fileName: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "resume.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ResumeTab({ profile }: { profile: WithId<Profile> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resume = profile.masterResume;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${Math.round(file.size / 1024)} KB — the limit is 900 KB. Try exporting a smaller PDF.`);
      return;
    }
    setBusy(true);
    try {
      const pdfBase64 = await readBase64(file);
      const masterResume: NonNullable<Profile["masterResume"]> = {
        ...(resume ?? {}),
        fileName: file.name,
        uploadedAt: nowIso(),
        pdfBase64,
      };
      if (resume?.structured) masterResume.structured = resume.structured;
      await updateDocument("profile", "main", { masterResume });
      await logActivity("info", "profile", `Master resume replaced: ${file.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Master resume"
        actions={
          <div className="flex gap-2">
            {resume?.pdfBase64 && (
              <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} onClick={() => downloadPdf(resume.pdfBase64!, resume.fileName)}>
                Download
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={<Upload className="size-3.5" />} loading={busy} onClick={() => fileRef.current?.click()}>
              {resume ? "Replace" : "Upload"}
            </Button>
          </div>
        }
      >
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        {resume ? (
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2">
              <FileText className="size-5 text-muted" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{resume.fileName || "resume.pdf"}</div>
              <div className="text-xs text-faint" title={formatDateTime(resume.uploadedAt)}>Uploaded {timeAgo(resume.uploadedAt)}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">No resume uploaded yet. Upload a PDF (max 900 KB) — the agent reads it automatically.</p>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </Panel>

      <Panel title="Parsed resume" actions={<span className="hidden sm:inline text-xs text-faint">Read-only · the agent only uses what's here and in your facts</span>}>
        {resume?.structured ? (
          <ResumeView resume={resume.structured} headline={profile.headline} name={profile.fullName} />
        ) : (
          <EmptyState
            icon={<FileText className="size-8" />}
            title="No parsed resume yet"
            description="Once the agent reads your resume, its sections appear here."
          />
        )}
      </Panel>
    </div>
  );
}
