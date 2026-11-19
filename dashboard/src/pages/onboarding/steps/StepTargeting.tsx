import { Globe2, MapPin, Plus } from "lucide-react";
import { countryName } from "@shared/sites";
import { Field, Input, Select, Switch, TagInput } from "@/components/ui";
import {
  CURRENCIES,
  JOB_TYPE_OPTIONS,
  ROLE_SUGGESTIONS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS,
  onlyRemote,
  formatMoney,
  yearlySalary,
} from "../draft";
import { Group, Label, Pills, type StepProps } from "../bits";
import { CountryPicker } from "./CountryPicker";

export function StepTargeting({ draft, set }: StepProps) {
  const remoteOnly = onlyRemote(draft);
  const abroad = draft.countries.filter((c) => c !== draft.country);
  const home = draft.country ? countryName(draft.country) : "your home country";
  const yearly = yearlySalary(draft);

  const suggestions = ROLE_SUGGESTIONS.filter(
    (r) => !draft.roles.some((x) => x.toLowerCase() === r.toLowerCase()),
  );

  return (
    <Group className="space-y-8">
      {/* 1. Target Roles */}
      <div className="space-y-3">
        <Label hint="Confirm or add the exact job titles you want to search and apply for.">
          Target Roles <span className="text-danger">*</span>
        </Label>
        <TagInput
          value={draft.roles}
          onChange={(roles) => set({ roles })}
          placeholder={draft.roles.length ? "Add another role title…" : "e.g. Frontend Developer"}
        />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {suggestions.slice(0, 8).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set({ roles: [...draft.roles, r] })}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted hover:border-border-strong hover:text-text cursor-pointer transition-colors"
              >
                <Plus className="size-3" />
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Role Level / Seniority */}
      <div className="grid gap-5 sm:grid-cols-2 items-start">
        <div className="space-y-2">
          <Label hint="Select all seniority levels you would accept.">Role Level <span className="text-danger">*</span></Label>
          <Pills
            options={SENIORITY_OPTIONS}
            value={draft.seniority}
            onChange={(seniority) => set({ seniority })}
          />
        </div>

        <Field label="Years of Experience" className="max-w-44">
          <Input
            type="number"
            min={0}
            max={50}
            value={draft.yearsExperience}
            onChange={(e) => set({ yearsExperience: e.target.value })}
            placeholder="4"
          />
        </Field>
      </div>

      <div className="border-t border-border pt-6 space-y-6">
        <div>
          <div className="text-base font-semibold flex items-center gap-2">
            <MapPin className="size-4.5 text-accent-strong" />
            Where do you want to apply?
          </div>
          <p className="text-xs text-muted mt-0.5">
            The agent will strictly search and apply only to opportunities matching these locations.
          </p>
        </div>

        {/* Work Mode */}
        <div className="space-y-2">
          <Label>Work Arrangement</Label>
          <Pills
            options={WORK_MODE_OPTIONS}
            value={draft.workModes}
            onChange={(workModes) => set({ workModes })}
          />
        </div>

        {/* Countries */}
        <div className="space-y-2">
          <Label
            hint={
              remoteOnly
                ? "Optional for remote-only: specify countries whose companies you'd like to target."
                : "Countries you ONLY want to apply to. Jobs outside these countries are automatically skipped."
            }
          >
            Target Countries {remoteOnly ? <span className="text-faint">(Optional for Remote)</span> : <span className="text-danger">*</span>}
          </Label>
          <CountryPicker
            value={draft.countries}
            onChange={(countries) => set({ countries })}
          />
        </div>

        {/* Preferred Cities */}
        <div className="space-y-2">
          <Label hint="Leave blank to include all cities within your chosen countries.">
            Specific Cities or Metros <span className="text-faint font-normal">(optional)</span>
          </Label>
          <TagInput
            value={draft.cities}
            onChange={(cities) => set({ cities })}
            placeholder="e.g. New York, London, Berlin, Lagos"
          />
        </div>

        {/* Visa & Authorization */}
        {abroad.length > 0 ? (
          <div className="rounded-lg border border-info/30 bg-info-soft p-4">
            <div className="flex items-start gap-3">
              <Globe2 className="size-5 shrink-0 text-info mt-0.5" />
              <div className="flex-1 space-y-3">
                <div className="text-sm">
                  You selected {abroad.map(countryName).join(", ")} outside {home}.
                </div>
                <Switch
                  checked={draft.sponsorship}
                  onChange={(sponsorship) => set({ sponsorship })}
                  label="I will require visa sponsorship to work in these countries"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <Switch
              checked={draft.sponsorship}
              onChange={(sponsorship) => set({ sponsorship })}
              label="I will require visa sponsorship"
            />
            <Switch
              checked={draft.relocate}
              onChange={(relocate) => set({ relocate })}
              label="Open to relocating"
            />
          </div>
        )}

        <Field
          label="Work Authorization"
          hint="Used to prefill 'Are you legally authorized to work?' questions on forms."
        >
          <Input
            value={draft.workAuthorization}
            onChange={(e) => set({ workAuthorization: e.target.value })}
            placeholder={
              draft.country
                ? `e.g. Authorized to work in ${countryName(draft.country)}`
                : "e.g. Citizen / Permanent resident"
            }
          />
        </Field>
      </div>

      {/* 3. Compensation & Types */}
      <div className="border-t border-border pt-6 space-y-6">
        <div>
          <div className="text-base font-semibold">Compensation & Job Types</div>
          <p className="text-xs text-muted mt-0.5">Filter out listings that don't match your baseline requirements.</p>
        </div>

        <div>
          <div className="grid gap-4 sm:grid-cols-4 items-start">
            <Field
              label="Salary Expectation (optional)"
              hint="Minimum baseline to accept"
              className="sm:col-span-2"
            >
              <Input
                type="number"
                min={0}
                step={100}
                value={draft.minSalary}
                onChange={(e) => set({ minSalary: e.target.value })}
                placeholder={draft.period === "month" ? "e.g. 5,000" : "e.g. 80,000"}
              />
            </Field>

            <Field label="Currency">
              <Select
                value={draft.currency}
                onChange={(e) => set({ currency: e.target.value, currencyTouched: true })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>

            <Field label="Period">
              <Select
                value={draft.period}
                onChange={(e) => set({ period: e.target.value as "year" | "month" })}
              >
                <option value="year">Per year</option>
                <option value="month">Per month</option>
              </Select>
            </Field>
          </div>
          {yearly !== null && draft.period === "month" && (
            <div className="mt-2 text-xs text-muted">
              ≈ {formatMoney(draft.currency, yearly)} per year
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Job Types</Label>
          <Pills
            options={JOB_TYPE_OPTIONS}
            value={draft.jobTypes}
            onChange={(jobTypes) => set({ jobTypes })}
          />
        </div>
      </div>
    </Group>
  );
}
