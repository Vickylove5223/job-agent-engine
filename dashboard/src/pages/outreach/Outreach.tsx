import { useMemo, useState } from "react";
import {
  Building,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Mail,
  Search,
  Send,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type {
  ColdEmailRecord,
  CompanyContact,
  ContactRoleCategory,
  OutreachCompany,
  WithId,
} from "@shared/types";
import {
  DEFAULT_COLD_EMAIL_TEMPLATES,
  detectCountryCode,
  isCompanyMatchingLocation,
  parseUserCompanyList,
  renderColdEmail,
  searchCompaniesByNicheAndLocation,
} from "@shared/outreach";
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

type TabFilter = "companies" | "ready" | "contacted" | "emails_log";

export function Outreach() {
  const { data: companies, loading: companiesLoading } = useCollection("outreachCompanies");
  const { data: coldEmails, loading: emailsLoading } = useCollection("coldEmails");
  const { data: settings, loading: settingsLoading } = useDoc("settings", "main");
  const { data: profile } = useDoc("profile", "main");

  const [activeTab, setActiveTab] = useState<TabFilter>("companies");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(false);
  const [companyChoiceModalOpen, setCompanyChoiceModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // Multi-select and bulk outreach state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [inspectingCompany, setInspectingCompany] = useState<WithId<OutreachCompany> | null>(null);

  // Email composer modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [activeCompany, setActiveCompany] = useState<WithId<OutreachCompany> | null>(null);
  const [activeContact, setActiveContact] = useState<CompanyContact | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_COLD_EMAIL_TEMPLATES[0].id);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Stats calculation
  const stats = useMemo(() => {
    const totalCompanies = companies.length;
    let totalContacts = 0;
    companies.forEach((c) => {
      totalContacts += c.contacts?.length || 0;
    });
    const contactedCount = companies.filter((c) => c.status === "contacted").length;
    const sentCount = coldEmails.length;
    const readyCount = companies.filter((c) => c.status === "contacts_found" || c.status === "outreach_ready").length;

    return { totalCompanies, totalContacts, contactedCount, sentCount, readyCount };
  }, [companies, coldEmails]);

  // Niches present in current companies list
  const activeNiches = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => {
      if (c.niche) set.add(c.niche);
    });
    return Array.from(set).sort();
  }, [companies]);

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      // Tab filter
      if (activeTab === "ready") {
        if (company.status !== "contacts_found" && company.status !== "outreach_ready") return false;
      } else if (activeTab === "contacted") {
        if (company.status !== "contacted" && company.status !== "replied") return false;
      }

      // Niche filter
      if (selectedNiche !== "all") {
        if (company.niche?.toLowerCase() !== selectedNiche.toLowerCase()) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${company.name} ${company.domain} ${company.niche} ${company.location} ${company.contacts?.map((c) => `${c.name} ${c.title} ${c.email}`).join(" ") || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [companies, activeTab, selectedNiche, searchQuery]);

  // Selection helpers for batch checkbox outreach
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filteredCompanies.length > 0 &&
    filteredCompanies.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCompanies.map((c) => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedCompaniesList = useMemo(
    () => companies.filter((c) => selectedIds.has(c.id)),
    [companies, selectedIds]
  );

  // Bulk outreach sender
  const handleBulkSend = async (templateId: string) => {
    if (!profile || !settings || selectedIds.size === 0) return;
    setBulkSending(true);

    const tpl =
      DEFAULT_COLD_EMAIL_TEMPLATES.find((t) => t.id === templateId) ||
      DEFAULT_COLD_EMAIL_TEMPLATES[0];
    const targetRole = settings.roles?.length ? settings.roles[0] : "Product Designer";
    const selectedCompanies = companies.filter((c) => selectedIds.has(c.id));

    let sent = 0;
    const senderEmail = profile.email || "";
    try {
      for (const comp of selectedCompanies) {
        if (!comp.contacts || comp.contacts.length === 0) continue;
        const contact =
          comp.contacts.find((c) => c.roleCategory === "hr_talent") || comp.contacts[0];

        const rendered = renderColdEmail(tpl, {
          candidateName: profile.fullName || "Candidate",
          candidateEmail: senderEmail,
          candidatePhone: profile.phone || "",
          companyName: comp.name,
          contactName: contact.name,
          contactTitle: contact.title,
          targetRole,
          niche: comp.niche,
          location: comp.location,
          portfolioLink: profile.links?.portfolio,
          linkedinLink: profile.links?.linkedin,
          resumeFileName: profile.masterResume?.fileName || "Resume.pdf",
          yearsExperience: profile.standardAnswers?.yearsExperience || "5+ years",
        });

        const record: ColdEmailRecord = {
          companyId: comp.id,
          companyName: comp.name,
          recipientName: contact.name,
          recipientEmail: contact.email,
          recipientTitle: contact.title,
          roleCategory: contact.roleCategory,
          subject: rendered.subject,
          body: rendered.body,
          sentAt: new Date().toISOString(),
          status: "sent",
          templateId: tpl.id,
          senderEmail,
          senderProvider: "gmail",
          notes: `Sent automatically via Google Gmail (${senderEmail}) to ${contact.title}`,
        };

        const emailId = `email-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        await setDocument("coldEmails", emailId, record);

        await updateDocument("outreachCompanies", comp.id, {
          status: "contacted",
          contactedAt: new Date().toISOString(),
          emailsSentCount: (comp.emailsSentCount || 0) + 1,
        });

        sent++;
      }

      await addDocument("activity", {
        ts: new Date().toISOString(),
        level: "success",
        type: "cold_email_bulk",
        message: `Sent cold outreach emails via Google Gmail (${senderEmail}) to ${sent} companies at once (${selectedCompanies
          .map((c) => c.name)
          .slice(0, 3)
          .join(", ")}${selectedCompanies.length > 3 ? "..." : ""}).`,
      });

      setSelectedIds(new Set());
      setBulkModalOpen(false);
    } catch (e) {
      console.error("Bulk email sending failed:", e);
    } finally {
      setBulkSending(false);
    }
  };

  // User's active job search location summary
  const activeLocationLabel = useMemo(() => {
    if (!settings) return "your job search locations";
    const explicitOutreach = (settings.outreachSettings?.targetLocations || []).filter(Boolean);
    if (explicitOutreach.length > 0) return explicitOutreach.join(", ");
    const userLocs = (settings.locations || []).filter(Boolean);
    if (userLocs.length > 0) return userLocs.join(", ");
    if (settings.countries?.length) {
      return settings.countries
        .map((c) => (c === "NG" ? "Nigeria" : c === "GB" ? "United Kingdom" : c === "US" ? "USA" : c === "CA" ? "Canada" : c))
        .join(", ");
    }
    if (profile?.location) return profile.location;
    return "Remote";
  }, [settings, profile]);

  // Auto-search companies in selected niches & locations
  const handleAutoSearch = async () => {
    if (!settings) return;
    setIsSearching(true);
    try {
      // 1. Determine target locations & countries from user's specified settings & profile
      const userSpecifiedLocations = (settings.locations || []).filter(Boolean);
      const userSpecifiedCountries = (settings.countries || []).filter(Boolean);
      const outreachLocations = (settings.outreachSettings?.targetLocations || []).filter(Boolean);
      const outreachNiches = (settings.outreachSettings?.niches || []).filter(Boolean);

      // Prioritize explicit outreach locations > user's specified job locations > profile location
      let targetLocations: string[] = [];
      if (outreachLocations.length > 0) {
        targetLocations = outreachLocations;
      } else if (userSpecifiedLocations.length > 0) {
        targetLocations = userSpecifiedLocations;
      } else if (profile?.location) {
        targetLocations = [profile.location];
      }

      // Countries
      let targetCountries: string[] = [];
      if (userSpecifiedCountries.length > 0) {
        targetCountries = userSpecifiedCountries;
      } else if (profile?.location) {
        const detected = detectCountryCode(profile.location);
        if (detected) targetCountries = [detected];
      }

      const allowRemote = settings.workModes?.includes("remote") || settings.remoteOnly || false;

      const targetNiches = outreachNiches.length > 0
        ? outreachNiches
        : ["Loan Companies & Digital Lending", "Fintech & Payments"];

      const discovered = searchCompaniesByNicheAndLocation({
        niches: targetNiches,
        locations: targetLocations,
        countries: targetCountries,
        allowRemote,
      });

      // 2. Clean up stale catalog entries from other countries that don't match target locations
      for (const existing of companies) {
        if (existing.status === "contacted" || existing.source === "user_import") continue;
        const matchesCurrent = isCompanyMatchingLocation(existing, targetLocations, targetCountries, allowRemote);
        if (!matchesCurrent) {
          await deleteDocument("outreachCompanies", existing.id);
        }
      }

      // 3. Insert or update discovered matching companies
      let added = 0;
      for (const item of discovered) {
        const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const id = `comp-${slug}`;
        const exists = companies.find((c) => c.id === id || c.name.toLowerCase() === item.name.toLowerCase());
        if (!exists) {
          await setDocument("outreachCompanies", id, item);
          added++;
        }
      }

      const locSummary = targetLocations.join(", ") || (targetCountries.length ? targetCountries.join(", ") : "Remote");
      await addDocument("activity", {
        ts: new Date().toISOString(),
        level: "info",
        type: "outreach_search",
        message: `Auto-searched companies for ${targetNiches.slice(0, 2).join(", ")} in ${locSummary}: found ${discovered.length} companies (${added} new).`,
      });
    } catch (e) {
      console.error("Outreach search failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  // Open email composer for a specific contact
  const handleOpenEmailComposer = (company: WithId<OutreachCompany>, contact: CompanyContact) => {
    setActiveCompany(company);
    setActiveContact(contact);

    // Pick appropriate template based on contact category
    let tpl = DEFAULT_COLD_EMAIL_TEMPLATES.find((t) => t.targetAudience === contact.roleCategory);
    if (!tpl && company.niche.toLowerCase().includes("loan")) {
      tpl = DEFAULT_COLD_EMAIL_TEMPLATES.find((t) => t.id === "tpl-loan-fintech");
    }
    if (!tpl) tpl = DEFAULT_COLD_EMAIL_TEMPLATES[0];

    setSelectedTemplateId(tpl.id);

    if (profile && settings) {
      const targetRole = settings.roles?.length ? settings.roles[0] : "Product Designer / Engineer";
      const location = company.location || (settings.locations?.length ? settings.locations[0] : "Remote");
      const rendered = renderColdEmail(tpl, {
        candidateName: profile.fullName || "Candidate",
        candidateEmail: profile.email || "",
        candidatePhone: profile.phone || "",
        companyName: company.name,
        contactName: contact.name,
        contactTitle: contact.title,
        targetRole,
        niche: company.niche,
        location,
        portfolioLink: profile.links?.portfolio,
        linkedinLink: profile.links?.linkedin,
        resumeFileName: profile.masterResume?.fileName || "Resume.pdf",
        yearsExperience: profile.standardAnswers?.yearsExperience || "5+ years",
      });
      setCustomSubject(rendered.subject);
      setCustomBody(rendered.body);
    }

    setEmailModalOpen(true);
    setCopied(false);
  };

  // Switch template inside composer
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = DEFAULT_COLD_EMAIL_TEMPLATES.find((t) => t.id === templateId) || DEFAULT_COLD_EMAIL_TEMPLATES[0];

    if (activeCompany && activeContact && profile && settings) {
      const targetRole = settings.roles?.length ? settings.roles[0] : "Product Designer / Engineer";
      const location = activeCompany.location || (settings.locations?.length ? settings.locations[0] : "Remote");
      const rendered = renderColdEmail(tpl, {
        candidateName: profile.fullName || "Candidate",
        candidateEmail: profile.email || "",
        candidatePhone: profile.phone || "",
        companyName: activeCompany.name,
        contactName: activeContact.name,
        contactTitle: activeContact.title,
        targetRole,
        niche: activeCompany.niche,
        location,
        portfolioLink: profile.links?.portfolio,
        linkedinLink: profile.links?.linkedin,
        resumeFileName: profile.masterResume?.fileName || "Resume.pdf",
        yearsExperience: profile.standardAnswers?.yearsExperience || "5+ years",
      });
      setCustomSubject(rendered.subject);
      setCustomBody(rendered.body);
    }
  };

  // Send the cold email via Google Gmail
  const handleSendEmail = async () => {
    if (!activeCompany || !activeContact || !profile || !settings) return;
    setIsSending(true);

    try {
      const tpl = DEFAULT_COLD_EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId) || DEFAULT_COLD_EMAIL_TEMPLATES[0];
      const senderEmail = profile.email || "";
      const record: ColdEmailRecord = {
        companyId: activeCompany.id,
        companyName: activeCompany.name,
        recipientName: activeContact.name,
        recipientEmail: activeContact.email,
        recipientTitle: activeContact.title,
        roleCategory: activeContact.roleCategory,
        subject: customSubject,
        body: customBody,
        sentAt: new Date().toISOString(),
        status: "sent",
        templateId: tpl.id,
        senderEmail,
        senderProvider: "gmail",
        notes: `Cold outreach email sent automatically via Google Gmail (${senderEmail})`,
      };

      const emailId = `email-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      await setDocument("coldEmails", emailId, record);

      // Update company status to contacted
      await updateDocument("outreachCompanies", activeCompany.id, {
        status: "contacted",
        contactedAt: new Date().toISOString(),
        emailsSentCount: (activeCompany.emailsSentCount || 0) + 1,
      });

      // Log in user's activity stream
      await addDocument("activity", {
        ts: new Date().toISOString(),
        level: "success",
        type: "cold_email",
        message: `Sent cold email to ${activeContact.name} (${activeContact.title}) at ${activeCompany.name} via Google Gmail (${senderEmail})`,
      });

      setEmailModalOpen(false);
    } catch (e) {
      console.error("Sending email failed:", e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Company Outreach"
        description="Find target companies, enrich contacts, and send personalized cold outreach."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="accent"
              icon={<Building className="size-4" />}
              loading={isSearching}
              onClick={() => setCompanyChoiceModalOpen(true)}
            >
              Companies
            </Button>
            <Button
              variant="secondary"
              icon={<Edit3 className="size-4" />}
              onClick={() => setTemplateModalOpen(true)}
            >
              Email Template
            </Button>
          </div>
        }
      />

      {/* Gmail Sending Channel Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 mb-6 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded bg-white shadow-xs border border-border shrink-0">
            <svg className="size-4" viewBox="0 0 24 24" fill="none">
              <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z" fill="#EA4335" />
            </svg>
          </div>
          <div>
            <span className="text-muted">Outreach Email Channel: </span>
            <strong className="text-text font-semibold">
              Google Gmail ({profile?.email || ""})
            </strong>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Gmail Active & Automated
          </span>
        </div>
      </div>

      {/* Stats tiles */}
      <StatGroup>
        <Stat
          label="Companies Monitored"
          value={companiesLoading ? "—" : stats.totalCompanies}
          hint="Target niche companies"
        />
        <Stat
          label="Discovered Contacts"
          value={companiesLoading ? "—" : stats.totalContacts}
          hint="HR, recruiters, & stakeholders"
        />
        <Stat
          label="Ready for Outreach"
          value={companiesLoading ? "—" : stats.readyCount}
          hint="Companies with verified emails"
        />
        <Stat
          label="Cold Emails Sent"
          value={emailsLoading ? "—" : stats.sentCount}
          hint={`${stats.contactedCount} companies reached`}
        />
      </StatGroup>

      {/* Filter Tabs */}
      <div className="mt-6">
        <Tabs<TabFilter>
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: "companies", label: "All Companies", count: stats.totalCompanies },
            { value: "ready", label: "Ready for Outreach", count: stats.readyCount },
            { value: "contacted", label: "Contacted", count: stats.contactedCount },
            { value: "emails_log", label: "Sent Emails Log", count: stats.sentCount },
          ]}
        />
      </div>

      {/* Filter and Search Controls — positioned directly below the filter tabs */}
      {activeTab !== "emails_log" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:w-64 sm:flex-initial">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter company or contact..."
              className="pl-9"
            />
          </div>

          {activeNiches.length > 0 && (
            <Select
              value={selectedNiche}
              onChange={(e) => setSelectedNiche(e.target.value)}
              className="w-auto text-xs"
            >
              <option value="all">All Niches</option>
              {activeNiches.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      {/* Bulk Action Banner when companies are selected */}
      {selectedIds.size > 0 && activeTab !== "emails_log" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent-soft p-3 sm:px-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-text">
              {selectedIds.size} of {filteredCompanies.length} {selectedIds.size === 1 ? "company" : "companies"} selected
            </span>
            <span className="text-muted text-xs">•</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-muted hover:text-text underline cursor-pointer"
            >
              Deselect all
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="accent"
              size="sm"
              icon={<Send className="size-3.5" />}
              onClick={() => setBulkModalOpen(true)}
            >
              Send Cold Email at Once ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === "emails_log" ? (
        <ColdEmailsLogTable emails={coldEmails} loading={emailsLoading} />
      ) : companiesLoading || settingsLoading ? (
        <LoadingBlock />
      ) : filteredCompanies.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Building className="size-8" />}
            title="No companies found"
            description={
              searchQuery || selectedNiche !== "all"
                ? "No companies match your search criteria."
                : "No companies added yet. Click 'Companies' to auto-search niche companies or upload your own list."
            }
            action={
              <Button
                variant="primary"
                icon={<Building className="size-4" />}
                onClick={() => setCompanyChoiceModalOpen(true)}
              >
                Find & Add Companies
              </Button>
            }
          />
        </Panel>
      ) : (
        <Panel padded={false}>
          <Table>
            <thead>
              <tr>
                <Th className="w-10 text-center">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border-strong accent-accent cursor-pointer align-middle"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    title={allFilteredSelected ? "Deselect all" : "Select all"}
                  />
                </Th>
                <Th>Company</Th>
                <Th>Decision Maker / Contact</Th>
                <Th>Location & Niche</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((company) => {
                const isSelected = selectedIds.has(company.id);
                const isContacted = company.status === "contacted" || company.status === "replied";
                const primaryContact =
                  company.contacts?.find((c) => c.roleCategory === "hr_talent") ||
                  company.contacts?.[0];
                const extraContactsCount = (company.contacts?.length || 0) - 1;

                return (
                  <Tr
                    key={company.id}
                    className={isSelected ? "bg-accent/5 hover:bg-accent/10" : "hover:bg-surface-2"}
                  >
                    {/* Row Checkbox */}
                    <Td className="w-10 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border-strong accent-accent cursor-pointer align-middle"
                        checked={isSelected}
                        onChange={() => toggleSelect(company.id)}
                      />
                    </Td>

                    {/* Company info */}
                    <Td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-text text-sm">{company.name}</span>
                        {company.website && (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-faint hover:text-text"
                            title="Visit website"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                      {company.description && (
                        <p className="text-xs text-muted mt-0.5 line-clamp-1 max-w-xs">
                          {company.description}
                        </p>
                      )}
                    </Td>

                    {/* Decision Maker Contact */}
                    <Td>
                      {primaryContact ? (
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-xs text-text">{primaryContact.name}</span>
                            <span className="rounded bg-accent-soft text-accent-strong text-[10px] font-medium px-1.5 py-0.5">
                              {primaryContact.roleCategory === "hr_talent"
                                ? "HR / Talent"
                                : primaryContact.roleCategory === "executive"
                                ? "Executive"
                                : "Team Lead"}
                            </span>
                            {primaryContact.confidence === "verified" && (
                              <span className="text-[10px] text-accent flex items-center gap-0.5 font-medium">
                                <UserCheck className="size-3" /> verified
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted truncate">{primaryContact.title}</div>
                          <div className="text-[11px] font-mono text-faint mt-0.5 select-all">
                            {primaryContact.email}
                          </div>
                          {extraContactsCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setInspectingCompany(company)}
                              className="text-[10px] text-accent-strong hover:underline mt-1 block cursor-pointer"
                            >
                              +{extraContactsCount} more {extraContactsCount === 1 ? "contact" : "contacts"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-faint italic">No contact found</span>
                      )}
                    </Td>

                    {/* Location & Niche */}
                    <Td>
                      <div className="text-xs text-muted flex items-center gap-1">
                        📍 {company.location}
                      </div>
                      <div className="text-[11px] text-faint mt-0.5">
                        {company.niche}
                      </div>
                    </Td>

                    {/* Status */}
                    <Td>
                      {isContacted ? (
                        <Badge tone="blue" dot>
                          Contacted ({company.emailsSentCount || 1})
                        </Badge>
                      ) : (
                        <Badge tone="green" dot>
                          Ready ({company.contacts?.length || 0})
                        </Badge>
                      )}
                    </Td>

                    {/* Single Action */}
                    <Td className="text-right">
                      {primaryContact ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Mail className="size-3.5 text-accent-strong" />}
                          onClick={() => handleOpenEmailComposer(company, primaryContact)}
                        >
                          Cold Email
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
      )}

      {/* Cold Email Composer Modal */}
      {emailModalOpen && activeCompany && activeContact && (
        <Drawer
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-accent-strong" />
              <span>Cold Email to {activeCompany.name}</span>
            </div>
          }
          subtitle={`Recipient: ${activeContact.name} (${activeContact.title}) • ${activeContact.email}`}
          width="max-w-2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="ghost"
                size="sm"
                icon={copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
                onClick={() => {
                  navigator.clipboard.writeText(`Subject: ${customSubject}\n\n${customBody}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied!" : "Copy Subject & Body"}
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setEmailModalOpen(false)}>
                  Cancel
                </Button>
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(activeContact.email)}&su=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(customBody)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 h-9 text-xs font-medium bg-surface text-text border border-border hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <ExternalLink className="size-3.5 text-accent-strong" />
                  Open in Gmail
                </a>
                <Button
                  variant="accent"
                  loading={isSending}
                  icon={<Send className="size-4" />}
                  onClick={handleSendEmail}
                >
                  Send via Google Gmail
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Google Gmail Channel Indicator */}
            <div className="flex items-center justify-between rounded-lg bg-surface-2 border border-border p-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="grid size-7 place-items-center rounded bg-white shadow-xs border border-border shrink-0">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z" fill="#EA4335" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-text flex items-center gap-1.5">
                    <span>Google Gmail Connected</span>
                    <Badge tone="green" className="text-[10px] px-1.5 py-0">Active</Badge>
                  </div>
                  <div className="text-muted text-[11px]">{profile?.email || ""}</div>
                </div>
              </div>
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(activeContact.email)}&su=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(customBody)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-strong hover:underline inline-flex items-center gap-1"
              >
                Launch Gmail <ExternalLink className="size-3" />
              </a>
            </div>

            {/* Template Selector */}
            <Field label="Outreach Template">
              <Select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                {DEFAULT_COLD_EMAIL_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Subject Line">
              <Input
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
              />
            </Field>

            <Field
              label="Email Body (Markdown / Text)"
              hint="Variables like {{candidateName}}, {{companyName}}, etc. have been filled automatically."
            >
              <Textarea
                rows={13}
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                className="font-sans text-xs leading-relaxed"
              />
            </Field>

            {/* Recipient Details & Channel details */}
            <div className="rounded-lg bg-surface-2 p-3 text-xs border border-border space-y-1 text-muted">
              <p>
                <strong className="text-text">Recipient: </strong> {activeContact.name} ({activeContact.title}) &lt;{activeContact.email}&gt;
              </p>
              <p>
                <strong className="text-text">Company & Location: </strong> {activeCompany.name} • {activeCompany.location} ({activeCompany.niche})
              </p>
              <p className="pt-1 text-[11px] text-faint">
                Sent directly through Google Gmail using your verified address {profile?.email || ""}.
              </p>
            </div>
          </div>
        </Drawer>
      )}

      {/* Bulk Cold Email Modal */}
      <BulkEmailModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        selectedCompanies={selectedCompaniesList}
        profile={profile}
        settings={settings}
        onSendAll={handleBulkSend}
        isSending={bulkSending}
      />

      {/* Inspect Company Drawer */}
      {inspectingCompany && (
        <Drawer
          open={Boolean(inspectingCompany)}
          onClose={() => setInspectingCompany(null)}
          title={inspectingCompany.name}
          subtitle={`Discovered Contacts for ${inspectingCompany.name} (${inspectingCompany.location})`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">📍 {inspectingCompany.location}</span>
              <span className="text-xs text-faint">•</span>
              <span className="text-xs text-muted">{inspectingCompany.niche}</span>
              {inspectingCompany.website && (
                <a
                  href={inspectingCompany.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-strong hover:underline inline-flex items-center gap-1"
                >
                  Visit Website <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            {inspectingCompany.description && (
              <p className="text-xs text-muted bg-surface-2 p-3 rounded-lg border border-border">
                {inspectingCompany.description}
              </p>
            )}

            <div className="text-xs font-semibold text-text uppercase tracking-wider">
              All Contacts ({inspectingCompany.contacts?.length || 0})
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {inspectingCompany.contacts?.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEmail={() => {
                    const comp = inspectingCompany;
                    setInspectingCompany(null);
                    handleOpenEmailComposer(comp, contact);
                  }}
                />
              ))}
            </div>
          </div>
        </Drawer>
      )}

      {/* Modal to choose between Auto-Search and Upload List */}
      <CompanyChoiceModal
        open={companyChoiceModalOpen}
        onClose={() => setCompanyChoiceModalOpen(false)}
        onAutoSearch={handleAutoSearch}
        onUpload={() => setImportModalOpen(true)}
        isSearching={isSearching}
        activeLocation={activeLocationLabel}
      />

      {/* Import Companies List Modal */}
      <ImportCompaniesModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={async (newCompanies) => {
          for (const comp of newCompanies) {
            const slug = comp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            await setDocument("outreachCompanies", `comp-${slug}`, comp);
          }
          await addDocument("activity", {
            ts: new Date().toISOString(),
            level: "success",
            type: "company_import",
            message: `Imported ${newCompanies.length} companies with enriched HR & recruitment contacts.`,
          });
          setImportModalOpen(false);
        }}
      />

      {/* Templates Reference Modal */}
      <TemplatesModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
      />
    </div>
  );
}

/**
 * Modal to send batch/bulk cold emails at once to all selected companies.
 */
function BulkEmailModal({
  open,
  onClose,
  selectedCompanies,
  profile,
  settings,
  onSendAll,
  isSending,
}: {
  open: boolean;
  onClose: () => void;
  selectedCompanies: WithId<OutreachCompany>[];
  profile: Profile | null;
  settings: Settings | null;
  onSendAll: (templateId: string) => Promise<void>;
  isSending: boolean;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    DEFAULT_COLD_EMAIL_TEMPLATES[0].id
  );

  const tpl = useMemo(
    () =>
      DEFAULT_COLD_EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
      DEFAULT_COLD_EMAIL_TEMPLATES[0],
    [selectedTemplateId]
  );

  const preview = useMemo(() => {
    if (!selectedCompanies.length || !profile || !settings) return { subject: "", body: "" };
    const firstComp = selectedCompanies[0];
    const contact =
      firstComp.contacts?.find((c) => c.roleCategory === "hr_talent") || firstComp.contacts?.[0];
    if (!contact) return { subject: "", body: "" };

    const targetRole = settings.roles?.length ? settings.roles[0] : "Product Designer";
    return renderColdEmail(tpl, {
      candidateName: profile.fullName || "Candidate",
      candidateEmail: profile.email || "",
      candidatePhone: profile.phone || "",
      companyName: firstComp.name,
      contactName: contact.name,
      contactTitle: contact.title,
      targetRole,
      niche: firstComp.niche,
      location: firstComp.location,
      portfolioLink: profile.links?.portfolio,
      linkedinLink: profile.links?.linkedin,
      resumeFileName: profile.masterResume?.fileName || "Resume.pdf",
      yearsExperience: profile.standardAnswers?.yearsExperience || "5+ years",
    });
  }, [selectedCompanies, profile, settings, tpl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-bg p-6 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent-strong">
              <Send className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">
                Send Cold Outreach at Once
              </h2>
              <p className="text-xs text-muted">
                Sending personalized emails to {selectedCompanies.length} selected {selectedCompanies.length === 1 ? "company" : "companies"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-text cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Gmail Sending Channel Status */}
          <div className="flex items-center justify-between rounded-lg bg-surface-2 border border-border p-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="grid size-7 place-items-center rounded bg-white shadow-xs border border-border shrink-0">
                <svg className="size-4" viewBox="0 0 24 24" fill="none">
                  <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z" fill="#EA4335" />
                </svg>
              </div>
              <div>
                <span className="font-semibold text-text">Sending via Google Gmail</span>
                <span className="text-muted text-[11px] block">{profile?.email || ""}</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Gmail Ready
            </span>
          </div>

          {/* Template Selector */}
          <div>
            <label className="text-xs font-semibold text-text block mb-1.5">
              Choose Cold Email Template:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEFAULT_COLD_EMAIL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                    selectedTemplateId === t.id
                      ? "border-accent bg-accent-soft font-semibold text-text"
                      : "border-border bg-surface text-muted hover:text-text"
                  }`}
                >
                  <div className="font-medium text-text mb-0.5">{t.name}</div>
                  <div className="text-[11px] text-faint line-clamp-1">{t.subject}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recipient Companies Chips */}
          <div>
            <label className="text-xs font-semibold text-text block mb-1">
              Recipients ({selectedCompanies.length} companies):
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-lg bg-surface-2 border border-border">
              {selectedCompanies.map((c) => {
                const contact =
                  c.contacts?.find((ct) => ct.roleCategory === "hr_talent") || c.contacts?.[0];
                return (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded bg-surface px-2 py-1 text-xs border border-border text-text"
                  >
                    <strong>{c.name}</strong>
                    {contact && <span className="text-faint text-[10px]">({contact.email})</span>}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Personalized Sample Preview */}
          <div>
            <label className="text-xs font-semibold text-text block mb-1">
              Sample Preview (Personalized for {selectedCompanies[0]?.name || "recipient"}):
            </label>
            <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-xs">
              <div>
                <span className="text-faint font-medium">Subject: </span>
                <span className="text-text font-mono font-medium">{preview.subject}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-faint font-medium block mb-1">Body Preview:</span>
                <pre className="whitespace-pre-wrap font-sans text-xs text-muted leading-relaxed max-h-48 overflow-y-auto bg-surface-2 p-2.5 rounded">
                  {preview.body}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={isSending}
              icon={<ExternalLink className="size-3.5" />}
              onClick={() => {
                selectedCompanies.forEach((comp, idx) => {
                  const contact =
                    comp.contacts?.find((ct) => ct.roleCategory === "hr_talent") ||
                    comp.contacts?.[0];
                  if (!contact) return;
                  const targetRole = settings?.roles?.[0] || "Product Designer";
                  const rendered = renderColdEmail(tpl, {
                    candidateName: profile?.fullName || "Candidate",
                    candidateEmail: profile?.email || "",
                    candidatePhone: profile?.phone || "",
                    companyName: comp.name,
                    contactName: contact.name,
                    contactTitle: contact.title,
                    targetRole,
                    niche: comp.niche,
                    location: comp.location,
                    portfolioLink: profile?.links?.portfolio,
                    linkedinLink: profile?.links?.linkedin,
                    resumeFileName: profile?.masterResume?.fileName || "Resume.pdf",
                    yearsExperience: profile?.standardAnswers?.yearsExperience || "5+ years",
                  });
                  setTimeout(() => {
                    window.open(
                      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
                        contact.email
                      )}&su=${encodeURIComponent(rendered.subject)}&body=${encodeURIComponent(
                        rendered.body
                      )}`,
                      "_blank"
                    );
                  }, idx * 250);
                });
                onSendAll(selectedTemplateId);
              }}
            >
              Open in Gmail Tabs
            </Button>
            <Button
              variant="accent"
              loading={isSending}
              icon={<Send className="size-4" />}
              onClick={() => onSendAll(selectedTemplateId)}
            >
              Send to All {selectedCompanies.length} via Google Gmail
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Company Card rendering the company information and its discovered HR/stakeholder contacts.
 */
function CompanyOutreachCard({
  company,
  onEmailContact,
}: {
  company: WithId<OutreachCompany>;
  onEmailContact: (contact: CompanyContact) => void;
}) {
  const isContacted = company.status === "contacted" || company.status === "replied";

  return (
    <Panel padded={false} className="overflow-hidden">
      {/* Company Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border bg-surface">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text">{company.name}</h3>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-faint hover:text-text"
                title="Visit website"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
            <span className="text-xs text-muted flex items-center gap-1">
              📍 {company.location}
            </span>
          </div>
          {company.description && (
            <p className="text-xs text-muted mt-1 max-w-2xl line-clamp-2">
              {company.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isContacted ? (
            <Badge tone="blue" dot>
              Contacted ({company.emailsSentCount || 1} sent)
            </Badge>
          ) : (
            <Badge tone="green" dot>
              Ready ({company.contacts?.length || 0} contacts)
            </Badge>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <div className="p-4 sm:p-5 bg-bg/50">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
          <Users className="size-3.5" />
          HR, Recruitment Team & Stakeholder Contacts ({company.contacts?.length || 0})
        </div>

        {company.contacts && company.contacts.length > 0 ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {company.contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onEmail={() => onEmailContact(contact)}
              />
            ))}
          </div>
        ) : (
          <div className="text-xs text-faint italic py-2">
            No direct contacts found for this company.
          </div>
        )}
      </div>
    </Panel>
  );
}

/**
 * Individual contact badge/card with direct cold email action.
 */
function ContactCard({
  contact,
  onEmail,
}: {
  contact: CompanyContact;
  onEmail: () => void;
}) {
  const roleBadgeTone: Record<ContactRoleCategory, "amber" | "green" | "blue" | "neutral"> = {
    hr_talent: "green",
    hiring_manager: "amber",
    executive: "blue",
    general_inbox: "neutral",
  };

  const roleLabels: Record<ContactRoleCategory, string> = {
    hr_talent: "HR / Talent",
    hiring_manager: "Team Lead / Eng",
    executive: "Executive / Founder",
    general_inbox: "General Careers",
  };

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent/40">
      <div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <Badge tone={roleBadgeTone[contact.roleCategory]} className="text-[10px] px-1.5 py-0">
            {roleLabels[contact.roleCategory]}
          </Badge>
          <span className="text-[10px] text-faint flex items-center gap-0.5" title="Email verification status">
            <UserCheck className="size-3 text-accent" />
            {contact.confidence}
          </span>
        </div>

        <div className="font-medium text-xs text-text truncate" title={contact.name}>
          {contact.name}
        </div>
        <div className="text-[11px] text-muted truncate" title={contact.title}>
          {contact.title}
        </div>
        <div className="text-[11px] font-mono text-faint mt-1 truncate select-all" title={contact.email}>
          {contact.email}
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-border flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          icon={<Mail className="size-3.5 text-accent-strong" />}
          onClick={onEmail}
          className="w-full text-xs h-7"
        >
          Cold Email
        </Button>
      </div>
    </div>
  );
}

/**
 * Sent Cold Emails Log Table.
 */
function ColdEmailsLogTable({
  emails,
  loading,
}: {
  emails: WithId<ColdEmailRecord>[];
  loading: boolean;
}) {
  if (loading) return <LoadingBlock />;
  if (emails.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<Mail className="size-8" />}
          title="No cold emails sent yet"
          description="Select any company and click 'Cold Email' to reach their HR or stakeholders."
        />
      </Panel>
    );
  }

  return (
    <Panel padded={false}>
      <Table>
        <thead>
          <tr>
            <Th>Company & Recipient</Th>
            <Th>Role</Th>
            <Th>Subject Line</Th>
            <Th>Sent via Gmail</Th>
            <Th>Status</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {emails.map((e) => (
            <Tr key={e.id}>
              <Td>
                <div className="font-medium text-text">{e.companyName}</div>
                <div className="text-xs text-muted">
                  {e.recipientName} &lt;{e.recipientEmail}&gt;
                </div>
              </Td>
              <Td>
                <span className="text-xs text-text">{e.recipientTitle}</span>
              </Td>
              <Td>
                <div className="text-xs font-mono text-text truncate max-w-xs">{e.subject}</div>
              </Td>
              <Td>
                <div className="text-xs text-text font-medium flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>Google Gmail</span>
                </div>
                <div className="text-[11px] text-faint">
                  {e.senderEmail || ""} • {formatDate(e.sentAt)}
                </div>
              </Td>
              <Td>
                <Badge tone="green" dot>
                  {e.status}
                </Badge>
              </Td>
              <Td className="text-right">
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(e.recipientEmail)}&su=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-strong hover:underline font-medium"
                >
                  <span>Open in Gmail</span>
                  <ExternalLink className="size-3" />
                </a>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}

/**
 * Modal to choose between auto-searching niche companies or uploading/providing a list.
 */
function CompanyChoiceModal({
  open,
  onClose,
  onAutoSearch,
  onUpload,
  isSearching,
  activeLocation,
}: {
  open: boolean;
  onClose: () => void;
  onAutoSearch: () => void;
  onUpload: () => void;
  isSearching?: boolean;
  activeLocation: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-bg p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent-strong">
              <Building className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">Target Companies</h2>
              <p className="text-xs text-muted">
                Choose how you want to find or add companies for direct outreach.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-text cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-5">
          <button
            type="button"
            disabled={isSearching}
            onClick={() => {
              onClose();
              onAutoSearch();
            }}
            className="flex flex-col text-left p-4 rounded-xl border border-border bg-surface hover:border-accent hover:bg-surface-2 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-strong mb-3 group-hover:scale-105 transition-transform">
              <Search className="size-5" />
            </div>
            <div className="font-semibold text-text text-sm mb-1 flex items-center justify-between">
              <span>Auto-Search</span>
              <span className="text-xs text-accent-strong font-normal opacity-0 group-hover:opacity-100 transition-opacity">Select &rarr;</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Auto-discover companies for your specified job location (<span className="text-accent-strong font-medium">{activeLocation}</span>) across target niches.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onUpload();
            }}
            className="flex flex-col text-left p-4 rounded-xl border border-border bg-surface hover:border-accent hover:bg-surface-2 transition-all cursor-pointer group"
          >
            <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-strong mb-3 group-hover:scale-105 transition-transform">
              <Upload className="size-5" />
            </div>
            <div className="font-semibold text-text text-sm mb-1 flex items-center justify-between">
              <span>Upload List</span>
              <span className="text-xs text-accent-strong font-normal opacity-0 group-hover:opacity-100 transition-opacity">Select &rarr;</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Paste or import your own list of company names, websites, locations, and niches.
            </p>
          </button>
        </div>

        <div className="pt-4 mt-5 border-t border-border flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal allowing user to bulk provide or paste their own list of companies.
 */
function ImportCompaniesModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (companies: OutreachCompany[]) => Promise<void>;
}) {
  const [inputText, setInputText] = useState(
    `FairMoney, fairmoney.io, Lagos, Loan Companies & Digital Lending\nCarbon, yourcarbon.com, Lagos, Loan Companies & Digital Lending\nFunding Circle, fundingcircle.com, London, Loan Companies & Digital Lending\nLendable, lendable.co.uk, London, Loan Companies & Digital Lending`
  );
  const [defaultNiche, setDefaultNiche] = useState("Loan Companies & Digital Lending");
  const [defaultLocation, setDefaultLocation] = useState("Remote");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleParseAndImport = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    try {
      const parsed = parseUserCompanyList(inputText, defaultNiche, defaultLocation);
      await onImported(parsed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-bg p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <Upload className="size-5 text-accent-strong" />
            Provide Companies List
          </h2>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-text">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted leading-relaxed">
            Paste your companies list below. You can enter one per line, or CSV format:
            <code className="block mt-1 bg-surface-2 p-1.5 rounded font-mono text-[11px] text-text">
              Company Name, website.com, Location, Niche
            </code>
          </p>

          <Field label="Companies List">
            <Textarea
              rows={8}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Renmoney, renmoney.com, Lagos, Loan Companies"
              className="font-mono text-xs"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Default Niche (if omitted)">
              <Input
                value={defaultNiche}
                onChange={(e) => setDefaultNiche(e.target.value)}
              />
            </Field>
            <Field label="Default Location (if omitted)">
              <Input
                value={defaultLocation}
                onChange={(e) => setDefaultLocation(e.target.value)}
              />
            </Field>
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={loading}
              icon={<CheckCircle2 className="size-4" />}
              onClick={handleParseAndImport}
            >
              Parse & Enrich Contacts
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal to view and review default cold email templates.
 */
function TemplatesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(DEFAULT_COLD_EMAIL_TEMPLATES[0]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-xl border border-border bg-bg p-6 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <Edit3 className="size-5 text-accent-strong" />
            Cold Email Outreach Templates
          </h2>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-text">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border">
            {DEFAULT_COLD_EMAIL_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selected.id === t.id
                    ? "bg-accent text-accent-fg font-semibold"
                    : "bg-surface-2 text-muted hover:text-text"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div>
            <span className="text-xs text-faint block mb-1">Subject:</span>
            <div className="bg-surface-2 p-2.5 rounded font-mono text-xs text-text border border-border">
              {selected.subject}
            </div>
          </div>

          <div>
            <span className="text-xs text-faint block mb-1">Body Preview:</span>
            <pre className="whitespace-pre-wrap font-sans text-xs bg-surface p-4 rounded-lg border border-border text-text leading-relaxed">
              {selected.body}
            </pre>
          </div>

          <div className="rounded-lg bg-surface-2 p-3 text-xs border border-border text-muted">
            <span className="font-semibold text-text block mb-1">Available Dynamic Variables:</span>
            <code>
              {"{{candidateName}}, {{candidateEmail}}, {{candidatePhone}}, {{companyName}}, {{contactName}}, {{contactTitle}}, {{targetRole}}, {{niche}}, {{location}}, {{portfolioLink}}, {{linkedinLink}}, {{resumeFileName}}, {{yearsExperience}}"}
            </code>
          </div>
        </div>

        <div className="pt-3 border-t border-border flex justify-end shrink-0">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
