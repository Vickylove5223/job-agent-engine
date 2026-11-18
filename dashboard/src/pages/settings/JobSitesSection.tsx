import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Plus, Trash2 } from "lucide-react";
import type { Settings } from "@shared/types";
import { APPLY_LABEL, JOB_SITES, countryName, focusFromRoles, recommendSites, type ApplySupport, type JobSite } from "@shared/sites";
import { Badge, Button, Input, Select, Switch, cx } from "@/components/ui";
import { SettingsSection, useSection } from "./SettingsSection";
import type { WhereDraft } from "./WhereSection";

type Ats = Settings["targetCompanies"][number]["ats"];
type Target = Settings["targetCompanies"][number];

const APPLY_ORDER: ApplySupport[] = ["auto", "assisted", "monitor"];
const APPLY_DESC: Record<ApplySupport, string> = {
  auto: "The agent submits applications for you",
  assisted: "The agent finds jobs and applies when the posting uses a supported company form; otherwise it queues the job for you",
  monitor: "You get alerts and apply yourself",
};
const KIND_HINT: Record<JobSite["kind"], string> = {
  api: "Scanned every 30 min",
  browser: "Searched in the hosted browser",
};

const regionLabel = (r: string) => (r === "REMOTE" ? "Remote" : r === "GLOBAL" ? "Global" : countryName(r));

function RegionChips({ regions, countries }: { regions: string[]; countries: string[] }) {
  // the user's own countries first, then the rest; long lists collapse into "+N"
  const sorted = [...regions].sort((a, b) => Number(countries.includes(b)) - Number(countries.includes(a)));
  const shown = sorted.length > 4 ? sorted.slice(0, 3) : sorted;
  const rest = sorted.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((r) => (
        <span key={r} className="rounded border border-border bg-surface-2 px-1.5 py-px text-[11px] text-muted">{regionLabel(r)}</span>
      ))}
      {rest > 0 && (
        <span className="rounded border border-border bg-surface-2 px-1.5 py-px text-[11px] text-muted" title={sorted.slice(3).map(regionLabel).join(", ")}>
          +{rest}
        </span>
      )}
    </span>
  );
}

function SiteRow({ site, on, isNew, countries, onToggle }: { site: JobSite; on: boolean; isNew: boolean; countries: string[]; onToggle: (v: boolean) => void }) {
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <a href={site.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
            {site.name}
            <ExternalLink className="size-3 text-faint" />
          </a>
          {site.needsLogin && <Badge tone="amber">Needs login</Badge>}
          {isNew && <Badge tone="blue">New</Badge>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <RegionChips regions={site.regions} countries={countries} />
          <span className="text-xs text-faint">{KIND_HINT[site.kind]}</span>
        </div>
        {site.note && <p className="mt-1 text-xs text-muted">{site.note}</p>}
      </div>
      <div className="pt-0.5 shrink-0">
        <Switch checked={on} onChange={onToggle} />
      </div>
    </li>
  );
}

// ---------- target companies (Greenhouse / Lever / Ashby boards) ----------
const boardUrl = (ats: Ats, slug: string) => {
  const s = encodeURIComponent(slug.trim());
  if (ats === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`;
  if (ats === "lever") return `https://api.lever.co/v0/postings/${s}?mode=json`;
  return `https://api.ashbyhq.com/posting-api/job-board/${s}`;
};

type TestResult = { state: "loading" } | { state: "ok"; count: number } | { state: "error"; message: string };

async function testBoard(ats: Ats, slug: string): Promise<TestResult> {
  let res: Response;
  try {
    res = await fetch(boardUrl(ats, slug));
  } catch {
    return { state: "error", message: "Could not reach from browser — the scanner will still try." };
  }
  if (res.status === 404) return { state: "error", message: "Board not found — check the slug." };
  if (!res.ok) return { state: "error", message: `Board returned HTTP ${res.status}.` };
  try {
    const body = (await res.json()) as unknown;
    const list = Array.isArray(body) ? body : (body as { jobs?: unknown[] })?.jobs;
    if (!Array.isArray(list)) return { state: "error", message: "Unexpected response from the board API." };
    return { state: "ok", count: list.length };
  } catch {
    return { state: "error", message: "Unexpected response from the board API." };
  }
}

function TestStatus({ r }: { r?: TestResult }) {
  if (!r || r.state === "loading") return null;
  return (
    <span className={cx("text-xs", r.state === "ok" ? "text-accent-strong" : "text-danger")}>
      {r.state === "ok" ? `${r.count} open job${r.count === 1 ? "" : "s"}` : r.message}
    </span>
  );
}

function TargetCompanies({ value, onChange }: { value: Target[]; onChange: (fn: (t: Target[]) => Target[]) => void }) {
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const setRow = (i: number, patch: Partial<Target>) => onChange((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const runTest = async (t: Target) => {
    const key = `${t.ats}:${t.slug.trim()}`;
    setTests((m) => ({ ...m, [key]: { state: "loading" } }));
    const r = await testBoard(t.ats, t.slug);
    setTests((m) => ({ ...m, [key]: r }));
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold">Target companies</div>
          <p className="text-xs text-muted mt-0.5">
            Company job boards on Greenhouse, Lever or Ashby. The slug is the part of the board URL after the domain, e.g. <code className="text-text">vercel</code>.
          </p>
        </div>
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => onChange((ts) => [...ts, { ats: "greenhouse", slug: "", name: "" }])}>Add</Button>
      </div>

      {value.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">No target companies yet.</div>
      ) : (
        <div className="mt-3 rounded-lg border border-border">
          <div className="hidden sm:grid grid-cols-[8rem_1fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-border text-[13px] font-semibold">
            <span>ATS</span><span>Slug</span><span>Name</span><span className="w-28" />
          </div>
          <ul className="divide-y divide-border">
            {value.map((t, i) => {
              const r = tests[`${t.ats}:${t.slug.trim()}`];
              return (
                <li key={i} className="px-4 py-3">
                  <div className="grid grid-cols-2 sm:grid-cols-[8rem_1fr_1fr_auto] gap-3 items-center">
                    <Select value={t.ats} aria-label="ATS" onChange={(e) => setRow(i, { ats: e.target.value as Ats })}>
                      <option value="greenhouse">Greenhouse</option>
                      <option value="lever">Lever</option>
                      <option value="ashby">Ashby</option>
                    </Select>
                    <Input value={t.slug} aria-label="Slug" placeholder="slug" onChange={(e) => setRow(i, { slug: e.target.value })} />
                    <Input value={t.name} aria-label="Company name" placeholder="Company name" onChange={(e) => setRow(i, { name: e.target.value })} />
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" disabled={!t.slug.trim()} loading={r?.state === "loading"} onClick={() => runTest(t)}>Test</Button>
                      <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => onChange((ts) => ts.filter((_, j) => j !== i))} icon={<Trash2 className="size-4" />} />
                    </div>
                  </div>
                  {r && r.state !== "loading" && <div className="mt-1.5"><TestStatus r={r} /></div>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

// ---------- section ----------
export interface SiteRequest {
  ids: string[];
  nonce: number;
}

export function JobSitesSection({ settings, where, request }: { settings: Settings; where: WhereDraft; request: SiteRequest | null }) {
  const s = useSection(
    { enabledSites: settings.enabledSites, targetCompanies: settings.targetCompanies },
    (d) => ({ enabledSites: d.enabledSites, targetCompanies: d.targetCompanies.map((t) => ({ ...t, slug: t.slug.trim(), name: t.name.trim() })) }),
  );
  const { enabledSites, targetCompanies } = s.draft;
  const [showOther, setShowOther] = useState(false);

  // "Review sites" from the locations section pre-enables the new sites as a draft.
  const nonce = request?.nonce;
  useEffect(() => {
    if (!request) return;
    s.setDraft((d) => ({ ...d, enabledSites: [...new Set([...d.enabledSites, ...request.ids])] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const recommended = useMemo(
    () => recommendSites({ countries: where.countries, remote: where.workModes.includes("remote"), focus: focusFromRoles(settings.roles) }),
    [where, settings.roles],
  );
  const recIds = new Set(recommended.map((x) => x.id));
  const others = JOB_SITES.filter((x) => !recIds.has(x.id));
  const enabledSet = new Set(enabledSites);
  const savedSet = new Set(settings.enabledSites);
  const activeCount = JOB_SITES.filter((x) => enabledSet.has(x.id)).length;
  const otherOn = others.filter((x) => enabledSet.has(x.id)).length;
  const recOff = recommended.filter((x) => !enabledSet.has(x.id));

  const toggle = (id: string, v: boolean) =>
    s.setDraft((d) => ({ ...d, enabledSites: v ? [...new Set([...d.enabledSites, id])] : d.enabledSites.filter((x) => x !== id) }));

  const row = (site: JobSite) => (
    <SiteRow
      key={site.id}
      site={site}
      on={enabledSet.has(site.id)}
      isNew={enabledSet.has(site.id) && !savedSet.has(site.id) && !!request?.ids.includes(site.id)}
      countries={where.countries}
      onToggle={(v) => toggle(site.id, v)}
    />
  );

  const invalid =
    activeCount === 0 && targetCompanies.length === 0 ? "Turn on at least one job site."
    : targetCompanies.some((t) => !t.slug.trim()) ? "Every target company needs a board slug."
    : null;

  return (
    <SettingsSection
      id="job-sites"
      title="Job sites"
      meta={`${activeCount} of ${JOB_SITES.length} sites active`}
      description="Where the agent looks for jobs. Recommendations follow your countries, work modes and roles."
      dirty={s.dirty}
      status={s.status}
      error={s.error}
      invalid={invalid}
      onSave={s.save}
      onReset={s.reset}
    >
      {recOff.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted">{recOff.length} recommended site{recOff.length === 1 ? " is" : "s are"} off.</span>
          <Button
            size="sm"
            variant="ghost"
            className="self-start sm:self-auto"
            onClick={() => s.setDraft((d) => ({ ...d, enabledSites: [...new Set([...d.enabledSites, ...recOff.map((x) => x.id)])] }))}
          >
            Turn all on
          </Button>
        </div>
      )}

      <div className="space-y-5">
        {APPLY_ORDER.map((level) => {
          const group = recommended.filter((x) => x.apply === level);
          if (!group.length) return null;
          return (
            <div key={level}>
              <div className="mb-2">
                <div className="text-[13px] font-semibold">{APPLY_LABEL[level]}</div>
                <p className="text-xs text-muted mt-0.5">{APPLY_DESC[level]}.</p>
              </div>
              <ul className="rounded-lg border border-border divide-y divide-border">{group.map(row)}</ul>
            </div>
          );
        })}
      </div>

      {others.length > 0 && (
        <div className="mt-5 rounded-lg border border-border">
          <button
            type="button"
            aria-expanded={showOther}
            onClick={() => setShowOther((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-surface-2 rounded-lg"
          >
            <span>
              <span className="text-sm font-medium">Other sites</span>
              <span className="ml-2 text-xs text-muted">
                {others.length} more{otherOn ? ` · ${otherOn} on` : ""}
              </span>
            </span>
            <ChevronDown className={cx("size-4 text-muted transition-transform", showOther && "rotate-180")} />
          </button>
          {showOther && (
            <>
              <p className="border-t border-border px-4 py-2 text-xs text-muted">Not matched to your locations, but you can add any of them.</p>
              <ul className="border-t border-border divide-y divide-border">{others.map(row)}</ul>
            </>
          )}
        </div>
      )}

      <div className="mt-8">
        <TargetCompanies value={targetCompanies} onChange={(fn) => s.setDraft((d) => ({ ...d, targetCompanies: fn(d.targetCompanies) }))} />
      </div>
    </SettingsSection>
  );
}
