import { useRef, useState, type DragEvent } from "react";
import { CheckCircle2, FileText, Globe, Loader2, Upload } from "lucide-react";
import { Button, Field, Input, cx } from "@/components/ui";
import { formatBytes, type ResumeFile, currencyForCountry } from "../draft";
import { Group, type StepProps } from "../bits";
import { parseResumeAndPortfolio } from "@/lib/ai";
import { useAuth } from "@/lib/auth";

const MAX_BYTES = 1000 * 1024;

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

export function StepResumeProfile({ draft, set }: StepProps) {
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedSuccess, setAnalyzedSuccess] = useState(Boolean(draft.headline && draft.roles.length));
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const runAnalysis = async (resumeFile: ResumeFile, portfolioLink = draft.portfolio) => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const extracted = await parseResumeAndPortfolio(resumeFile, portfolioLink, user?.email ?? "");
      set({
        fullName: extracted.fullName || draft.fullName,
        phone: extracted.phone || draft.phone,
        country: extracted.country || draft.country || "US",
        city: extracted.city || draft.city,
        headline: extracted.headline || draft.headline,
        linkedin: extracted.linkedin || draft.linkedin,
        portfolio: portfolioLink || extracted.portfolio || draft.portfolio,
        roles: extracted.roles.length ? extracted.roles : draft.roles,
        seniority: extracted.seniority.length ? extracted.seniority : draft.seniority,
        yearsExperience: extracted.yearsExperience || draft.yearsExperience,
        includeKeywords: extracted.skills.length ? extracted.skills : draft.includeKeywords,
        workAuthorization: extracted.workAuthorization || draft.workAuthorization,
        noticePeriod: extracted.noticePeriod || draft.noticePeriod,
        extractedSkills: extracted.skills,
        extractedFacts: extracted.facts,
        extractedSummary: extracted.summary,
        currency: currencyForCountry(extracted.country || draft.country || "US"),
      });
      setAnalyzedSuccess(true);
    } catch (err) {
      setAnalysisError("AI analysis paused. You can fill or edit your details directly below.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePortfolioBlur = () => {
    if (draft.resume && draft.portfolio.trim() && !analyzing) {
      void runAnalysis(draft.resume, draft.portfolio.trim());
    }
  };

  return (
    <Group className="space-y-6">
      {/* 1. Resume Upload */}
      <ResumeDrop
        value={draft.resume}
        onChange={(resume) => {
          set({ resume });
          if (resume) {
            void runAnalysis(resume, draft.portfolio);
          } else {
            setAnalyzedSuccess(false);
          }
        }}
      />

      {/* 2. Portfolio URL */}
      <Field
        label={
          <span className="flex items-center gap-1.5 font-medium">
            <Globe className="size-4 text-muted" />
            Portfolio URL <span className="text-faint font-normal">(optional — personal site, GitHub, Behance, etc.)</span>
          </span>
        }
        hint="The agent reviews your portfolio to extract design/code projects, technologies, and achievements."
      >
        <Input
          type="url"
          value={draft.portfolio}
          onChange={(e) => set({ portfolio: e.target.value })}
          onBlur={handlePortfolioBlur}
          placeholder="https://myportfolio.design or https://github.com/username"
        />
      </Field>

      {/* AI Extraction Status */}
      {analyzing && (
        <div className="rounded-lg border border-accent/30 bg-accent-soft p-4 text-sm flex items-center gap-3 animate-pulse">
          <Loader2 className="size-5 text-accent-strong animate-spin shrink-0" />
          <div>
            <div className="font-semibold text-accent-strong">Extracting your details with AI…</div>
            <div className="text-xs text-muted mt-0.5">Reading resume, skills, work history, and portfolio details to set up your profile.</div>
          </div>
        </div>
      )}

      {analyzedSuccess && !analyzing && draft.resume && (
        <div className="rounded-lg border border-success/30 bg-success-soft p-4 text-sm flex items-center justify-between gap-3 text-success">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0" />
            <div>
              <span className="font-semibold block">Details extracted successfully!</span>
              <span className="text-xs text-muted font-normal">
                Click Continue below to review and confirm your profile details.
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-success/15 border border-success/30">
            Ready for Step 2 &rarr;
          </span>
        </div>
      )}

      {analysisError && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-warning">
          {analysisError}
        </div>
      )}
    </Group>
  );
}

function ResumeDrop({
  value,
  onChange,
}: {
  value: ResumeFile | null;
  onChange: (v: ResumeFile | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setError("Please upload a PDF document.");
    if (file.size > MAX_BYTES)
      return setError(`File is ${formatBytes(file.size)}. Maximum size is 1 MB.`);
    setBusy(true);
    try {
      const base64 = await readAsBase64(file);
      onChange({ fileName: file.name, size: file.size, base64 });
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

  return (
    <div>
      <div className="text-[13px] font-semibold mb-2">Resume (PDF) *</div>
      {value ? (
        <div
          className="flex items-center gap-3 rounded-xl border border-accent/40 bg-surface p-4 shadow-xs"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong">
            <FileText className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{value.fileName}</div>
            <div className="text-xs text-muted flex items-center gap-2">
              <span>{formatBytes(value.size)}</span>
              <span className="text-emerald-500 font-medium">Ready</span>
            </div>
          </div>
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()} loading={busy}>
            Replace
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cx(
            "w-full rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3",
            over
              ? "border-accent bg-accent-soft/30 scale-[1.01]"
              : "border-border hover:border-border-strong bg-surface hover:bg-surface-2",
          )}
        >
          <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent-strong shadow-xs">
            <Upload className="size-6" />
          </span>
          <div>
            <div className="text-sm font-semibold">Drop your resume here, or browse</div>
            <div className="mt-1 text-xs text-muted">Supports PDF up to 1 MB. Details are parsed securely.</div>
          </div>
        </button>
      )}

      {error && <div className="mt-2 text-xs text-danger font-medium">{error}</div>}

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
    </div>
  );
}
