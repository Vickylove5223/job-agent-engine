// One open question card: context, adaptive input, actions.
import { useEffect, useRef, useState } from "react";
import { Check, Clock, Sparkles } from "lucide-react";
import type { Job, Question, WithId } from "@shared/types";
import { Badge, Button, Switch, cx, type Tone } from "@/components/ui";
import { AnswerInput, composeAnswer, draftFromAnswer, emptyDraft, type Draft } from "./AnswerInput";

export const ORIGIN: Record<Question["origin"], { label: string; tone: Tone }> = {
  profile: { label: "Setup", tone: "neutral" },
  scoring: { label: "Job match", tone: "blue" },
  form: { label: "Application form", tone: "indigo" },
  tailoring: { label: "Resume", tone: "amber" },
};

export type CardPhase = "idle" | "saved" | "leaving";

export function JobChips({ jobIds, jobsById }: { jobIds: string[]; jobsById: Map<string, WithId<Job>> }) {
  if (!jobIds.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning mr-1">
        <Clock className="size-3.5" />
        {jobIds.length} job{jobIds.length === 1 ? "" : "s"} waiting
      </span>
      {jobIds.map((id) => {
        const j = jobsById.get(id);
        return (
          <a
            key={id}
            href={`#/jobs?job=${encodeURIComponent(id)}`}
            className="inline-flex max-w-full items-center rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted hover:text-text hover:border-border-strong truncate"
          >
            <span className="truncate">{j ? `${j.title} · ${j.company}` : "Unknown job"}</span>
          </a>
        );
      })}
    </div>
  );
}

export function QuestionCard({
  question, jobsById, phase, doneLabel, focusRequest, onSave, onNotApplicable, onSkip, onDismiss,
}: {
  question: WithId<Question>;
  jobsById: Map<string, WithId<Job>>;
  phase: CardPhase;
  doneLabel?: string;
  focusRequest: number | null;
  onSave: (answer: string, saveAsFact: boolean) => Promise<void>;
  onNotApplicable: () => Promise<void>;
  onSkip: () => void;
  onDismiss: () => Promise<void>;
}) {
  const suggestion = question.suggestedAnswer?.trim();
  const [draft, setDraft] = useState<Draft>(() => (suggestion ? draftFromAnswer(question, suggestion) : emptyDraft));
  const [saveAsFact, setSaveAsFact] = useState(question.saveAsFact ?? true);
  const [busy, setBusy] = useState<null | "save" | "na" | "dismiss">(null);
  const ref = useRef<HTMLDivElement>(null);
  const answer = composeAnswer(question, draft);
  // A suggestion that arrives later (realtime) fills the box only if the user hasn't typed yet.
  const touched = useRef(false);
  useEffect(() => {
    if (suggestion && !touched.current) setDraft(draftFromAnswer(question, suggestion));
  }, [suggestion, question]);
  const usingSuggestion = !!suggestion && answer === composeAnswer(question, draftFromAnswer(question, suggestion));
  const placeholders = answer.match(/\[[^\]]{1,60}\]/g) ?? [];
  const origin = ORIGIN[question.origin] ?? ORIGIN.profile;

  useEffect(() => {
    if (focusRequest === null) return;
    const el = ref.current?.querySelector<HTMLElement>("[data-autofocus]");
    el?.focus({ preventScroll: false });
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusRequest]);

  const run = async (kind: "save" | "na" | "dismiss", fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  const save = () => {
    if (!answer || placeholders.length || busy || phase !== "idle") return;
    void run("save", () => onSave(answer, saveAsFact));
  };

  const done = phase !== "idle";

  return (
    <div className={cx("grid transition-[grid-template-rows,opacity] duration-300 ease-out", phase === "leaving" ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")}>
      <div className="overflow-hidden">
        <div className="pb-3">
          <div
            ref={ref}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                save();
              }
            }}
            className={cx(
              "rounded-lg border bg-surface p-5 transition-colors",
              done ? "border-accent-strong bg-accent-soft" : "border-border focus-within:border-border-strong",
            )}
          >
            {done ? (
              <div className="flex items-center gap-3 py-1">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent-strong text-surface">
                  <Check className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-accent-strong">{doneLabel ?? "Saved"}</div>
                  <div className="truncate text-sm text-muted">{question.text}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <Badge tone={origin.tone}>{origin.label}</Badge>
                </div>
                <h3 className="text-[15px] font-semibold leading-snug">{question.text}</h3>
                {question.whyNeeded && <p className="mt-1 text-sm text-muted">{question.whyNeeded}</p>}
                {question.jobIds?.length > 0 && (
                  <div className="mt-3">
                    <JobChips jobIds={question.jobIds} jobsById={jobsById} />
                  </div>
                )}

                <div className="mt-4">
                  {suggestion && (
                    <div className="mb-2 flex items-start gap-2 text-[13px] text-muted">
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent-strong" />
                      <span>
                        {usingSuggestion ? "Suggested answer drafted from your resume — check it and edit anything that isn't right." : "Edited from the suggested answer."}
                        {placeholders.length > 0 && <span className="text-warning"> Fill in the parts in [brackets] before saving.</span>}
                      </span>
                    </div>
                  )}
                  <AnswerInput question={question} draft={draft} onChange={(d) => { touched.current = true; setDraft(d); }} />
                </div>

                <div className="mt-4">
                  <Switch checked={saveAsFact} onChange={setSaveAsFact} label="Save to my profile permanently" />
                </div>

                <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={onSkip} disabled={!!busy}>Skip for now</Button>
                    <Button variant="ghost" size="sm" loading={busy === "dismiss"} disabled={!!busy} onClick={() => void run("dismiss", onDismiss)}>
                      Dismiss
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" loading={busy === "na"} disabled={!!busy} onClick={() => void run("na", onNotApplicable)}>
                      I don't have this
                    </Button>
                    <Button variant="primary" loading={busy === "save"} disabled={!answer || placeholders.length > 0 || !!busy} onClick={save} title="Ctrl+Enter">
                      Save answer
                      <kbd className="hidden sm:inline rounded border border-current/30 px-1 text-[10px] font-normal opacity-70">Ctrl ↵</kbd>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
