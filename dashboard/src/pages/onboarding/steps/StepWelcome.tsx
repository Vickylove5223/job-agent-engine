import { useState } from "react";
import { FileUp } from "lucide-react";
import { COUNTRIES } from "@shared/sites";
import { Button, Field, Input, Select } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { canImportSeed, importSeed } from "@/lib/seed";
import { currencyForCountry } from "../draft";
import { Group, type StepProps } from "../bits";

export function StepWelcome({ draft, set }: StepProps) {
  const { user } = useAuth();

  const changeCountry = (code: string) => {
    const prev = draft.country;
    const patch: Parameters<typeof set>[0] = { country: code };
    // Keep the "where to work" preselection in sync while the user hasn't customised it.
    if (draft.countries.length === 0 || (draft.countries.length === 1 && draft.countries[0] === prev)) patch.countries = code ? [code] : [];
    if (!draft.currencyTouched && code) patch.currency = currencyForCountry(code);
    set(patch);
  };

  return (
    <Group>
      <Field label="Full name">
        <Input autoFocus value={draft.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="Ada Okafor" autoComplete="name" />
      </Field>
      <Field label="Email" hint="From your account. You can change it later in your profile.">
        <Input value={user?.email ?? ""} readOnly disabled className="bg-surface-2 text-muted" />
      </Field>
      <Field label={<>Phone <span className="text-faint font-normal">(optional)</span></>}>
        <Input type="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+234 801 234 5678" autoComplete="tel" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Country you live in">
          <Select value={draft.country} onChange={(e) => changeCountry(e.target.value)}>
            <option value="">Select a country…</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={<>City <span className="text-faint font-normal">(optional)</span></>}>
          <Input value={draft.city} onChange={(e) => set({ city: e.target.value })} placeholder="Lagos" autoComplete="address-level2" />
        </Field>
      </div>
      {canImportSeed && <DevImport />}
    </Group>
  );
}

function DevImport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // Writes settings with onboardedAt — the app leaves the wizard on its own.
      await importSeed({ includeSamples: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <div className="mt-8 rounded-lg border border-dashed border-border-strong p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[13px] font-medium">Developer: import profile from local file</div>
          <div className="text-xs text-faint mt-0.5">Copies data/profile.local.json and skips this wizard. Dev server only.</div>
        </div>
        <Button type="button" size="sm" onClick={run} loading={busy} icon={<FileUp className="size-4" />}>Import</Button>
      </div>
      {error && <div className="mt-2 text-xs text-danger">{error}</div>}
    </div>
  );
}
