import { ShieldCheck, ArrowRight, Building2 } from "lucide-react";
import { Link } from "react-router";
import type { Settings } from "@shared/types";
import { Field, Switch, TagInput } from "@/components/ui";
import { SettingsSection, useSection } from "./SettingsSection";

export function AgencySection({ settings }: { settings: Settings }) {
  const current = settings.agencySettings ?? {
    enabled: true,
    autoSubmit: true,
    skipPaidAgencies: true,
    targetLocations: settings.locations ?? [],
    targetRoles: settings.roles ?? [],
  };

  const s = useSection(current, (d) => ({
    agencySettings: {
      ...d,
      skipPaidAgencies: true, // Always enforce fee protection
    },
  }));

  return (
    <SettingsSection
      title="Recruitment agencies"
      description="Automatically discover recruitment and staffing agencies in the locations you are applying for, and submit your details to them. Paid candidate services are strictly skipped."
      dirty={s.dirty}
      status={s.status}
      error={s.error}
      onSave={s.save}
      onReset={s.reset}
    >
      <div className="space-y-4">
        {/* Enforced safeguard callout */}
        <div className="flex items-center gap-2.5 rounded-md border border-accent/40 bg-accent-soft/30 p-3 text-xs text-text">
          <ShieldCheck className="size-4 text-accent-strong shrink-0" />
          <span>
            <strong>Zero Candidate Fee Guarantee:</strong> Employment agencies in target markets (UK, US, EU, etc.) are funded by employers. Any agency demanding registration or subscription fees is automatically skipped.
          </span>
        </div>

        <div className="space-y-3 pt-1">
          <Switch
            checked={s.draft.enabled}
            onChange={(v) => s.setDraft({ ...s.draft, enabled: v })}
            label="Enable recruitment agency discovery in target locations"
          />

          <Switch
            checked={s.draft.autoSubmit}
            onChange={(v) => s.setDraft({ ...s.draft, autoSubmit: v })}
            label="Auto-submit candidate profile & resume to verified free agencies"
            disabled={!s.draft.enabled}
          />

          <Switch
            checked={true}
            onChange={() => {}}
            label="Skip paid services (enforced — never pay to submit your CV)"
            disabled
          />
        </div>

        <Field
          label="Agency Search Locations"
          hint="Cities or regions to find recruitment agencies for (defaults to your search locations)"
        >
          <TagInput
            value={s.draft.targetLocations?.length ? s.draft.targetLocations : settings.locations}
            onChange={(v) => s.setDraft({ ...s.draft, targetLocations: v })}
            placeholder="Add location (e.g. London, Lagos, New York)"
          />
        </Field>

        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted">
            Manage your discovered agencies, review registration logs, and check submitted profiles:
          </span>
          <Link
            to="/agencies"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-strong hover:underline"
          >
            <Building2 className="size-3.5" />
            Go to Agencies Dashboard
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </SettingsSection>
  );
}
