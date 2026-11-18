// Read-only rendering of a parsed (structured) resume.
import type { ReactNode } from "react";
import type { Resume } from "@shared/types";
import { Badge } from "@/components/ui";

/** "backendFrameworks" / "cloud_tools" → "Backend frameworks" / "Cloud tools". */
export function humanize(key: string): string {
  const s = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-5 mt-5 first:border-t-0 first:pt-0 first:mt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-faint mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[13px]">{children}</span>;
}

function dates(start?: string, end?: string) {
  if (!start && !end) return "";
  return [start, end].filter(Boolean).join(" – ");
}

export function ResumeView({ resume, headline, name }: { resume: Resume; headline?: string; name?: string }) {
  const skills = Object.entries(resume.skills ?? {}).filter(([, v]) => v?.length);
  const experience = resume.experience ?? [];
  const education = resume.education ?? [];
  const certs = resume.certifications ?? [];
  const projects = resume.projects ?? [];
  const awards = resume.awards ?? [];
  const languages = resume.languages ?? [];
  const interests = resume.interests ?? [];

  return (
    <div>
      {(name || headline || resume.summary) && (
        <Block title="Summary">
          {name && <div className="text-lg font-semibold tracking-tight">{name}</div>}
          {headline && <div className="text-muted">{headline}</div>}
          {resume.summary && <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{resume.summary}</p>}
        </Block>
      )}

      {skills.length > 0 && (
        <Block title="Skills">
          <div className="space-y-3">
            {skills.map(([cat, items]) => (
              <div key={cat} className="grid gap-1.5 sm:grid-cols-[180px_1fr] sm:gap-4">
                <div className="text-[13px] font-medium text-muted pt-0.5">{humanize(cat)}</div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((s) => <Chip key={s}>{s}</Chip>)}
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {experience.length > 0 && (
        <Block title="Experience">
          <ol className="relative ml-1.5 border-l border-border">
            {experience.map((e, i) => (
              <li key={`${e.company}-${e.title}-${i}`} className="relative pl-5 pb-6 last:pb-0">
                <span className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-surface ${i === 0 ? "bg-accent" : "bg-border-strong"}`} />
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="font-medium">
                    {e.title} <span className="text-muted font-normal">— {e.company}</span>
                  </div>
                  <div className="text-xs text-faint whitespace-nowrap tabular-nums">{dates(e.start, e.end)}</div>
                </div>
                {(e.location || e.type) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {e.location && <span>{e.location}</span>}
                    {e.type && <Badge>{e.type}</Badge>}
                  </div>
                )}
                {e.bullets?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm list-disc pl-4 marker:text-faint">
                    {e.bullets.map((b, j) => <li key={j} className="leading-relaxed">{b}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Block>
      )}

      {education.length > 0 && (
        <Block title="Education">
          <div className="space-y-3">
            {education.map((ed, i) => (
              <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <div>
                  <div className="font-medium">{ed.degree}</div>
                  <div className="text-sm text-muted">
                    {ed.school}
                    {ed.country ? `, ${ed.country}` : ""}
                  </div>
                  {ed.thesis && <div className="text-xs text-faint mt-0.5">Thesis: {ed.thesis}</div>}
                </div>
                <div className="text-xs text-faint whitespace-nowrap tabular-nums">{dates(ed.start, ed.end)}</div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {certs.length > 0 && (
        <Block title="Certifications">
          <ul className="space-y-1.5 text-sm">
            {certs.map((c, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4">
                <span>{c.name}</span>
                {c.issued && <span className="text-xs text-faint whitespace-nowrap">{c.issued}</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {projects.length > 0 && (
        <Block title="Projects">
          <ul className="space-y-1 text-sm list-disc pl-4 marker:text-faint">
            {projects.map((p, i) => <li key={i} className="leading-relaxed">{p}</li>)}
          </ul>
        </Block>
      )}

      {awards.length > 0 && (
        <Block title="Awards">
          <ul className="space-y-1 text-sm list-disc pl-4 marker:text-faint">
            {awards.map((a, i) => <li key={i} className="leading-relaxed">{a}</li>)}
          </ul>
        </Block>
      )}

      {(languages.length > 0 || interests.length > 0) && (
        <div className="grid gap-5 sm:grid-cols-2 border-t border-border pt-5 mt-5">
          {languages.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-faint mb-3">Languages</h3>
              <div className="flex flex-wrap gap-1.5">{languages.map((l) => <Chip key={l}>{l}</Chip>)}</div>
            </div>
          )}
          {interests.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-faint mb-3">Interests</h3>
              <div className="flex flex-wrap gap-1.5">{interests.map((l) => <Chip key={l}>{l}</Chip>)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
