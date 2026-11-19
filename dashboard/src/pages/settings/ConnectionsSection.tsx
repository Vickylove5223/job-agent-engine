import { useEffect, useState } from "react";
import { ExternalLink, Info, X } from "lucide-react";
import type { Settings, SiteConnection } from "@shared/types";
import { JOB_SITES, type JobSite } from "@shared/sites";
import { Badge, Button, type Tone } from "@/components/ui";
import { setDocument, useCollection } from "@/lib/db";
import { finishSiteLogin, startSiteLogin } from "@/lib/connect";
import { getIdToken } from "@/lib/firebase";
import { timeAgo } from "@/lib/format";
import { SettingsSection } from "./SettingsSection";

const STATUS: Record<SiteConnection["status"], { label: string; tone: Tone }> = {
  connected: { label: "Connected", tone: "green" },
  not_connected: { label: "Not connected", tone: "neutral" },
  expired: { label: "Expired", tone: "red" },
  pending: { label: "Pending", tone: "amber" },
};

async function requireToken() {
  const token = await getIdToken();
  if (!token) throw new Error("Sign in to the dashboard to connect accounts.");
  return token;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

interface LoginSession {
  site: JobSite;
  sessionId: string;
  liveViewUrl: string;
  contextId?: string;
}

function LoginModal({ session, onClose }: { session: LoginSession; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowForce, setAllowForce] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  const finish = async (force = false) => {
    setBusy(true);
    setError(null);
    try {
      await finishSiteLogin(session.site.id, session.sessionId, await requireToken(), force, session.contextId);
      onClose();
    } catch (e) {
      setError(errMsg(e));
      setAllowForce(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Sign in to ${session.site.name}`}>
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className="relative flex h-full max-h-[52rem] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-surface">
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-[15px] font-semibold truncate">Sign in to {session.site.name}</h2>
              <a
                href={session.liveViewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent-strong hover:underline font-medium"
              >
                Open in new tab <ExternalLink className="size-3" />
              </a>
            </div>
            <p className="text-xs text-muted mt-0.5">Sign in directly on the site below. Your password goes to {session.site.name} only and is never stored.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1 rounded text-muted hover:text-text hover:bg-surface-2 cursor-pointer" aria-label="Close">
            <X className="size-5" />
          </button>
        </header>
        <iframe
          src={session.liveViewUrl}
          title={`${session.site.name} sign-in`}
          className="min-h-0 flex-1 w-full bg-surface-2 border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox"
          allow="clipboard-read; clipboard-write; fullscreen"
          allowFullScreen
        />
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3 sm:px-5">
          <span className="text-[13px] text-danger min-h-5 max-w-lg">{error}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            {allowForce && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => finish(true)}>
                Connect anyway
              </Button>
            )}
            <Button size="sm" variant="primary" loading={busy} onClick={() => finish(false)}>I've signed in</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function ConnectionsSection({ settings }: { settings: Settings }) {
  const { data: connections, loading } = useCollection("connections");
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [session, setSession] = useState<LoginSession | null>(null);

  const sites = JOB_SITES.filter((x) => x.needsLogin && settings.enabledSites.includes(x.id));
  const byId = new Map(connections.map((c) => [c.id, c]));

  const run = async (site: JobSite, fn: () => Promise<void>) => {
    setBusy(site.id);
    setErrors(({ [site.id]: _, ...rest }) => rest);
    try {
      await fn();
    } catch (e) {
      setErrors((m) => ({ ...m, [site.id]: errMsg(e) }));
    } finally {
      setBusy(null);
    }
  };

  const connect = (site: JobSite) =>
    run(site, async () => {
      const r = await startSiteLogin(site.id, await requireToken());
      setSession({ site, sessionId: r.sessionId, liveViewUrl: r.liveViewUrl, contextId: r.contextId });
    });

  const disconnect = (site: JobSite) => {
    if (!window.confirm(`Disconnect ${site.name}? The agent will stop using this account until you reconnect.`)) return;
    run(site, () => setDocument("connections", site.id, { status: "not_connected" }));
  };

  return (
    <SettingsSection
      title="Connected accounts"
      meta={sites.length ? `${sites.filter((x) => byId.get(x.id)?.status === "connected").length} of ${sites.length} connected` : undefined}
      description="Job sites that need a login to search or apply. You sign in once in a secure hosted browser; the agent reuses that session."
      hideFooter
    >
      <div className="mb-4 flex items-start gap-2 rounded-md bg-accent-soft px-4 py-3 text-sm text-text">
        <Info className="mt-0.5 size-4 shrink-0 text-accent-strong" />
        <span>You sign in directly on each site inside our secure hosted browser. Your password is never seen or stored on our servers.</span>
      </div>

      {sites.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
          None of your active job sites need a login.
        </div>
      ) : (
        <ul className="rounded-lg border border-border divide-y divide-border">
          {sites.map((site) => {
            const c = byId.get(site.id);
            const status = c?.status ?? "not_connected";
            const st = STATUS[status];
            const linked = status === "connected" || status === "expired";
            return (
              <li key={site.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={site.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                      {site.name}
                      <ExternalLink className="size-3 text-faint" />
                    </a>
                    {loading ? <span className="text-xs text-faint">…</span> : <Badge tone={st.tone} dot>{st.label}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {status === "connected"
                      ? `Connected ${timeAgo(c?.connectedAt)}`
                      : status === "expired"
                        ? "The session expired. Reconnect so the agent can keep using this site."
                        : status === "pending"
                          ? "Waiting for sign-in to finish."
                          : "Not connected yet."}
                  </p>
                  {(errors[site.id] || c?.error) && <p className="mt-0.5 text-xs text-danger">{errors[site.id] ?? c?.error}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {status === "connected" && (
                    <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => disconnect(site)}>
                      Disconnect
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={status === "connected" ? "secondary" : "primary"}
                    disabled={busy !== null && busy !== site.id}
                    loading={busy === site.id}
                    onClick={() => connect(site)}
                  >
                    {linked ? "Reconnect" : "Connect"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {session && <LoginModal session={session} onClose={() => setSession(null)} />}
    </SettingsSection>
  );
}
