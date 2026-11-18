import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Loader2, Lock } from "lucide-react";
import { countryName, focusFromRoles, recommendSites, type ApplySupport, type JobSite } from "@shared/sites";
import { Badge, Switch, cx } from "@/components/ui";
import type { Draft } from "../draft";
import type { StepProps } from "../bits";
import { ConnectAccounts } from "./ConnectAccounts";

export function sitesInput(d: Draft) {
  return { countries: d.countries, remote: d.workModes.includes("remote"), focus: focusFromRoles(d.roles) };
}
export const sitesKeyOf = (d: Draft) => JSON.stringify(sitesInput(d));
export const defaultEnabled = (sites: JobSite[]) => sites.filter((s) => s.apply !== "monitor").map((s) => s.id);

const SECTIONS: { apply: ApplySupport; title: string; blurb: string }[] = [
  { apply: "auto", title: "Applies for you automatically", blurb: "The agent fills in and submits applications on these sites." },
  { apply: "assisted", title: "Finds jobs and applies when possible", blurb: "Applies when the posting leads to a supported company form; otherwise queues the job for you." },
  { apply: "monitor", title: "Alerts only", blurb: "The agent tells you about matching jobs — you apply yourself." },
];

export function StepSites({ draft, set, onSearching }: StepProps & { onSearching: (v: boolean) => void }) {
  const [searching, setSearching] = useState(true);
  const sites = useMemo(() => recommendSites(sitesInput(draft)), [draft]);
  const key = sitesKeyOf(draft);

  // Reset the selection when the inputs it was based on changed.
  useEffect(() => {
    if (draft.sitesKey !== key || draft.enabledSites === null) set({ sitesKey: key, enabledSites: defaultEnabled(sites) });
  }, [key]);

  useEffect(() => {
    onSearching(true);
    const t = setTimeout(() => {
      setSearching(false);
      onSearching(false);
    }, 1200);
    return () => {
      clearTimeout(t);
      onSearching(false);
    };
  }, [onSearching]);

  if (searching) return <Searching draft={draft} />;

  const enabled = draft.enabledSites ?? [];
  const toggle = (id: string, on: boolean) => set({ enabledSites: on ? [...enabled, id] : enabled.filter((x) => x !== id) });
  const loginSites = sites.filter((s) => s.needsLogin && enabled.includes(s.id));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm">
        <span className="grid size-5 place-items-center rounded-full bg-accent-soft text-accent-strong"><Check className="size-3" /></span>
        <span><span className="font-medium">{enabled.length} sites selected</span> <span className="text-muted">of {sites.length} recommended</span></span>
      </div>

      {SECTIONS.map((sec) => {
        const list = sites.filter((s) => s.apply === sec.apply);
        if (!list.length) return null;
        return (
          <section key={sec.apply}>
            <h3 className="text-[15px] font-semibold">{sec.title}</h3>
            <p className="text-[13px] text-muted mt-0.5 mb-3">{sec.blurb}</p>
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {list.map((s) => <SiteRow key={s.id} site={s} on={enabled.includes(s.id)} onChange={(v) => toggle(s.id, v)} />)}
            </div>
          </section>
        );
      })}

      <ConnectAccounts sites={loginSites} />
    </div>
  );
}

function regionLabel(r: string) {
  if (r === "REMOTE") return "Remote";
  if (r === "GLOBAL") return "Global";
  return countryName(r);
}

function SiteRow({ site, on, onChange }: { site: JobSite; on: boolean; onChange: (v: boolean) => void }) {
  const regions = site.regions.length > 4 ? [...site.regions.slice(0, 3).map(regionLabel), `+${site.regions.length - 3} more`] : site.regions.map(regionLabel);
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{site.name}</span>
          <a href={site.url} target="_blank" rel="noreferrer" className="text-faint hover:text-text" aria-label={`Open ${site.name}`}>
            <ExternalLink className="size-3.5" />
          </a>
          {site.needsLogin && <Badge className="gap-1"><Lock className="size-3" />Needs your login</Badge>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {regions.map((r) => (
            <span key={r} className="rounded border border-border px-1.5 py-px text-[11px] text-muted">{r}</span>
          ))}
        </div>
        {site.note && <p className="mt-1.5 text-xs text-faint">{site.note}</p>}
      </div>
      <div className="pt-0.5"><Switch checked={on} onChange={onChange} /></div>
    </div>
  );
}

function Searching({ draft }: { draft: Draft }) {
  const remote = draft.workModes.includes("remote");
  const where = draft.countries.map(countryName);
  const placeLabel = [where.length ? where.join(", ") : null, remote ? "remote" : null].filter(Boolean).join(" + ") || "you";
  const focus = focusFromRoles(draft.roles);
  const lines = [
    "Checking global job boards",
    where.length ? `Looking for boards in ${where.join(", ")}` : null,
    remote ? "Adding remote-first boards" : null,
    focus.length ? `Matching niche boards for ${focus.join(" & ")}` : "Matching boards to your roles",
  ].filter((l): l is string => Boolean(l));

  const [shown, setShown] = useState(1);
  useEffect(() => {
    const step = 1000 / lines.length;
    const timers = lines.map((_, i) => setTimeout(() => setShown(i + 1), i * step));
    return () => timers.forEach(clearTimeout);
  }, [lines.length]);

  return (
    <div className="flex flex-col items-center py-14 text-center">
      <Loader2 className="size-6 animate-spin text-accent-strong" />
      <div className="mt-4 text-[15px] font-medium">Finding job sites for {placeLabel}…</div>
      <ul className="mt-5 space-y-2 text-left">
        {lines.map((l, i) => (
          <li key={l} className={cx("flex items-center gap-2 text-[13px] text-muted transition-opacity duration-300", i < shown ? "opacity-100" : "opacity-0")}>
            <Check className="size-3.5 text-accent-strong" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
