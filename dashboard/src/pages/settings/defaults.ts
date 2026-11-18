import type { Settings, WorkMode } from "@shared/types";
import { JOB_SITES, focusFromRoles, recommendSites } from "@shared/sites";

/** Fallbacks so a partially-filled settings doc never crashes a section. */
export const DEFAULT_SETTINGS: Settings = {
  paused: true,
  roles: [],
  includeKeywords: [],
  excludeKeywords: [],
  countries: [],
  locations: [],
  workModes: ["remote"],
  jobTypes: ["full_time"],
  enabledSites: [],
  remoteOnly: true,
  minSalary: null,
  currency: "USD",
  seniority: [],
  blockedCompanies: [],
  thresholds: { apply: 80, tailor: 60 },
  dailyCaps: { linkedin: 15, indeed: 15, ats: 30 },
  pacingMinutes: { min: 4, max: 15 },
  targetCompanies: [],
  coverLetter: { mode: "when_required", tone: "professional" },
};

const ALL_MODES: WorkMode[] = ["remote", "hybrid", "onsite"];
const SITE_IDS = new Set(JOB_SITES.map((s) => s.id));

/** remoteOnly is kept for older consumers: true iff the user wants remote work only. */
export const isRemoteOnly = (modes: WorkMode[]) => modes.length === 1 && modes[0] === "remote";

export function normalizeSettings(raw: Partial<Settings>): Settings {
  const d = DEFAULT_SETTINGS;
  // `sources` is deprecated: only read it to migrate older docs to enabledSites.
  const { sources: legacySources, ...s } = raw;

  const roles = s.roles ?? [];
  const countries = s.countries ?? [];
  const workModes: WorkMode[] = s.workModes?.length ? s.workModes : s.remoteOnly === false ? ALL_MODES : ["remote"];

  let enabledSites = s.enabledSites;
  if (!enabledSites) {
    const legacy = Object.entries(legacySources ?? {})
      .filter(([id, on]) => on && SITE_IDS.has(id))
      .map(([id]) => id);
    enabledSites = legacy.length
      ? legacy
      : recommendSites({ countries, remote: workModes.includes("remote"), focus: focusFromRoles(roles) }).map((x) => x.id);
  }

  return {
    ...d,
    ...s,
    thresholds: { ...d.thresholds, ...s.thresholds },
    dailyCaps: { ...d.dailyCaps, ...s.dailyCaps },
    pacingMinutes: { ...d.pacingMinutes, ...s.pacingMinutes },
    coverLetter: { ...d.coverLetter, ...s.coverLetter },
    roles,
    includeKeywords: s.includeKeywords ?? [],
    excludeKeywords: s.excludeKeywords ?? [],
    countries,
    locations: s.locations ?? [],
    workModes,
    jobTypes: s.jobTypes ?? d.jobTypes,
    enabledSites,
    remoteOnly: isRemoteOnly(workModes),
    seniority: s.seniority ?? [],
    blockedCompanies: s.blockedCompanies ?? [],
    targetCompanies: s.targetCompanies ?? [],
  };
}
