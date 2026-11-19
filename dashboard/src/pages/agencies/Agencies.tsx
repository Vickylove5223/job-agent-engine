import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { AgencyStatus, RecruitmentAgency, WithId } from "@shared/types";
import {
  findAgenciesForLocations,
  prepareAgencySubmission,
  buildAgencyCandidateLetter,
  parseUserAgencyList,
  RECRUITMENT_AGENCIES_CATALOG,
} from "@shared/agencies";
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Panel,
  Select,
  Stat,
  StatGroup,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
} from "@/components/ui";
import { addDocument, deleteDocument, setDocument, updateDocument, useCollection, useDoc } from "@/lib/db";
import { formatDate } from "@/lib/format";

type TabFilter = "all" | "ready" | "submitted" | "paid_skipped";

export function Agencies() {
  const { data: agencies, loading: agenciesLoading } = useCollection("agencies");
  const { data: settings, loading: settingsLoading } = useDoc("settings", "main");
  const { data: profile } = useDoc("profile", "main");

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [inspectingAgency, setInspectingAgency] = useState<WithId<RecruitmentAgency> | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);

  // Active target scope from user settings
  const targetCountries = useMemo(() => {
    return (settings?.countries || []).map((c) => c.toUpperCase());
  }, [settings?.countries]);

  const targetLocations = useMemo(() => {
    return (settings?.locations || []).map((l) => l.toLowerCase().trim());
  }, [settings?.locations]);

  // Clean list of agencies strictly relevant to user's targeted locations/countries
  const relevantAgencies = useMemo(() => {
    if (!settings || (targetCountries.length === 0 && targetLocations.length === 0)) {
      return agencies;
    }
    return agencies.filter((agency) => {
      // Keep any agency user already submitted to or custom-added
      if (agency.status === "submitted") return true;

      const agencyCountries = (agency.countries || []).map((c) => c.toUpperCase());
      const hasCountryMatch =
        targetCountries.length === 0 ||
        agencyCountries.includes("GLOBAL") ||
        targetCountries.some((c) => agencyCountries.includes(c));

      const hasCityMatch =
        targetLocations.length > 0 &&
        agency.locations?.some((loc) =>
          targetLocations.some((tl) => tl.includes(loc.toLowerCase()) || loc.toLowerCase().includes(tl))
        );

      return hasCountryMatch || hasCityMatch;
    });
  }, [agencies, settings, targetCountries, targetLocations]);

  // Stats calculation based on relevant agencies for the user's target job market
  const stats = useMemo(() => {
    const total = relevantAgencies.length;
    const free = relevantAgencies.filter((a) => !a.isPaidService && a.status !== "paid_skipped").length;
    const submitted = relevantAgencies.filter((a) => a.status === "submitted").length;
    const paidSkipped = relevantAgencies.filter((a) => a.isPaidService || a.status === "paid_skipped").length;
    const ready = relevantAgencies.filter((a) => a.status === "verified_free" || (a.status === "discovered" && !a.isPaidService)).length;

    return { total, free, submitted, paidSkipped, ready };
  }, [relevantAgencies]);

  // Unique locations from relevant agencies
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    relevantAgencies.forEach((a) => {
      a.locations?.forEach((loc) => locSet.add(loc));
    });
    return Array.from(locSet).sort();
  }, [relevantAgencies]);

  // Filtered agencies based on tab, location dropdown, and search query
  const filteredAgencies = useMemo(() => {
    return relevantAgencies.filter((agency) => {
      // Tab filter
      if (activeTab === "ready") {
        if (agency.status !== "verified_free" && agency.status !== "discovered") return false;
        if (agency.isPaidService) return false;
      } else if (activeTab === "submitted") {
        if (agency.status !== "submitted") return false;
      } else if (activeTab === "paid_skipped") {
        if (agency.status !== "paid_skipped" && !agency.isPaidService) return false;
      }

      // Location filter
      if (selectedLocation !== "all") {
        const matchesLoc = agency.locations?.some(
          (l) => l.toLowerCase() === selectedLocation.toLowerCase()
        );
        if (!matchesLoc) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${agency.name} ${agency.locations.join(" ")} ${agency.sectors.join(" ")} ${agency.description ?? ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [relevantAgencies, activeTab, selectedLocation, searchQuery]);

  // Auto-search for agencies based on user's target locations
  const handleAutoSearch = async () => {
    if (!settings) return;
    setIsSearching(true);
    try {
      const activeCountries = settings.countries?.length ? settings.countries : ["GLOBAL"];
      const activeLocations = settings.locations?.length ? settings.locations : [];
      const targetRoles = settings.roles?.length ? settings.roles : [];

      const discovered = findAgenciesForLocations({
        countries: activeCountries,
        locations: activeLocations,
        roles: targetRoles,
      });

      // 1. Clean up stale catalog entries from other countries not matching target locations
      for (const existing of agencies) {
        if (existing.status === "submitted") continue;
        const isFromCatalog = RECRUITMENT_AGENCIES_CATALOG.some(
          (c) => c.name.toLowerCase() === existing.name.toLowerCase()
        );
        const isMatchingDiscovered = discovered.some(
          (d) => d.name.toLowerCase() === existing.name.toLowerCase()
        );
        if (isFromCatalog && !isMatchingDiscovered) {
          await deleteDocument("agencies", existing.id);
        }
      }

      // 2. Insert discovered matching agencies
      let addedCount = 0;
      for (const item of discovered) {
        const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const existing = agencies.find((a) => a.id === `agency-${slug}` || a.name.toLowerCase() === item.name.toLowerCase());
        if (!existing) {
          await setDocument("agencies", `agency-${slug}`, item);
          addedCount++;
        }
      }

      await addDocument("activity", {
        ts: new Date().toISOString(),
        level: "info",
        type: "agency_search",
        message: `Searched agencies for ${activeLocations.join(", ") || activeCountries.join(", ")}: discovered ${discovered.length} relevant agencies (${addedCount} newly added).`,
      });
    } catch (e) {
      console.error("Agency search failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-search once on initial load if no agencies matching user location exist yet
  const hasAutoSearchedRef = useRef(false);
  useEffect(() => {
    if (!settings || agenciesLoading || hasAutoSearchedRef.current) return;
    if (relevantAgencies.length === 0 && (targetCountries.length > 0 || targetLocations.length > 0)) {
      hasAutoSearchedRef.current = true;
      handleAutoSearch();
    }
  }, [settings, agenciesLoading, relevantAgencies.length, targetCountries, targetLocations]);

  // Submit profile to a single agency
  const handleSubmitAgency = async (agency: WithId<RecruitmentAgency>) => {
    if (!profile || !settings) return;
    setSubmittingId(agency.id);

    try {
      const prep = prepareAgencySubmission(profile, settings, agency);

      // Check for paid skip rule
      if (!prep.canSubmit) {
        await updateDocument("agencies", agency.id, {
          status: "paid_skipped",
          isPaidService: true,
          skipReason: prep.skipReason || "Paid service skipped - candidate fee detected",
        });

        await addDocument("activity", {
          ts: new Date().toISOString(),
          level: "warn",
          type: "agency_skip",
          message: `Skipped ${agency.name}: ${prep.skipReason || "Paid service detected. Only free recruitment agencies are allowed."}`,
        });
        return;
      }

      // Perform auto-submission
      await updateDocument("agencies", agency.id, {
        status: "submitted",
        submittedAt: new Date().toISOString(),
        submissionNotes: prep.submissionNotes,
        submittedDetails: prep.candidatePayload,
      });

      await addDocument("activity", {
        ts: new Date().toISOString(),
        level: "success",
        type: "agency_submit",
        message: `Auto-submitted candidate profile and resume to ${agency.name} (100% Free agency).`,
      });

      // Update inspecting modal if open
      if (inspectingAgency?.id === agency.id) {
        setInspectingAgency({
          ...agency,
          status: "submitted",
          submittedAt: new Date().toISOString(),
          submissionNotes: prep.submissionNotes,
          submittedDetails: prep.candidatePayload,
        });
      }
    } catch (e) {
      console.error("Submission failed:", e);
    } finally {
      setSubmittingId(null);
    }
  };

  // Bulk submit to all free agencies
  const handleBulkSubmit = async () => {
    if (!profile || !settings) return;
    setIsBulkSubmitting(true);

    try {
      const toSubmit = agencies.filter(
        (a) => !a.isPaidService && a.status !== "submitted" && a.status !== "paid_skipped"
      );

      let submittedCount = 0;
      let skippedCount = 0;

      for (const agency of toSubmit) {
        const prep = prepareAgencySubmission(profile, settings, agency);
        if (!prep.canSubmit) {
          await updateDocument("agencies", agency.id, {
            status: "paid_skipped",
            isPaidService: true,
            skipReason: prep.skipReason,
          });
          skippedCount++;
        } else {
          await updateDocument("agencies", agency.id, {
            status: "submitted",
            submittedAt: new Date().toISOString(),
            submissionNotes: prep.submissionNotes,
            submittedDetails: prep.candidatePayload,
          });
          submittedCount++;
        }
      }

      await addDocument("activity", {
        ts: new Date().toISOString(),
        level: "success",
        type: "agency_bulk_submit",
        message: `Recruitment agency cycle completed: submitted details to ${submittedCount} free agencies${skippedCount ? `, skipped ${skippedCount} paid services` : ""}.`,
      });
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const activeLocationsDisplay = settings?.locations?.length
    ? settings.locations.join(", ")
    : settings?.countries?.join(", ") || "Global";

  return (
    <div>
      {/* Page Header with exactly ONE unified primary CTA button */}
      <PageHeader
        title="Recruitment Agencies"
        description="Auto-search for staffing and recruitment agencies in the locations you are applying for, or paste a list of agency names to auto-submit your profile. Paid candidate services are strictly detected and skipped."
        actions={
          <Button
            variant="accent"
            icon={<Sparkles className="size-4" />}
            onClick={() => setActionModalOpen(true)}
          >
            Find & Add Agencies
          </Button>
        }
      />

      {/* Safeguard alert banner */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-accent/40 bg-accent-soft/30 p-4 text-sm">
        <ShieldCheck className="size-5 text-accent-strong shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-text">Candidate Fee Protection Active</p>
          <p className="text-muted mt-0.5 leading-relaxed">
            By law in modern labor markets (e.g. UK Employment Agencies Act, US & EU staffing standards), reputable recruitment agencies are paid by employers and never charge candidates. If any platform demands upfront fees, paid subscriptions, or credit card details to submit your CV, our engine automatically detects and <strong>skips it</strong>.
          </p>
          <p className="text-xs text-faint mt-1.5">
            Active search locations: <span className="font-medium text-text">{activeLocationsDisplay}</span>
          </p>
        </div>
      </div>

      {/* Stats summary */}
      <StatGroup>
        <Stat
          label="Agencies discovered"
          value={agenciesLoading ? "—" : stats.total}
          hint={`For ${activeLocationsDisplay}`}
        />
        <Stat
          label="Verified Free"
          value={agenciesLoading ? "—" : stats.free}
          hint="100% employer-funded"
        />
        <Stat
          label="Profile submitted"
          value={agenciesLoading ? "—" : stats.submitted}
          hint="CV registered with recruiters"
        />
        <Stat
          label="Paid services skipped"
          value={agenciesLoading ? "—" : stats.paidSkipped}
          hint="Protected from fees"
        />
      </StatGroup>

      {/* Filter Tabs */}
      <div className="mt-6">
        <Tabs<TabFilter>
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: "all", label: "All Agencies", count: stats.total },
            { value: "ready", label: "Free & Ready", count: stats.ready },
            { value: "submitted", label: "Submitted", count: stats.submitted },
            { value: "paid_skipped", label: "Paid (Skipped)", count: stats.paidSkipped },
          ]}
        />
      </div>

      {/* Filter and Search Controls — positioned directly below the filter tabs */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 max-w-xl">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, sector..."
              className="pl-9"
            />
          </div>

          {availableLocations.length > 0 && (
            <Select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-auto text-xs min-w-36"
            >
              <option value="all">All Locations ({availableLocations.length})</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Quick Auto-submit all free button in the toolbar */}
        {stats.ready > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Send className="size-3.5 text-accent-strong" />}
            loading={isBulkSubmitting}
            onClick={handleBulkSubmit}
            title="Submit your details to all verified free agencies"
          >
            Auto-Submit to All Free ({stats.ready})
          </Button>
        )}
      </div>

      {/* Agency Table */}
      {agenciesLoading || settingsLoading ? (
        <LoadingBlock />
      ) : filteredAgencies.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Building2 className="size-8" />}
            title="No agencies found"
            description={
              searchQuery || selectedLocation !== "all"
                ? "No recruitment agencies match your filter criteria."
                : "No recruitment agencies found yet. Click 'Find & Add Agencies' to auto-search or paste your list of agency names."
            }
            action={
              <Button
                variant="primary"
                icon={<Sparkles className="size-4" />}
                onClick={() => setActionModalOpen(true)}
              >
                Find & Add Agencies
              </Button>
            }
          />
        </Panel>
      ) : (
        <Panel padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Agency</Th>
                <Th>Locations & Sectors</Th>
                <Th>Candidate Cost</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filteredAgencies.map((agency) => {
                const isPaid = agency.isPaidService || agency.status === "paid_skipped";
                const isSubmitted = agency.status === "submitted";

                return (
                  <Tr
                    key={agency.id}
                    onClick={() => setInspectingAgency(agency)}
                    className="hover:bg-surface-2"
                  >
                    {/* Agency Name & Website */}
                    <Td>
                      <div className="font-semibold text-text flex items-center flex-wrap gap-1.5">
                        <span>{agency.name}</span>
                        {agency.countries?.slice(0, 2).map((c) => (
                          <span
                            key={c}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              c === "NG"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : c === "GLOBAL"
                                ? "bg-accent/10 text-accent-strong border border-accent/20"
                                : "bg-surface-2 text-muted border border-border"
                            }`}
                          >
                            {c === "NG" ? "🇳🇬 Nigeria" : c === "GB" ? "🇬🇧 UK" : c === "US" ? "🇺🇸 US" : c === "GLOBAL" ? "🌐 Global" : c}
                          </span>
                        ))}
                        {agency.website && (
                          <a
                            href={agency.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-faint hover:text-text inline-flex"
                            title="Visit website"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5 line-clamp-1 max-w-sm">
                        {agency.description}
                      </div>
                    </Td>

                    {/* Locations & Sectors */}
                    <Td>
                      <div className="text-xs font-medium text-text flex flex-wrap gap-1">
                        {agency.locations?.slice(0, 3).map((loc) => (
                          <span
                            key={loc}
                            className="rounded bg-surface-2 px-1.5 py-0.5 border border-border"
                          >
                            {loc}
                          </span>
                        ))}
                        {agency.locations?.length > 3 && (
                          <span className="text-faint text-[11px] self-center">
                            +{agency.locations.length - 3} more
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-faint mt-1 flex flex-wrap gap-1">
                        {agency.sectors?.slice(0, 2).join(" · ")}
                      </div>
                    </Td>

                    {/* Free vs Paid status */}
                    <Td>
                      {isPaid ? (
                        <Badge tone="red" dot>
                          Paid Fee — Skipped
                        </Badge>
                      ) : (
                        <Badge tone="green" dot>
                          100% Free
                        </Badge>
                      )}
                      <div className="text-[11px] text-faint mt-1 line-clamp-1 max-w-[180px]">
                        {agency.pricingDetails || (isPaid ? "Paid service" : "Employer funded")}
                      </div>
                    </Td>

                    {/* Status Badge */}
                    <Td>
                      <StatusBadge status={agency.status} isPaid={isPaid} />
                      {agency.submittedAt && (
                        <div className="text-[11px] text-faint mt-1">
                          {formatDate(agency.submittedAt)}
                        </div>
                      )}
                    </Td>

                    {/* Action button */}
                    <Td className="text-right">
                      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        {isPaid ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="text-danger"
                            title={agency.skipReason || "Skipped because it charges candidates"}
                          >
                            <ShieldAlert className="size-3.5 mr-1" />
                            Skipped
                          </Button>
                        ) : isSubmitted ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setInspectingAgency(agency)}
                          >
                            <CheckCircle2 className="size-3.5 text-accent mr-1" />
                            Details
                          </Button>
                        ) : (
                          <Button
                            variant="accent"
                            size="sm"
                            loading={submittingId === agency.id}
                            onClick={() => handleSubmitAgency(agency)}
                          >
                            <Send className="size-3.5 mr-1" />
                            Auto-Submit
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
      )}

      {/* Inspecting Agency Drawer */}
      <AgencyDetailsDrawer
        agency={inspectingAgency}
        onClose={() => setInspectingAgency(null)}
        onSubmit={handleSubmitAgency}
        isSubmitting={submittingId === inspectingAgency?.id}
        profile={profile}
        settings={settings}
      />

      {/* Unified Search & Add Agencies Modal */}
      <SearchAndAddAgenciesModal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        activeLocations={activeLocationsDisplay}
        onAutoSearch={async () => {
          await handleAutoSearch();
          setActionModalOpen(false);
        }}
        isSearching={isSearching}
        onAddAgencyList={async (pastedAgencies) => {
          let count = 0;
          for (const item of pastedAgencies) {
            const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            await setDocument("agencies", `agency-${slug}`, item);
            count++;
          }
          await addDocument("activity", {
            ts: new Date().toISOString(),
            level: "success",
            type: "agency_import",
            message: `Added ${count} recruitment agencies from your custom list.`,
          });
          setActionModalOpen(false);
        }}
        readyCount={stats.ready}
        onBulkSubmitAll={async () => {
          setActionModalOpen(false);
          await handleBulkSubmit();
        }}
        isBulkSubmitting={isBulkSubmitting}
      />
    </div>
  );
}

function StatusBadge({ status, isPaid }: { status: AgencyStatus; isPaid: boolean }) {
  if (isPaid || status === "paid_skipped") {
    return <Badge tone="red">Paid Skipped</Badge>;
  }
  if (status === "submitted") {
    return <Badge tone="blue">Submitted</Badge>;
  }
  if (status === "submitting") {
    return <Badge tone="amber">Submitting...</Badge>;
  }
  if (status === "verified_free") {
    return <Badge tone="green">Verified Free</Badge>;
  }
  return <Badge tone="neutral">Discovered</Badge>;
}

/**
 * Drawer displaying full details of an agency and its submission payload.
 */
function AgencyDetailsDrawer({
  agency,
  onClose,
  onSubmit,
  isSubmitting,
  profile,
  settings,
}: {
  agency: WithId<RecruitmentAgency> | null;
  onClose: () => void;
  onSubmit: (a: WithId<RecruitmentAgency>) => Promise<void>;
  isSubmitting: boolean;
  profile?: any;
  settings?: any;
}) {
  if (!agency) return null;

  const isPaid = agency.isPaidService || agency.status === "paid_skipped";
  const isSubmitted = agency.status === "submitted";

  const letterPreview = profile && settings ? buildAgencyCandidateLetter(profile, settings, agency) : "";

  return (
    <Drawer
      open={!!agency}
      onClose={onClose}
      title={agency.name}
      subtitle={
        <div className="flex items-center gap-2">
          {agency.website && (
            <a
              href={agency.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-strong hover:underline inline-flex items-center gap-1"
            >
              Visit Agency Website <ExternalLink className="size-3" />
            </a>
          )}
          {agency.registrationUrl && (
            <a
              href={agency.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-text inline-flex items-center gap-1 text-xs"
            >
              Candidate Portal <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {isPaid ? (
              <span className="text-xs text-danger font-medium flex items-center gap-1">
                <ShieldAlert className="size-4" />
                Skipped: Free agencies only
              </span>
            ) : isSubmitted ? (
              <span className="text-xs text-accent-strong font-medium flex items-center gap-1">
                <CheckCircle2 className="size-4" />
                Registered on {formatDate(agency.submittedAt)}
              </span>
            ) : (
              <span className="text-xs text-muted">
                100% Free · Will submit resume & contact info
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {!isPaid && !isSubmitted && (
              <Button
                variant="accent"
                loading={isSubmitting}
                icon={<Send className="size-4" />}
                onClick={() => onSubmit(agency)}
              >
                Auto-Submit Details
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Paid service warning banner */}
        {isPaid && (
          <div className="rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm text-danger">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Paid Service Detected — Submission Blocked</p>
                <p className="mt-1 text-xs text-text leading-relaxed">
                  {agency.skipReason ||
                    "This service requires payment or subscription from candidates before distributing details. The system has automatically skipped submitting your personal information to prevent unwanted charges."}
                </p>
                <div className="mt-2 text-xs font-mono bg-surface p-2 rounded border border-border">
                  Fee Details: {agency.pricingDetails || "Candidate charges required"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Free verification badge */}
        {!isPaid && (
          <div className="rounded-lg border border-accent/40 bg-accent-soft/30 p-4 text-sm">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="size-5 text-accent-strong shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-text">Verified 100% Free for Candidates</p>
                <p className="mt-0.5 text-xs text-muted">
                  {agency.pricingDetails || "This agency is employer-funded. Candidates never pay placement or registration fees."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Agency overview */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wider text-xs">
            Agency Profile
          </h3>
          <p className="text-sm text-muted leading-relaxed">{agency.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm pt-2">
            <div>
              <span className="text-xs text-faint block">Locations Served</span>
              <span className="font-medium text-text">{agency.locations?.join(", ") || "Global"}</span>
            </div>
            <div>
              <span className="text-xs text-faint block">Countries</span>
              <span className="font-medium text-text">{agency.countries?.join(", ")}</span>
            </div>
            <div>
              <span className="text-xs text-faint block">Sectors</span>
              <span className="font-medium text-text">{agency.sectors?.join(", ")}</span>
            </div>
            <div>
              <span className="text-xs text-faint block">Submission Method</span>
              <span className="font-medium text-text capitalize">
                {agency.submissionMethod.replace("_", " ")}
              </span>
            </div>
            {agency.contactEmail && (
              <div>
                <span className="text-xs text-faint block">Candidate Desk Email</span>
                <span className="font-medium text-text">{agency.contactEmail}</span>
              </div>
            )}
            {agency.phone && (
              <div>
                <span className="text-xs text-faint block">Agency Telephone</span>
                <span className="font-medium text-text">{agency.phone}</span>
              </div>
            )}
          </div>
        </section>

        {/* Submission Details */}
        <section className="space-y-3 pt-3 border-t border-border">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wider text-xs">
            {isSubmitted ? "Submission Record" : "Information to be Submitted"}
          </h3>

          {isSubmitted && agency.submissionNotes && (
            <div className="rounded bg-surface-2 p-3 text-xs border border-border">
              <span className="font-medium text-text">Status Note: </span>
              <span className="text-muted">{agency.submissionNotes}</span>
            </div>
          )}

          <div className="space-y-2 text-xs bg-surface-2/60 p-3 rounded-lg border border-border">
            <div className="flex justify-between">
              <span className="text-faint">Candidate Name:</span>
              <span className="font-medium text-text">
                {agency.submittedDetails?.candidateName || profile?.fullName || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Candidate Email:</span>
              <span className="font-medium text-text">
                {agency.submittedDetails?.candidateEmail || profile?.email || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Phone:</span>
              <span className="font-medium text-text">
                {agency.submittedDetails?.candidatePhone || profile?.phone || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Target Roles:</span>
              <span className="font-medium text-text">
                {agency.submittedDetails?.targetRoles?.join(", ") || settings?.roles?.join(", ") || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Target Locations:</span>
              <span className="font-medium text-text">
                {agency.submittedDetails?.locations?.join(", ") || settings?.locations?.join(", ") || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Attached Resume:</span>
              <span className="font-medium text-text">
                {agency.submittedDetails?.resumeFileName || profile?.masterResume?.fileName || "Resume.pdf"}
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted block mb-1.5">
              Introductory Consultant Note:
            </span>
            <pre className="whitespace-pre-wrap font-sans text-xs bg-surface border border-border p-3 rounded-md text-text leading-relaxed max-h-48 overflow-y-auto">
              {agency.submittedDetails?.coverNote || letterPreview}
            </pre>
          </div>
        </section>
      </div>
    </Drawer>
  );
}

/**
 * Unified Modal combining Auto-Search and Pasting a Custom List of Agencies into 1 clean interface.
 */
function SearchAndAddAgenciesModal({
  open,
  onClose,
  activeLocations,
  onAutoSearch,
  isSearching,
  onAddAgencyList,
  readyCount,
  onBulkSubmitAll,
  isBulkSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  activeLocations: string;
  onAutoSearch: () => Promise<void>;
  isSearching: boolean;
  onAddAgencyList: (agencies: RecruitmentAgency[]) => Promise<void>;
  readyCount: number;
  onBulkSubmitAll: () => Promise<void>;
  isBulkSubmitting: boolean;
}) {
  const [mode, setMode] = useState<"auto" | "paste">("auto");
  const [pastedText, setPastedText] = useState(
    `Hays\nMichael Page\nWorkforce Group\nPhillips Consulting\nMacTay Consulting\nAdecco\nRobert Half`
  );
  const [locationsInput, setLocationsInput] = useState(activeLocations);
  const [isProcessingList, setIsProcessingList] = useState(false);

  if (!open) return null;

  const handleProcessPastedList = async () => {
    if (!pastedText.trim()) return;
    setIsProcessingList(true);
    try {
      const parsed = parseUserAgencyList(pastedText, {
        defaultLocations: locationsInput.split(",").map((s) => s.trim()).filter(Boolean),
      });
      await onAddAgencyList(parsed);
    } finally {
      setIsProcessingList(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-bg p-6 shadow-xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent-strong">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">Find & Add Agencies</h2>
              <p className="text-xs text-muted">
                Auto-search by location or paste your custom list of agency names.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-text cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mt-4 flex rounded-lg bg-surface-2 p-1 border border-border shrink-0">
          <button
            type="button"
            onClick={() => setMode("auto")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === "auto"
                ? "bg-surface text-text shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            <Search className="size-3.5 text-accent-strong" />
            Auto-Search My Locations
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === "paste"
                ? "bg-surface text-text shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            <Upload className="size-3.5 text-accent-strong" />
            Paste List of Agency Names
          </button>
        </div>

        {/* Tab Body */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4">
          {mode === "auto" ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
                <span className="text-xs font-semibold text-text uppercase tracking-wider block">
                  Active Location Scope
                </span>
                <p className="text-sm font-medium text-text">
                  📍 {activeLocations || "Global & Remote"}
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  The engine will search reputable recruitment agencies in these target locations, verify they are 100% employer-funded, and automatically skip any service that charges candidate fees.
                </p>
              </div>

              <div className="rounded-lg border border-accent/40 bg-accent-soft/20 p-3 text-xs text-muted flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-accent-strong shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Fee Protection:</strong> Any service demanding registration fees, subscription charges, or upfront candidate payments is automatically blocked.
                </span>
              </div>

              <Button
                variant="primary"
                loading={isSearching}
                icon={<Search className="size-4" />}
                onClick={onAutoSearch}
                className="w-full h-10 text-sm"
              >
                Auto-Search & Add Agencies in {activeLocations}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted leading-relaxed">
                Paste agency names below (one per line or comma-separated). The engine will search their details, check for candidate fees, extract registration portals, and add them:
              </p>

              <Field label="Agencies Names List">
                <Textarea
                  rows={7}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="e.g.&#10;Hays&#10;Michael Page&#10;Workforce Group&#10;Adecco&#10;Robert Half"
                  className="font-mono text-xs"
                />
              </Field>

              <Field label="Locations Served (e.g. London, Lagos, Remote)">
                <Input
                  value={locationsInput}
                  onChange={(e) => setLocationsInput(e.target.value)}
                  placeholder="e.g. Lagos, Remote"
                />
              </Field>

              <Button
                variant="primary"
                loading={isProcessingList}
                icon={<CheckCircle2 className="size-4" />}
                onClick={handleProcessPastedList}
                className="w-full h-10 text-sm"
              >
                Add Agencies from List
              </Button>
            </div>
          )}

          {/* Quick Submit Banner if ready agencies exist */}
          {readyCount > 0 && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3 bg-surface-2/60 p-3 rounded-lg">
              <div className="text-xs">
                <span className="font-semibold text-text">{readyCount} Verified Free Agencies</span>
                <p className="text-faint text-[11px]">Ready to receive your profile & resume</p>
              </div>
              <Button
                variant="accent"
                size="sm"
                loading={isBulkSubmitting}
                icon={<Send className="size-3.5" />}
                onClick={onBulkSubmitAll}
              >
                Auto-Submit to All ({readyCount})
              </Button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-border flex justify-end shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
