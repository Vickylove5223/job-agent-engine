import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  CornerDownLeft,
  HelpCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button, Textarea, cx } from "@/components/ui";
import { generatePrefilledQuestions, type PrefilledQuestion } from "@/lib/ai";
import { Group, type StepProps } from "../bits";

export function StepMatchQuestions({ draft, set }: StepProps) {
  const [questions, setQuestions] = useState<PrefilledQuestion[]>(() => {
    if (draft.prefilledQuestions?.length) return draft.prefilledQuestions;
    return generatePrefilledQuestions(draft);
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(Boolean(draft.confirmedQuestions));

  useEffect(() => {
    if (!draft.prefilledQuestions?.length) {
      const qList = generatePrefilledQuestions(draft);
      setQuestions(qList);
      set({ prefilledQuestions: qList });
    }
  }, []);

  const totalQuestions = questions.length || 1;
  const currentQ = questions[currentIndex];
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  const updateAnswer = (id: string, answer: string) => {
    const updated = questions.map((q) => (q.id === id ? { ...q, answer } : q));
    setQuestions(updated);
    set({ prefilledQuestions: updated });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      set({ confirmedQuestions: true });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleConfirmAll = () => {
    setIsCompleted(true);
    set({ confirmedQuestions: true });
  };

  // Keyboard navigation for authentic Typeform feel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (e.key === "Enter" && !e.shiftKey) {
        if (!isCompleted) {
          e.preventDefault();
          handleNext();
        }
      } else if (!isInput && (e.key === "y" || e.key === "Y")) {
        if (currentQ?.inputType === "yes_no") {
          updateAnswer(currentQ.id, "Yes");
        }
      } else if (!isInput && (e.key === "n" || e.key === "N")) {
        if (currentQ?.inputType === "yes_no") {
          updateAnswer(currentQ.id, "No");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, isCompleted, currentQ]);

  return (
    <Group className="space-y-6">
      {/* Background Agent Execution Banner (Replaces frontend instant match cards) */}
      <div className="rounded-xl border border-border bg-surface p-4 flex items-center gap-3.5">
        <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-strong shrink-0">
          <Bot className="size-5" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
            <span>Automated Background Job Engine</span>
            <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            Live job matching, ATS tailoring, and application submissions run entirely in the background once your agent launches.
          </p>
        </div>
      </div>

      {/* Main Interactive Typeform-style Flow */}
      {!isCompleted && currentQ ? (
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-6 transition-all">
          {/* Header & Typeform Progress Tracker */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-accent-soft text-accent-strong">
                <Sparkles className="size-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-text uppercase tracking-wider">
                  AI Screening Question {currentIndex + 1} of {totalQuestions}
                </span>
                <span className="text-[11px] text-muted block">
                  Prefilled by AI · Confirm or customize
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleConfirmAll}
                className="text-xs text-muted hover:text-accent-strong"
                title="Accept all AI prefilled answers and skip to launch"
              >
                <Check className="size-3.5" /> Confirm all
              </Button>
            </div>
          </div>

          {/* Thin Progress Bar */}
          <div className="w-full bg-surface-2 rounded-full h-1 overflow-hidden">
            <div
              className="bg-accent h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Question Content */}
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent-soft text-accent-strong border border-accent/20">
                {currentQ.category}
              </span>
              {currentQ.whyNeeded && (
                <span className="text-xs text-muted flex items-center gap-1">
                  <HelpCircle className="size-3.5 text-faint" />
                  {currentQ.whyNeeded}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text leading-snug">
              {currentQ.text}
            </h2>

            {/* Typeform Input Controls */}
            <div className="pt-2">
              {currentQ.inputType === "yes_no" ? (
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  {["No", "Yes"].map((opt, i) => {
                    const isSelected = currentQ.answer.toLowerCase() === opt.toLowerCase();
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          updateAnswer(currentQ.id, opt);
                        }}
                        className={cx(
                          "flex items-center justify-between p-3.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer",
                          isSelected
                            ? "border-accent bg-accent-soft text-accent-strong ring-2 ring-accent/30 shadow-xs"
                            : "border-border bg-surface hover:border-border-strong hover:bg-surface-2 text-text"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="grid size-6 place-items-center rounded-md bg-surface-2 text-xs text-muted border border-border">
                            {i === 0 ? "N" : "Y"}
                          </span>
                          <span>{opt}</span>
                        </span>
                        {isSelected && <Check className="size-4 text-accent-strong" />}
                      </button>
                    );
                  })}
                </div>
              ) : currentQ.inputType === "choice" && currentQ.options ? (
                <div className="space-y-2.5 max-w-md">
                  {currentQ.options.map((opt, i) => {
                    const isSelected = currentQ.answer.toLowerCase() === opt.toLowerCase();
                    const letter = String.fromCharCode(65 + i);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          updateAnswer(currentQ.id, opt);
                        }}
                        className={cx(
                          "w-full flex items-center justify-between p-3.5 rounded-xl border text-sm transition-all cursor-pointer text-left",
                          isSelected
                            ? "border-accent bg-accent-soft text-accent-strong ring-2 ring-accent/30 shadow-xs font-semibold"
                            : "border-border bg-surface hover:border-border-strong hover:bg-surface-2 text-text"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid size-6 place-items-center rounded-md bg-surface-2 text-xs text-muted border border-border font-semibold shrink-0">
                            {letter}
                          </span>
                          <span>{opt}</span>
                        </div>
                        {isSelected && <Check className="size-4 text-accent-strong shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 max-w-xl">
                  <Textarea
                    value={currentQ.answer}
                    onChange={(e) => updateAnswer(currentQ.id, e.target.value)}
                    rows={3}
                    className="text-sm font-medium leading-relaxed"
                    placeholder="Type or customize your screening answer…"
                  />
                  <p className="text-[11px] text-faint">
                    Feel free to customize or accept AI's prefilled response.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                icon={<ArrowLeft className="size-3.5" />}
                className="text-xs"
              >
                Previous
              </Button>

              {/* Step indicator pills */}
              <div className="hidden sm:flex items-center gap-1.5 ml-2">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentIndex(i)}
                    className={cx(
                      "size-2 rounded-full transition-all cursor-pointer",
                      i === currentIndex
                        ? "bg-accent scale-125"
                        : i < currentIndex
                        ? "bg-accent-strong/60"
                        : "bg-border"
                    )}
                    title={`Jump to Question ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleNext}
              className="text-xs h-9 px-4 flex items-center gap-1.5"
            >
              <span>{currentIndex === totalQuestions - 1 ? "Confirm & Finish" : "Next Question"}</span>
              <CornerDownLeft className="size-3 opacity-70" />
            </Button>
          </div>
        </div>
      ) : (
        /* Completed Review Card */
        <div className="rounded-2xl border border-success/30 bg-surface p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="grid size-11 place-items-center rounded-xl bg-success-soft text-success shrink-0">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text">
                  All Screening Questions Confirmed!
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed max-w-lg">
                  Your screening responses are confirmed. When you click <strong>Launch Agent & Auto-Apply</strong> below, your agent will search matching jobs and submit applications in the background using these responses.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setCurrentIndex(0);
                setIsCompleted(false);
              }}
              icon={<RotateCcw className="size-3.5" />}
              className="text-xs shrink-0"
            >
              Review Questions
            </Button>
          </div>

          {/* Quick Review of Confirmed Answers */}
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-xs font-semibold text-text uppercase tracking-wider block mb-2">
              Confirmed Screening Answers
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-border bg-surface-2/60 p-3 text-xs flex flex-col justify-between gap-2 hover:border-border-strong transition-colors"
                >
                  <div className="space-y-1">
                    <span className="font-semibold text-text block line-clamp-1">
                      {idx + 1}. {q.text}
                    </span>
                    <span className="text-accent-strong font-medium block line-clamp-2">
                      &rarr; {q.answer || "Yes, confirmed"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-faint pt-1 border-t border-border/40">
                    <span className="uppercase">{q.category}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setIsCompleted(false);
                      }}
                      className="text-accent-strong hover:underline font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Group>
  );
}
