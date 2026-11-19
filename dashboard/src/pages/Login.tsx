import { useState } from "react";
import { signIn, signUp, resetPassword } from "@/lib/firebase";
import { Logo } from "@/components/AppShell";
import { Button, Field, Input } from "@/components/ui";

const messages: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
};

export function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        localStorage.removeItem("onboarding-draft");
        await signUp(email, password);
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setMsg({ tone: "error", text: messages[code] ?? (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full grid place-items-center bg-bg-subtle px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo /></div>
        <div className="rounded-lg border border-border bg-surface p-6">
          <h1 className="text-xl font-semibold">{mode === "signin" ? "Sign in" : "Create your account"}</h1>
          <p className="text-sm text-muted mt-1">{mode === "signin" ? "Welcome back to your job agent." : "This dashboard is private to you."}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Password"><Input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            {msg && <p className={msg.tone === "error" ? "text-sm text-danger" : "text-sm text-accent-strong"}>{msg.text}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={busy}>{mode === "signin" ? "Sign in" : "Create account"}</Button>
          </form>
          <div className="mt-5 flex items-center justify-between text-sm">
            <button className="text-muted hover:text-text underline-offset-4 hover:underline cursor-pointer" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}>
              {mode === "signin" ? "Create account" : "I have an account"}
            </button>
            {mode === "signin" && (
              <button
                className="text-muted hover:text-text underline-offset-4 hover:underline cursor-pointer"
                onClick={async () => {
                  if (!email) return setMsg({ tone: "error", text: "Enter your email first." });
                  await resetPassword(email).catch(() => {});
                  setMsg({ tone: "ok", text: "If that account exists, a reset link is on its way." });
                }}
              >
                Forgot password?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
