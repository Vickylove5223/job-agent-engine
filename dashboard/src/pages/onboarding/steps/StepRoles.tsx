import { Plus } from "lucide-react";
import { Field, Input, TagInput } from "@/components/ui";
import { ROLE_SUGGESTIONS, SENIORITY_OPTIONS } from "../draft";
import { Group, Label, Pills, type StepProps } from "../bits";

export function StepRoles({ draft, set }: StepProps) {
  const suggestions = ROLE_SUGGESTIONS.filter((r) => !draft.roles.some((x) => x.toLowerCase() === r.toLowerCase()));
  return (
    <Group className="space-y-7">
      <div>
        <Label hint="Type a job title and press Enter, or pick from the suggestions.">Job titles</Label>
        <TagInput value={draft.roles} onChange={(roles) => set({ roles })} placeholder={draft.roles.length ? "Add another…" : "e.g. Product Designer"} />
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set({ roles: [...draft.roles, r] })}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[13px] text-muted hover:border-border-strong hover:text-text cursor-pointer transition-colors"
              >
                <Plus className="size-3" />
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label hint="Pick every level you'd accept.">Seniority</Label>
        <Pills options={SENIORITY_OPTIONS} value={draft.seniority} onChange={(seniority) => set({ seniority })} />
      </div>
      <Field label="Years of experience" className="max-w-40">
        <Input type="number" min={0} max={50} inputMode="numeric" value={draft.yearsExperience} onChange={(e) => set({ yearsExperience: e.target.value })} placeholder="5" />
      </Field>
      <div>
        <Label hint="Skills the job should mention. Jobs that match more of these rank higher.">Include keywords <span className="text-faint font-normal">(optional)</span></Label>
        <TagInput value={draft.includeKeywords} onChange={(includeKeywords) => set({ includeKeywords })} placeholder="e.g. Figma, design systems" />
      </div>
      <div>
        <Label hint="Jobs mentioning these are skipped.">Exclude keywords <span className="text-faint font-normal">(optional)</span></Label>
        <TagInput value={draft.excludeKeywords} onChange={(excludeKeywords) => set({ excludeKeywords })} placeholder="e.g. unpaid, commission only" />
      </div>
    </Group>
  );
}
