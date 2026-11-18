import { useState } from "react";
import { UserRound } from "lucide-react";
import { useCollection, useDoc } from "@/lib/db";
import { EmptyState, LoadingBlock, PageHeader, Panel, Tabs } from "@/components/ui";
import { ResumeTab } from "./ResumeTab";
import { FactsTab } from "./FactsTab";
import { ContactTab } from "./ContactTab";

type Tab = "resume" | "facts" | "contact";

function NoProfile() {
  return (
    <Panel>
      <EmptyState
        icon={<UserRound className="size-8" />}
        title="No profile yet"
        description="Import your profile from the banner at the top of the page. Your resume, contact details and standard answers will appear here."
      />
    </Panel>
  );
}

export function Profile() {
  const { data: profile, loading } = useDoc("profile", "main");
  const { data: facts } = useCollection("facts");
  const [tab, setTab] = useState<Tab>("resume");

  return (
    <div className="max-w-5xl">
      <PageHeader title="Profile & Resume" description="What the agent knows about you. It only uses facts from here — it never invents experience." />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "resume", label: "Resume" },
          { value: "facts", label: "Facts", count: facts.length },
          { value: "contact", label: "Contact & standard answers" },
        ]}
      />
      {tab === "facts" ? (
        <FactsTab />
      ) : loading ? (
        <LoadingBlock />
      ) : !profile ? (
        <NoProfile />
      ) : tab === "resume" ? (
        <ResumeTab profile={profile} />
      ) : (
        <ContactTab key={profile.id} profile={profile} />
      )}
    </div>
  );
}
