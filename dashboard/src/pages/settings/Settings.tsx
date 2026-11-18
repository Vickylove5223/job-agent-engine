import { useCallback, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import type { Settings as SettingsDoc } from "@shared/types";
import { EmptyState, Field, LoadingBlock, PageHeader, Panel, TagInput } from "@/components/ui";
import { useDoc } from "@/lib/db";
import { AgentSection } from "./AgentSection";
import { DangerZone } from "./DangerZone";
import { MatchingSection, CoverLetterSection } from "./MatchingSection";
import { SearchSection } from "./SearchSection";
import { SettingsSection, useSection } from "./SettingsSection";
import { ConnectionsSection } from "./ConnectionsSection";
import { JobSitesSection, type SiteRequest } from "./JobSitesSection";
import { WhereSection, type WhereDraft } from "./WhereSection";
import { normalizeSettings } from "./defaults";

function BlockedSection({ settings }: { settings: SettingsDoc }) {
  const s = useSection(settings.blockedCompanies, (d) => ({ blockedCompanies: d }));
  return (
    <SettingsSection
      title="Blocked companies"
      description="Jobs from these companies are skipped, e.g. your current employer."
      dirty={s.dirty}
      status={s.status}
      error={s.error}
      onSave={s.save}
      onReset={s.reset}
    >
      <Field label="Companies">
        <TagInput value={s.draft} onChange={s.setDraft} placeholder="Add a company" />
      </Field>
    </SettingsSection>
  );
}

export function Settings() {
  const { data, loading } = useDoc("settings", "main");

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" description="Control what the agent looks for and how it applies." />
      {loading ? (
        <LoadingBlock />
      ) : !data ? (
        <Panel>
          <EmptyState
            icon={<SettingsIcon className="size-6" />}
            title="No settings yet"
            description="Finish setup using the banner at the top of the page to import your profile and default settings."
          />
        </Panel>
      ) : (
        <SettingsBody settings={normalizeSettings(data)} />
      )}
    </div>
  );
}

function SettingsBody({ settings }: { settings: SettingsDoc }) {
  // The locations draft drives the job-site recommendations before it is saved.
  const [where, setWhere] = useState<WhereDraft>({ countries: settings.countries, workModes: settings.workModes });
  const [siteRequest, setSiteRequest] = useState<SiteRequest | null>(null);

  const onWhereChange = useCallback((w: WhereDraft) => setWhere(w), []);
  const reviewSites = useCallback((ids: string[]) => {
    setSiteRequest({ ids, nonce: Date.now() });
    document.getElementById("job-sites")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="space-y-6">
      <AgentSection settings={settings} />
      <SearchSection settings={settings} />
      <WhereSection settings={settings} onDraftChange={onWhereChange} onReviewSites={reviewSites} />
      <JobSitesSection settings={settings} where={where} request={siteRequest} />
      <ConnectionsSection settings={settings} />
      <MatchingSection settings={settings} />
      <CoverLetterSection settings={settings} />
      <BlockedSection settings={settings} />
      <DangerZone />
    </div>
  );
}
