import type { Application, Job, Outcome, Site, WithId } from "@shared/types";

export type AppRow = WithId<Application> & { job?: WithId<Job> };

export const OUTCOMES: Outcome[] = ["submitted", "interview", "offer", "rejected", "ghosted"];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  submitted: "Submitted",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
};

export const SITES: Site[] = ["linkedin", "indeed", "ats"];
export const SITE_LABEL: Record<Site, string> = { linkedin: "LinkedIn", indeed: "Indeed", ats: "Company ATS" };

/** An application counts as a "response" once the employer did something. */
export const isResponse = (o: Outcome) => o === "interview" || o === "offer" || o === "rejected";

export function responseRate(rows: { outcome: Outcome }[]): number | null {
  if (!rows.length) return null;
  return Math.round((rows.filter((r) => isResponse(r.outcome)).length / rows.length) * 100);
}
