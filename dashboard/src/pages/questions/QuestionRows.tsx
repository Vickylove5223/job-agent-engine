// Rows for the Answered and Dismissed tabs.
import { useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import type { Fact, Question, WithId } from "@shared/types";
import { Badge, Button } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/format";
import { AnswerInput, composeAnswer, draftFromAnswer, type Draft } from "./AnswerInput";
import { ORIGIN } from "./QuestionCard";
import { NOT_APPLICABLE, editAnswer, reopenQuestion } from "./logic";

export function AnsweredRow({ question, facts }: { question: WithId<Question>; facts: WithId<Fact>[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromAnswer(question, question.answer));
  const [busy, setBusy] = useState(false);
  const answer = composeAnswer(question, draft);
  const origin = ORIGIN[question.origin] ?? ORIGIN.profile;
  const linked = facts.some((f) => f.questionId === question.id);

  const startEdit = () => {
    setDraft(draftFromAnswer(question, question.answer));
    setEditing(true);
  };
  const save = async (value: string) => {
    if (!value) return;
    setBusy(true);
    try {
      await editAnswer(question, value, facts);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge tone={origin.tone}>{origin.label}</Badge>
            {linked && <Badge tone="green">In profile</Badge>}
          </div>
          <div className="font-medium leading-snug">{question.text}</div>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" />} onClick={startEdit}>Edit</Button>
        )}
      </div>

      {editing ? (
        <div
          className="mt-3 space-y-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void save(answer);
            }
            if (e.key === "Escape") setEditing(false);
          }}
        >
          <AnswerInput question={question} draft={draft} onChange={setDraft} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" loading={busy} disabled={!answer} onClick={() => void save(answer)}>Save</Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void save(NOT_APPLICABLE)}>I don't have this</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <div className="text-sm whitespace-pre-wrap break-words">
            <span className="text-faint mr-1.5">Your answer:</span>
            {question.answer || <span className="text-faint">—</span>}
          </div>
          <div className="text-xs text-faint shrink-0" title={formatDateTime(question.answeredAt)}>{timeAgo(question.answeredAt)}</div>
        </div>
      )}
    </div>
  );
}

export function DismissedRow({ question }: { question: WithId<Question> }) {
  const [busy, setBusy] = useState(false);
  const origin = ORIGIN[question.origin] ?? ORIGIN.profile;
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="mb-1"><Badge tone={origin.tone}>{origin.label}</Badge></div>
        <div className="font-medium leading-snug text-muted">{question.text}</div>
        <div className="text-xs text-faint mt-1">Asked {timeAgo(question.createdAt)}</div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={<RotateCcw className="size-3.5" />}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await reopenQuestion(question);
          } finally {
            setBusy(false);
          }
        }}
      >
        Reopen
      </Button>
    </div>
  );
}
