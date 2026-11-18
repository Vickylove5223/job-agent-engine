import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { Profile, StandardAnswers, WithId } from "@shared/types";
import { logActivity, updateDocument } from "@/lib/db";
import { Button, Field, Input, Panel } from "@/components/ui";

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  links: { linkedin: string; github: string; portfolio: string };
  standardAnswers: Required<StandardAnswers>;
}

function fromProfile(p: Profile): FormState {
  const sa = p.standardAnswers ?? {};
  return {
    fullName: p.fullName ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    location: p.location ?? "",
    headline: p.headline ?? "",
    links: { linkedin: p.links?.linkedin ?? "", github: p.links?.github ?? "", portfolio: p.links?.portfolio ?? "" },
    standardAnswers: {
      workAuthorization: sa.workAuthorization ?? "",
      needsSponsorship: sa.needsSponsorship ?? "",
      noticePeriod: sa.noticePeriod ?? "",
      salaryExpectation: sa.salaryExpectation ?? "",
      willingToRelocate: sa.willingToRelocate ?? "",
      yearsExperience: sa.yearsExperience ?? "",
    },
  };
}

const STANDARD: { key: keyof StandardAnswers; label: string; placeholder: string; hint: string }[] = [
  { key: "workAuthorization", label: "Work authorization", placeholder: "e.g. Authorized to work in Nigeria; no US work permit", hint: "Where you can legally work without a new visa." },
  { key: "needsSponsorship", label: "Needs visa sponsorship?", placeholder: "e.g. Yes for US/UK roles, No for remote contracts", hint: "Answered on many application forms — be specific per region if it differs." },
  { key: "noticePeriod", label: "Notice period", placeholder: "e.g. 2 weeks", hint: "How soon you could start after accepting an offer." },
  { key: "salaryExpectation", label: "Salary expectation", placeholder: "e.g. $60,000–$75,000 / year", hint: "Used when a form requires a number. Include currency and period." },
  { key: "willingToRelocate", label: "Willing to relocate?", placeholder: "e.g. Yes, to Europe or Canada with support", hint: "Used for on-site roles outside your current city." },
  { key: "yearsExperience", label: "Years of experience", placeholder: "e.g. 4", hint: "Total relevant professional experience." },
];

export function ContactTab({ profile }: { profile: WithId<Profile> }) {
  const [form, setForm] = useState<FormState>(() => fromProfile(profile));
  const [baseline, setBaseline] = useState(() => JSON.stringify(fromProfile(profile)));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = useMemo(() => JSON.stringify(form) !== baseline, [form, baseline]);

  // Pick up remote changes when the user has no unsaved edits.
  const remote = JSON.stringify(fromProfile(profile));
  useEffect(() => {
    if (!dirty && remote !== baseline) {
      setForm(JSON.parse(remote) as FormState);
      setBaseline(remote);
    }
  }, [remote]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };
  const setLink = (k: keyof FormState["links"], v: string) => set("links", { ...form.links, [k]: v });
  const setAnswer = (k: keyof StandardAnswers, v: string) => set("standardAnswers", { ...form.standardAnswers, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      const t = (s: string) => s.trim();
      const next: Partial<Profile> = {
        fullName: t(form.fullName),
        email: t(form.email),
        phone: t(form.phone),
        location: t(form.location),
        headline: t(form.headline),
        links: { linkedin: t(form.links.linkedin), github: t(form.links.github), portfolio: t(form.links.portfolio) },
        standardAnswers: Object.fromEntries(Object.entries(form.standardAnswers).map(([k, v]) => [k, t(v)])) as StandardAnswers,
      };
      await updateDocument("profile", "main", next);
      await logActivity("info", "profile", "Contact details and standard answers updated");
      setBaseline(JSON.stringify(form));
      setSaved(true);
    } catch (e) {
      window.alert(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Panel title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Field>
          <Field label="Phone" hint="Include the country code, e.g. +234…"><Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></Field>
          <Field label="Location" hint="City, country — used for location filters on forms."><Input value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="Headline" hint="One line shown at the top of your resume." className="sm:col-span-2">
            <Input value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="e.g. Full-stack engineer · React, Node, TypeScript" />
          </Field>
        </div>
      </Panel>

      <Panel title="Links">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="LinkedIn"><Input type="url" value={form.links.linkedin} onChange={(e) => setLink("linkedin", e.target.value)} placeholder="https://linkedin.com/in/…" /></Field>
          <Field label="GitHub"><Input type="url" value={form.links.github} onChange={(e) => setLink("github", e.target.value)} placeholder="https://github.com/…" /></Field>
          <Field label="Portfolio"><Input type="url" value={form.links.portfolio} onChange={(e) => setLink("portfolio", e.target.value)} placeholder="https://…" /></Field>
        </div>
      </Panel>

      <Panel title="Standard answers">
        <p className="mb-4 text-sm text-muted">Common application-form questions. The agent fills these in directly instead of asking you each time.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {STANDARD.map((s) => (
            <Field key={s.key} label={s.label} hint={s.hint}>
              <Input value={form.standardAnswers[s.key]} onChange={(e) => setAnswer(s.key, e.target.value)} placeholder={s.placeholder} />
            </Field>
          ))}
        </div>
      </Panel>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-border bg-bg px-1 py-3">
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1.5 text-sm text-accent-strong"><Check className="size-4" /> Saved</span>
        )}
        {dirty && <span className="text-sm text-muted">Unsaved changes</span>}
        {dirty && (
          <Button type="button" variant="ghost" onClick={() => setForm(JSON.parse(baseline) as FormState)} disabled={busy}>Discard</Button>
        )}
        <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>Save changes</Button>
      </div>
    </form>
  );
}
