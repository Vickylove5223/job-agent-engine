import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckCircle2, MessageCircleQuestion, PartyPopper } from "lucide-react";
import type { Question, WithId } from "@shared/types";
import { useCollection } from "@/lib/db";
import { EmptyState, LoadingBlock, PageHeader, Panel, Tabs } from "@/components/ui";
import { QuestionCard, type CardPhase } from "./QuestionCard";
import { AnsweredRow, DismissedRow } from "./QuestionRows";
import { NOT_APPLICABLE, dismissQuestion, submitAnswer } from "./logic";

type Tab = "open" | "answered" | "dismissed";
type Exiting = { q: WithId<Question>; phase: CardPhase; label: string };

const byCreated = (a: { createdAt: string }, b: { createdAt: string }) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "");

export function Questions() {
  const { data: questions, loading } = useCollection("questions", { orderBy: "createdAt" });
  const { data: jobs } = useCollection("jobs");
  const { data: facts } = useCollection("facts");
  const [tab, setTab] = useState<Tab>("open");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [exiting, setExiting] = useState<Record<string, Exiting>>({});
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const didInitialFocus = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const jobsById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const open = useMemo(() => questions.filter((q) => q.status === "open"), [questions]);
  const answered = useMemo(
    () => questions.filter((q) => q.status === "answered").sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? "")),
    [questions],
  );
  const dismissed = useMemo(() => questions.filter((q) => q.status === "dismissed"), [questions]);

  // Open cards (plus ones animating away), oldest first; skipped ones at the bottom in skip order.
  const openList = useMemo(() => {
    const ids = new Set(open.map((q) => q.id));
    const list = [...open, ...Object.values(exiting).filter((e) => !ids.has(e.q.id)).map((e) => e.q)].sort(byCreated);
    const rank = (id: string) => {
      const i = skipped.indexOf(id);
      return i === -1 ? -1 : i;
    };
    return list.sort((a, b) => rank(a.id) - rank(b.id));
  }, [open, exiting, skipped]);

  const activeList = openList.filter((q) => !exiting[q.id]);

  useEffect(() => {
    if (didInitialFocus.current || loading || tab !== "open" || !activeList.length) return;
    didInitialFocus.current = true;
    setFocus({ id: activeList[0].id, n: 0 });
  }, [loading, tab, activeList]);

  const total = answered.length + open.length;
  const pct = total ? Math.round((answered.length / total) * 100) : 0;

  const focusNextAfter = (id: string) => {
    const idx = activeList.findIndex((q) => q.id === id);
    const next = activeList[idx + 1] ?? activeList.find((q) => q.id !== id);
    if (next) setFocus((f) => ({ id: next.id, n: (f?.n ?? 0) + 1 }));
  };

  /** Mark the card done, animate it away, run the write. Rolls back the card on error. */
  const finish = async (q: WithId<Question>, label: string, write: () => Promise<void>) => {
    setExiting((e) => ({ ...e, [q.id]: { q, phase: "saved", label } }));
    focusNextAfter(q.id);
    try {
      await write();
    } catch (err) {
      setExiting((e) => {
        const { [q.id]: _removed, ...rest } = e;
        return rest;
      });
      window.alert(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    timers.current.push(
      window.setTimeout(() => setExiting((e) => (e[q.id] ? { ...e, [q.id]: { ...e[q.id], phase: "leaving" } } : e)), 900),
      window.setTimeout(() => {
        setExiting((e) => {
          const { [q.id]: _removed, ...rest } = e;
          return rest;
        });
        setSkipped((s) => s.filter((x) => x !== q.id));
      }, 1250),
    );
  };

  const header = (
    <>
      <PageHeader title="Questions" description="The agent asks when it isn't sure. Answer once — it remembers." />
      {total > 0 && (
        <div className="mb-6">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="font-medium">{answered.length}</span>
              <span className="text-muted"> of {total} answered</span>
            </span>
            <span className="text-xs text-faint tabular-nums">{pct}%</span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="max-w-3xl">
        {header}
        <LoadingBlock />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {header}
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "open", label: "Open", count: open.length },
          { value: "answered", label: "Answered", count: answered.length },
          { value: "dismissed", label: "Dismissed", count: dismissed.length },
        ]}
      />

      {tab === "open" &&
        (openList.length === 0 ? (
          <Panel>
            {questions.length === 0 ? (
              <EmptyState
                icon={<MessageCircleQuestion className="size-8" />}
                title="No questions yet"
                description="When the agent isn't sure about something — your salary range, a skill, a form field — it will ask here."
              />
            ) : (
              <EmptyState
                icon={<PartyPopper className="size-8 text-accent-strong" />}
                title="You're all caught up"
                description="Every question is answered. The agent will use your answers from now on and won't ask again."
              />
            )}
          </Panel>
        ) : (
          <div>
            {openList.map((q) => {
              const ex = exiting[q.id];
              return (
                <QuestionCard
                  key={q.id}
                  question={ex?.q ?? q}
                  jobsById={jobsById}
                  phase={ex?.phase ?? "idle"}
                  doneLabel={ex?.label}
                  focusRequest={focus?.id === q.id ? focus.n : null}
                  onSave={(answer, saveAsFact) =>
                    finish(q, "Saved — the agent will remember this", () => submitAnswer({ question: q, answer, saveAsFact, jobs, questions }))
                  }
                  onNotApplicable={() =>
                    finish(q, "Saved — noted that you don't have this", () =>
                      submitAnswer({ question: q, answer: NOT_APPLICABLE, saveAsFact: true, negative: true, jobs, questions }),
                    )
                  }
                  onSkip={() => {
                    focusNextAfter(q.id);
                    setSkipped((s) => [...s.filter((x) => x !== q.id), q.id]);
                  }}
                  onDismiss={() => finish(q, "Dismissed", () => dismissQuestion(q))}
                />
              );
            })}
            <p className="mt-2 text-xs text-faint">Tip: press Ctrl+Enter to save the answer you're typing.</p>
          </div>
        ))}

      {tab === "answered" && (
        <Panel padded={false}>
          {answered.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="size-8" />} title="Nothing answered yet" description="Answers you give appear here. You can edit them any time." />
          ) : (
            <div className="divide-y divide-border">
              {answered.map((q) => <AnsweredRow key={q.id} question={q} facts={facts} />)}
            </div>
          )}
        </Panel>
      )}

      {tab === "dismissed" && (
        <Panel padded={false}>
          {dismissed.length === 0 ? (
            <EmptyState icon={<Archive className="size-8" />} title="No dismissed questions" description="Questions you dismiss show up here so you can reopen them later." />
          ) : (
            <div className="divide-y divide-border">
              {dismissed.map((q) => <DismissedRow key={q.id} question={q} />)}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
