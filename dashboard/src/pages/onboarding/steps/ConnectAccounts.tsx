import { useState } from "react";
import { Check, Clock, ExternalLink, ShieldCheck, X } from "lucide-react";
import type { JobSite } from "@shared/sites";
import { Badge, Button } from "@/components/ui";
import { canConnectSites, finishSiteLogin, startSiteLogin } from "@/lib/connect";
import { getIdToken } from "@/lib/firebase";

interface Session {
  site: JobSite;
  sessionId: string;
  liveViewUrl: string;
  contextId?: string;
}

/** Sign-in panel for selected sites that need the user's own account. */
export function ConnectAccounts({ sites }: { sites: JobSite[] }) {
  const [connected, setConnected] = useState<string[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!sites.length) return null;

  const start = async (site: JobSite) => {
    setError(null);
    setStarting(site.id);
    try {
      const res = await startSiteLogin(site.id, (await getIdToken()) ?? "");
      setSession({ site, ...res });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(null);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="px-4 py-3.5 border-b border-border">
        <h3 className="text-[15px] font-semibold">Connect accounts</h3>
        <p className="text-[13px] text-muted mt-0.5">These sites need you to be signed in so the agent can search and apply as you.</p>
      </header>

      {!canConnectSites && (
        <div className="flex items-start gap-2.5 border-b border-border bg-bg-subtle px-4 py-3 text-[13px] text-muted">
          <Clock className="size-4 shrink-0 mt-px" />
          You can connect accounts later in Settings once the agent service is live. Your site choices are saved either way.
        </div>
      )}

      <ul className="divide-y divide-border">
        {sites.map((s) => {
          const done = connected.includes(s.id);
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-medium truncate">{s.name}</span>
              {done ? (
                <Badge tone="green"><Check className="size-3" />Connected</Badge>
              ) : (
                <Button type="button" size="sm" loading={starting === s.id} onClick={() => start(s)}>
                  Connect
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {error && <div className="px-4 pb-3 text-xs text-danger">{error}</div>}

      <footer className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted">
        <ShieldCheck className="size-4 shrink-0 text-accent-strong" />
        We never see or store your passwords — you sign in directly on the site.
      </footer>

      {session && (
        <LiveViewModal
          session={session}
          onClose={() => setSession(null)}
          onDone={() => {
            setConnected((c) => [...c, session.site.id]);
            setSession(null);
          }}
        />
      )}
    </section>
  );
}

function LiveViewModal({ session, onClose, onDone }: { session: Session; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowForce, setAllowForce] = useState(false);

  const finish = async (force = false) => {
    setBusy(true);
    setError(null);
    try {
      await finishSiteLogin(session.site.id, session.sessionId, (await getIdToken()) ?? "", force, session.contextId);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAllowForce(true);
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-5xl flex-col bg-bg sm:h-[85vh] sm:rounded-lg sm:border sm:border-border">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold truncate">Sign in to {session.site.name}</div>
              <a
                href={session.liveViewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent-strong hover:underline font-medium"
              >
                Open in new tab <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="text-xs text-muted">Secure remote browser (ad-blocking active). Sign in as you normally would.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text cursor-pointer" aria-label="Close">
            <X className="size-5" />
          </button>
        </header>
        <iframe
          src={session.liveViewUrl}
          title={`${session.site.name} sign-in`}
          allow="fullscreen; clipboard-read; clipboard-write"
          allowFullScreen
          className="flex-1 w-full bg-surface border-0"
        />
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          {error && <span className="mr-auto text-xs text-danger max-w-md">{error}</span>}
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          {allowForce && (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => finish(true)}>
              Connect anyway
            </Button>
          )}
          <Button type="button" variant="primary" loading={busy} onClick={() => finish(false)}>I've signed in</Button>
        </footer>
      </div>
    </div>
  );
}
