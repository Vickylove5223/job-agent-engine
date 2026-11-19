import { CheckCircle2, FileText, Sparkles } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { COUNTRIES } from "@shared/sites";
import { currencyForCountry } from "../draft";
import { Group, type StepProps } from "../bits";
import { useAuth } from "@/lib/auth";

export function StepConfirmProfile({ draft, set }: StepProps) {
  const { user } = useAuth();

  return (
    <Group className="space-y-6">
      {/* Success banner confirming extraction */}
      <div className="rounded-lg border border-success/30 bg-success-soft p-3.5 text-sm flex items-center gap-2.5 text-success">
        <CheckCircle2 className="size-5 shrink-0" />
        <span className="font-medium">
          Profile details automatically extracted! Review and confirm below:
        </span>
      </div>

      {/* Main Extracted Profile Card */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <Sparkles className="size-4 text-accent-strong" />
            Extracted Profile Details
          </div>
          {draft.resume && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <FileText className="size-3.5 text-accent-strong" />
              <span>Parsed from {draft.resume.fileName}</span>
            </div>
          )}
        </div>

        {/* Full Name & Contact Email */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name *">
            <Input
              value={draft.fullName}
              onChange={(e) => set({ fullName: e.target.value })}
              placeholder="e.g. Ada Okafor"
            />
          </Field>

          <Field label="Contact Email" hint="Prefilled from your account or resume">
            <Input
              type="email"
              value={draft.fullName ? user?.email ?? "" : ""}
              readOnly
              disabled
              className="bg-surface-2 text-muted"
            />
          </Field>
        </div>

        {/* Professional Headline */}
        <Field label="Professional Headline" hint="Recruiters and hiring managers see this first">
          <Input
            value={draft.headline}
            onChange={(e) => set({ headline: e.target.value })}
            placeholder="e.g. Senior Frontend Engineer with 6+ years building React apps"
          />
        </Field>

        {/* Phone, Country, City */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Phone number">
            <Input
              type="tel"
              value={draft.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="+1 555 123 4567"
            />
          </Field>

          <Field label="Country you live in">
            <Select
              value={draft.country}
              onChange={(e) => {
                const code = e.target.value;
                set({ country: code, currency: currencyForCountry(code) });
              }}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="City">
            <Input
              value={draft.city}
              onChange={(e) => set({ city: e.target.value })}
              placeholder="e.g. San Francisco or Lagos"
            />
          </Field>
        </div>

        {/* LinkedIn & Detected Primary Roles */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LinkedIn Profile URL (optional)">
            <Input
              type="url"
              value={draft.linkedin}
              onChange={(e) => set({ linkedin: e.target.value })}
              placeholder="https://linkedin.com/in/username"
            />
          </Field>

          <Field
            label="Detected Primary Roles"
            hint="You will confirm & refine targeting in the next step"
          >
            <Input
              value={draft.roles.join(", ")}
              onChange={(e) =>
                set({
                  roles: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="e.g. Product Designer, WordPress Specialist"
            />
          </Field>
        </div>

        {/* Detected Key Skills */}
        {draft.includeKeywords.length > 0 && (
          <div className="pt-2">
            <div className="text-xs font-medium text-muted mb-2">Detected Key Skills:</div>
            <div className="flex flex-wrap gap-1.5">
              {draft.includeKeywords.slice(0, 12).map((sk, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-surface-2 text-text border border-border"
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Extracted Professional Summary (if available) */}
        {draft.extractedSummary && (
          <Field label="Extracted Professional Summary">
            <Textarea
              value={draft.extractedSummary}
              onChange={(e) => set({ extractedSummary: e.target.value })}
              rows={3}
              className="text-xs"
            />
          </Field>
        )}
      </div>
    </Group>
  );
}
