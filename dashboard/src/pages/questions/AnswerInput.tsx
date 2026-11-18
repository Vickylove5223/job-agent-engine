// Input widget that adapts to a question's inputType.
import type { ReactNode } from "react";
import type { Question } from "@shared/types";
import { Input, Textarea, cx } from "@/components/ui";

export interface Draft {
  value: string;
  details: string;
  other: boolean;
}
export const emptyDraft: Draft = { value: "", details: "", other: false };

const SEP = " — ";
const MULTI_SEP = ", ";
const splitMulti = (v: string) => (v ? v.split(MULTI_SEP).filter(Boolean) : []);

export function composeAnswer(q: Question, d: Draft): string {
  switch (q.inputType) {
    case "yes_no":
      if (!d.value) return "";
      return d.details.trim() ? `${d.value}${SEP}${d.details.trim()}` : d.value;
    case "choice":
      if (q.multiple) {
        const parts = splitMulti(d.value);
        if (d.other && d.details.trim()) parts.push(d.details.trim());
        return parts.join(MULTI_SEP);
      }
      return d.other ? d.details.trim() : d.value;
    default:
      return d.value.trim();
  }
}

export function draftFromAnswer(q: Question, answer?: string): Draft {
  if (!answer) return emptyDraft;
  if (q.inputType === "yes_no") {
    const m = /^(Yes|No)(?:\s+—\s+(.*))?$/s.exec(answer);
    if (m) return { value: m[1], details: m[2] ?? "", other: false };
    return { value: "", details: answer, other: false };
  }
  if (q.inputType === "choice" && q.multiple) {
    const opts = q.options ?? [];
    const parts = splitMulti(answer);
    const known = parts.filter((p) => opts.includes(p));
    const rest = parts.filter((p) => !opts.includes(p)).join(MULTI_SEP);
    return { value: known.join(MULTI_SEP), details: rest, other: !!rest };
  }
  if (q.inputType === "choice") {
    if ((q.options ?? []).includes(answer)) return { value: answer, details: "", other: false };
    return { value: "", details: answer, other: true };
  }
  return { value: answer, details: "", other: false };
}

export function Pill({ active, onClick, children, autoFocusTarget }: { active: boolean; onClick: () => void; children: ReactNode; autoFocusTarget?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-autofocus={autoFocusTarget ? "" : undefined}
      className={cx(
        "h-9 rounded-md border px-4 text-sm font-medium transition-colors cursor-pointer",
        active ? "bg-primary text-primary-fg border-primary" : "bg-surface text-text border-border-strong hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

export function AnswerInput({ question, draft, onChange }: { question: Question; draft: Draft; onChange: (d: Draft) => void }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  if (question.inputType === "yes_no") {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {["Yes", "No"].map((v, i) => (
            <Pill key={v} active={draft.value === v} onClick={() => set({ value: draft.value === v ? "" : v })} autoFocusTarget={i === 0}>
              {v}
            </Pill>
          ))}
        </div>
        <Input placeholder="Details (optional)" value={draft.details} onChange={(e) => set({ details: e.target.value })} />
      </div>
    );
  }

  if (question.inputType === "choice") {
    const options = question.options ?? [];
    const multi = !!question.multiple;
    const selected = splitMulti(draft.value);
    const toggle = (o: string) => {
      if (!multi) return set({ value: o, other: false });
      const next = selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o];
      set({ value: options.filter((x) => next.includes(x)).join(MULTI_SEP) });
    };
    return (
      <div className="space-y-3">
        {multi && <p className="text-xs text-faint">Pick all that apply.</p>}
        <div className="flex flex-wrap gap-2">
          {options.map((o, i) => (
            <Pill key={o} active={multi ? selected.includes(o) : !draft.other && draft.value === o} onClick={() => toggle(o)} autoFocusTarget={i === 0}>
              {o}
            </Pill>
          ))}
          <Pill active={draft.other} onClick={() => set(multi ? { other: !draft.other } : { other: !draft.other, value: "" })} autoFocusTarget={options.length === 0}>
            Other
          </Pill>
        </div>
        {draft.other && (
          <Input autoFocus placeholder="Type your answer" value={draft.details} onChange={(e) => set({ details: e.target.value })} />
        )}
      </div>
    );
  }

  if (question.inputType === "number") {
    return (
      <Input
        type="number"
        inputMode="decimal"
        data-autofocus=""
        className="max-w-48"
        placeholder="0"
        value={draft.value}
        onChange={(e) => set({ value: e.target.value })}
      />
    );
  }

  return (
    <Textarea
      data-autofocus=""
      rows={3}
      className="min-h-20"
      placeholder="Your answer"
      value={draft.value}
      onChange={(e) => set({ value: e.target.value })}
    />
  );
}
