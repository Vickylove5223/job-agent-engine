// First-run setup wizard. Shown by App.tsx until settings/main has onboardedAt.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { Button, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { signOut } from "@/lib/firebase";
import { TOTAL_STEPS, clearDraft, isStepValid, loadDraft, saveDraft, type Draft } from "./draft";
import { launchAgent } from "./launch";
import { StepResumeProfile } from "./steps/StepResumeProfile";
import { StepConfirmProfile } from "./steps/StepConfirmProfile";
import { StepTargeting } from "./steps/StepTargeting";
import { StepMatchQuestions } from "./steps/StepMatchQuestions";

const STEPS: { title: string; subtitle: string }[] = [
  {
    title: "Upload your resume & portfolio",
    subtitle: "We'll automatically extract your details to build your profile.",
  },
  {
    title: "Confirm your profile details",
    subtitle: "Review and edit the details automatically extracted from your resume.",
  },
  {
    title: "Job targeting & preferences",
    subtitle: "Tell the agent where you want to apply, target roles, and seniority level.",
  },
  {
    title: "Recruiter screening questions",
    subtitle: "Confirm prefilled responses for AI to use during background applications.",
  },
];

export function Onboarding() {
  const { user } = useAuth();
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const launched = useRef(false);

  useEffect(() => {
    if (!launched.current) saveDraft(draft);
  }, [draft]);

  const set = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), []);
  const goTo = useCallback((step: number) => {
    setError(null);
    setDraft((d) => ({ ...d, step }));
    window.scrollTo({ top: 0 });
  }, []);

  const step = draft.step;
  const valid = isStepValid(draft, step);
  const isLast = step === TOTAL_STEPS;
  const meta = STEPS[step - 1] ?? STEPS[0];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || launching || isLast) return;
    goTo(step + 1);
  };

  const launch = async () => {
    if (!valid || launching) return;
    setLaunching(true);
    setError(null);
    try {
      await launchAgent(draft, user?.email ?? "");
      launched.current = true;
      clearDraft();
      // App.tsx swaps to the dashboard via its realtime listener on settings/main.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLaunching(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg text-text flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-bg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-muted tabular-nums">Step {step} of {TOTAL_STEPS}</span>
            {user && user.uid !== "local-dev" && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-[13px] text-muted hover:text-text cursor-pointer"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
        <Progress step={step} />
      </header>

      <form onSubmit={submit} className="flex flex-1 flex-col" noValidate>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-10 pb-12 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
          <p className="mt-1 text-muted text-sm">{meta.subtitle}</p>
          <div className="mt-8">
            {step === 1 && <StepResumeProfile draft={draft} set={set} />}
            {step === 2 && <StepConfirmProfile draft={draft} set={set} />}
            {step === 3 && <StepTargeting draft={draft} set={set} />}
            {step === 4 && <StepMatchQuestions draft={draft} set={set} />}
          </div>
          {error && (
            <div className="mt-6 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
              Couldn't finish setup: {error}
            </div>
          )}
        </main>

        <footer className="sticky bottom-0 z-10 border-t border-border bg-bg">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={step === 1 || launching}
              icon={<ArrowLeft className="size-4" />}
              className={cx(step === 1 && "invisible")}
            >
              Back
            </Button>
            <Button
              type={isLast ? "button" : "submit"}
              onClick={isLast ? () => void launch() : undefined}
              variant="primary"
              disabled={!valid}
              loading={launching}
              className={cx(isLast && "h-10 px-5")}
            >
              {isLast ? (
                launching ? (
                  "Launching & Applying…"
                ) : (
                  <>
                    Launch Agent & Auto-Apply (First 10 Jobs) <Rocket className="size-4" />
                  </>
                )
              ) : (
                <>
                  Continue <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="mx-auto flex max-w-5xl gap-1 px-4 pb-2.5 sm:px-6" aria-hidden>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span
          key={i}
          className={cx("h-1 flex-1 rounded-full transition-colors", i < step ? "bg-accent" : "bg-border")}
        />
      ))}
    </div>
  );
}
