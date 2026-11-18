import { useRef, useState, type DragEvent } from "react";
import { FileText, Upload } from "lucide-react";
import { Button, Field, Input, cx } from "@/components/ui";
import { formatBytes, type ResumeFile } from "../draft";
import { Group, Note, type StepProps } from "../bits";

const MAX_BYTES = 900 * 1024;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(r.error ?? new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

export function StepResume({ draft, set }: StepProps) {
  return (
    <Group>
      <ResumeDrop value={draft.resume} onChange={(resume) => set({ resume })} />
      {!draft.resume && <Note>The agent needs a resume before it can apply. You can skip this and add it later in your profile.</Note>}
      <Field label="Headline" hint="One line recruiters see first.">
        <Input value={draft.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="e.g. Product Designer with 5 years of experience" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={<>LinkedIn URL <span className="text-faint font-normal">(optional)</span></>}>
          <Input type="url" value={draft.linkedin} onChange={(e) => set({ linkedin: e.target.value })} placeholder="https://linkedin.com/in/…" />
        </Field>
        <Field label={<>Portfolio URL <span className="text-faint font-normal">(optional)</span></>}>
          <Input type="url" value={draft.portfolio} onChange={(e) => set({ portfolio: e.target.value })} placeholder="https://…" />
        </Field>
      </div>
    </Group>
  );
}

function ResumeDrop({ value, onChange }: { value: ResumeFile | null; onChange: (v: ResumeFile | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setError("Please choose a PDF file.");
    if (file.size > MAX_BYTES) return setError(`That file is ${formatBytes(file.size)}. The limit is 900 KB — try exporting a smaller PDF.`);
    setBusy(true);
    try {
      onChange({ fileName: file.name, size: file.size, base64: await readAsBase64(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void accept(e.dataTransfer.files[0]);
  };

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      className="hidden"
      onChange={(e) => {
        void accept(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return (
    <div>
      <div className="text-[13px] font-medium mb-2">Resume (PDF)</div>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-strong"><FileText className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{value.fileName}</div>
            <div className="text-xs text-faint">{formatBytes(value.size)}</div>
          </div>
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()} loading={busy}>Replace</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>Remove</Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cx(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors cursor-pointer",
            over ? "border-accent-strong bg-accent-soft" : "border-border-strong bg-bg-subtle hover:bg-surface-2",
          )}
        >
          <Upload className="size-5 text-muted" />
          <div className="text-sm font-medium">{busy ? "Reading file…" : "Drop your resume here, or click to browse"}</div>
          <div className="text-xs text-faint">PDF, up to 900 KB</div>
        </button>
      )}
      {picker}
      {error && <div className="mt-2 text-xs text-danger">{error}</div>}
    </div>
  );
}
