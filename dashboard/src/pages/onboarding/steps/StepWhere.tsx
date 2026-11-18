import { Globe2 } from "lucide-react";
import { countryName } from "@shared/sites";
import { Field, Input, Switch, TagInput } from "@/components/ui";
import { WORK_MODE_OPTIONS, onlyRemote } from "../draft";
import { Group, Label, Pills, type StepProps } from "../bits";
import { CountryPicker } from "./CountryPicker";

export function StepWhere({ draft, set }: StepProps) {
  const abroad = draft.countries.filter((c) => c !== draft.country);
  const remoteOnly = onlyRemote(draft);
  const home = draft.country ? countryName(draft.country) : "your country";

  return (
    <Group className="space-y-7">
      <div>
        <Label>How do you want to work?</Label>
        <Pills options={WORK_MODE_OPTIONS} value={draft.workModes} onChange={(workModes) => set({ workModes })} />
      </div>

      <div>
        <Label hint={remoteOnly ? "Optional for remote-only: pick countries whose employers you'd like to target." : "We'll use job boards that cover these countries."}>
          Countries
        </Label>
        <CountryPicker value={draft.countries} onChange={(countries) => set({ countries })} />
      </div>

      <div>
        <Label hint="Leave empty to search the whole country.">Cities or regions <span className="text-faint font-normal">(optional)</span></Label>
        <TagInput value={draft.cities} onChange={(cities) => set({ cities })} placeholder="e.g. Lagos, Abuja" />
      </div>

      {abroad.length > 0 ? (
        <div className="rounded-lg border border-info/30 bg-info-soft p-4">
          <div className="flex items-start gap-3">
            <Globe2 className="size-5 shrink-0 text-info mt-0.5" />
            <div className="flex-1 space-y-3">
              <div className="text-sm">
                You picked {abroad.map(countryName).join(", ")} — outside {home}. Employers there often ask about visas.
              </div>
              <Switch checked={draft.sponsorship} onChange={(sponsorship) => set({ sponsorship })} label="I need visa sponsorship" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <Switch checked={draft.relocate} onChange={(relocate) => set({ relocate })} label="Open to relocating" />
        {abroad.length === 0 && (
          <div><Switch checked={draft.sponsorship} onChange={(sponsorship) => set({ sponsorship })} label="I need visa sponsorship" /></div>
        )}
      </div>

      <Field label="Work authorization" hint="Used to answer “Are you authorized to work in…?” questions.">
        <Input
          value={draft.workAuthorization}
          onChange={(e) => set({ workAuthorization: e.target.value })}
          placeholder={draft.country ? `e.g. ${countryName(draft.country)} citizen; authorized to work in ${countryName(draft.country)}` : "e.g. Nigerian citizen; authorized to work in Nigeria"}
        />
      </Field>
    </Group>
  );
}
