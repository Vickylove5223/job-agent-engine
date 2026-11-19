import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { Link } from "react-router";
import type { Settings } from "@shared/types";
import { POPULAR_NICHES } from "@shared/outreach";
import { Field, Input, Switch, TagInput } from "@/components/ui";
import { SettingsSection, useSection } from "./SettingsSection";

export function OutreachSection({ settings }: { settings: Settings }) {
  const current = settings.outreachSettings ?? {
    enabled: true,
    niches: ["Loan Companies & Digital Lending", "Fintech & Payments"],
    targetLocations: settings.locations ?? [],
    dailyEmailLimit: 15,
    autoSearchCompanies: true,
  };

  const s = useSection(current, (d) => ({
    outreachSettings: d,
  }));

  const addPresetNiche = (niche: string) => {
    if (!s.draft.niches.includes(niche)) {
      s.setDraft({ ...s.draft, niches: [...s.draft.niches, niche] });
    }
  };

  return (
    <SettingsSection
      title="Company Cold Outreach"
      description="Automatically discover companies in target niches (e.g. loan companies, fintech), enrich HR & recruitment contacts, and send personalized templated cold emails."
      dirty={s.dirty}
      status={s.status}
      error={s.error}
      onSave={s.save}
      onReset={s.reset}
    >
      <div className="space-y-4">
        {/* Active Gmail Sending Integration */}
        <div className="flex items-center justify-between rounded-lg bg-surface-2 border border-border p-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded bg-white shadow-2xs border border-border shrink-0">
              <svg className="size-4" viewBox="0 0 24 24" fill="none">
                <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z" fill="#EA4335" />
              </svg>
            </div>
            <div>
              <span className="font-semibold text-text">Outreach Email Provider: Google Gmail</span>
              <span className="text-muted text-[11px] block">Sending automatically via your linked Gmail account</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
        </div>

        <div className="space-y-3">
          <Switch
            checked={s.draft.enabled}
            onChange={(v) => s.setDraft({ ...s.draft, enabled: v })}
            label="Enable company cold outreach engine"
          />

          <Switch
            checked={s.draft.autoSearchCompanies}
            onChange={(v) => s.setDraft({ ...s.draft, autoSearchCompanies: v })}
            label="Auto-search for new companies in my niches during agent cycle"
            disabled={!s.draft.enabled}
          />
        </div>

        <Field
          label="Target Niches & Industries"
          hint="Companies in these niches will be prioritized (e.g. Loan Companies, Fintech, SaaS)"
        >
          <TagInput
            value={s.draft.niches}
            onChange={(v) => s.setDraft({ ...s.draft, niches: v })}
            placeholder="Add a niche (e.g. Loan Companies, Fintech, Healthtech)"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[11px] text-faint self-center mr-1">Quick add:</span>
            {POPULAR_NICHES.slice(0, 4).map((niche) => (
              <button
                key={niche}
                type="button"
                onClick={() => addPresetNiche(niche)}
                className="text-[11px] rounded bg-surface-2 px-2 py-0.5 border border-border text-muted hover:text-text cursor-pointer"
              >
                + {niche}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Outreach Target Locations"
            hint="Locations where companies operate (defaults to your active search locations)"
          >
            <TagInput
              value={s.draft.targetLocations?.length ? s.draft.targetLocations : settings.locations}
              onChange={(v) => s.setDraft({ ...s.draft, targetLocations: v })}
              placeholder="Add location (e.g. London, Lagos, Remote)"
            />
          </Field>

          <Field
            label="Daily Email Limit (Anti-Spam Safety)"
            hint="Paces daily emails to protect your email sender reputation"
          >
            <Input
              type="number"
              min={1}
              max={50}
              value={s.draft.dailyEmailLimit}
              onChange={(e) => s.setDraft({ ...s.draft, dailyEmailLimit: Number(e.target.value) || 15 })}
            />
          </Field>
        </div>

        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-accent-strong" />
            Manage companies list, enrich HR/executives, and compose cold emails:
          </span>
          <Link
            to="/outreach"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-strong hover:underline"
          >
            <Mail className="size-3.5" />
            Go to Cold Outreach Console
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </SettingsSection>
  );
}
