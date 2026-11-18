import { Field, Input, Select } from "@/components/ui";
import { CURRENCIES, JOB_TYPE_OPTIONS, formatMoney, yearlySalary } from "../draft";
import { Group, Label, Pills, type StepProps } from "../bits";

export function StepPay({ draft, set }: StepProps) {
  const yearly = yearlySalary(draft);
  return (
    <Group className="space-y-7">
      <div>
        <Label hint="Jobs that clearly pay less are skipped. Leave empty if you're flexible.">Minimum salary <span className="text-faint font-normal">(optional)</span></Label>
        <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_7rem_9rem]">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.minSalary}
            onChange={(e) => set({ minSalary: e.target.value })}
            placeholder={draft.period === "month" ? "2500" : "30000"}
            className="col-span-2 sm:col-span-1"
          />
          <Select value={draft.currency} onChange={(e) => set({ currency: e.target.value, currencyTouched: true })} aria-label="Currency">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={draft.period} onChange={(e) => set({ period: e.target.value as "year" | "month" })} aria-label="Period">
            <option value="year">per year</option>
            <option value="month">per month</option>
          </Select>
        </div>
        {yearly !== null && draft.period === "month" && (
          <div className="mt-1.5 text-xs text-faint">≈ {formatMoney(draft.currency, yearly)} per year</div>
        )}
      </div>

      <div>
        <Label>Job types</Label>
        <Pills options={JOB_TYPE_OPTIONS} value={draft.jobTypes} onChange={(jobTypes) => set({ jobTypes })} />
      </div>

      <Field label="Notice period / earliest start" hint="e.g. 2 weeks, 1 month, Immediately" className="max-w-sm">
        <Input value={draft.noticePeriod} onChange={(e) => set({ noticePeriod: e.target.value })} placeholder="2 weeks" />
      </Field>
    </Group>
  );
}
