import { useMemo, useState } from "react";
import { BookOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Fact, FactCategory, WithId } from "@shared/types";
import { addDocument, deleteDocument, nowIso, updateDocument, useCollection } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";
import { Badge, Button, EmptyState, Input, LoadingBlock, Panel, Select, Textarea, cx, type Tone } from "@/components/ui";

export const CATEGORIES: { value: FactCategory; label: string; tone: Tone }[] = [
  { value: "skill", label: "Skill", tone: "blue" },
  { value: "experience", label: "Experience", tone: "indigo" },
  { value: "preference", label: "Preference", tone: "green" },
  { value: "logistics", label: "Logistics", tone: "amber" },
  { value: "negative", label: "Doesn't have", tone: "red" },
  { value: "other", label: "Other", tone: "neutral" },
];
const catMeta = (c: FactCategory) => CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[5];

const SOURCES: { value: Fact["source"]; label: string }[] = [
  { value: "resume", label: "Resume" },
  { value: "portfolio", label: "Portfolio" },
  { value: "answer", label: "Answer" },
  { value: "manual", label: "Manual" },
];
const srcLabel = (s: Fact["source"]) => SOURCES.find((x) => x.value === s)?.label ?? s;

function CategorySelect({ value, onChange }: { value: FactCategory; onChange: (v: FactCategory) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as FactCategory)} className="sm:w-44">
      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
    </Select>
  );
}

function FactEditor({ initialText = "", initialCategory = "skill", submitLabel, onSubmit, onCancel }: {
  initialText?: string; initialCategory?: FactCategory; submitLabel: string;
  onSubmit: (text: string, category: FactCategory) => Promise<void>; onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [category, setCategory] = useState<FactCategory>(initialCategory);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSubmit(text.trim(), category);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); }
        if (e.key === "Escape") onCancel();
      }}
    >
      <Textarea autoFocus rows={2} className="min-h-16" placeholder="e.g. 3 years of production experience with React and TypeScript" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <CategorySelect value={category} onChange={setCategory} />
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => void submit()} loading={busy} disabled={!text.trim()}>{submitLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function FactRow({ fact }: { fact: WithId<Fact> }) {
  const [editing, setEditing] = useState(false);
  const cat = catMeta(fact.category);
  if (editing) {
    return (
      <div className="px-5 py-4 bg-surface-2/50">
        <FactEditor
          initialText={fact.text}
          initialCategory={fact.category}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async (text, category) => {
            await updateDocument("facts", fact.id, { text, category, updatedAt: nowIso() });
            setEditing(false);
          }}
        />
      </div>
    );
  }
  return (
    <div className="group flex items-start gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{fact.text}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={cat.tone}>{cat.label}</Badge>
          <Badge>{srcLabel(fact.source)}</Badge>
          <span className="text-xs text-faint ml-1" title={formatDateTime(fact.updatedAt)}>{timeAgo(fact.updatedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <button className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text cursor-pointer" aria-label="Edit fact" title="Edit" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </button>
        <button
          className="rounded p-1.5 text-muted hover:bg-danger-soft hover:text-danger cursor-pointer"
          aria-label="Delete fact"
          title="Delete"
          onClick={() => {
            if (window.confirm(`Delete this fact?\n\n"${fact.text}"\n\nThe agent will no longer use it.`)) void deleteDocument("facts", fact.id);
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function FactsTab() {
  const { data: facts, loading } = useCollection("facts", { orderBy: "updatedAt", desc: true });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FactCategory | "">("");
  const [source, setSource] = useState<Fact["source"] | "">("");
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<FactCategory, number>();
    for (const f of facts) m.set(f.category, (m.get(f.category) ?? 0) + 1);
    return m;
  }, [facts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return facts.filter(
      (f) => (!category || f.category === category) && (!source || f.source === source) && (!q || f.text.toLowerCase().includes(q)),
    );
  }, [facts, query, category, source]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory("")}
          className={cx(
            "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] cursor-pointer transition-colors",
            category === "" ? "border-text" : "border-border hover:border-border-strong",
          )}
        >
          <span className="text-muted">All</span>
          <span className="font-semibold tabular-nums">{facts.length}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(category === c.value ? "" : c.value)}
            className={cx(
              "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] cursor-pointer transition-colors",
              category === c.value ? "border-text" : "border-border hover:border-border-strong",
            )}
          >
            <span className="text-muted">{c.label}</span>
            <span className="font-semibold tabular-nums">{counts.get(c.value) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input className="pl-9" placeholder="Search facts" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select className="sm:w-44" value={category} onChange={(e) => setCategory(e.target.value as FactCategory | "")}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        <Select className="sm:w-40" value={source} onChange={(e) => setSource(e.target.value as Fact["source"] | "")}>
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)} disabled={adding}>Add fact</Button>
      </div>

      {adding && (
        <Panel>
          <FactEditor
            submitLabel="Add fact"
            onCancel={() => setAdding(false)}
            onSubmit={async (text, cat) => {
              const ts = nowIso();
              await addDocument("facts", { text, category: cat, source: "manual", createdAt: ts, updatedAt: ts });
              setAdding(false);
            }}
          />
        </Panel>
      )}

      <Panel padded={false}>
        {loading ? (
          <LoadingBlock />
        ) : facts.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-8" />}
            title="No facts yet"
            description="Facts come from your resume, your answers to questions, and anything you add here. The agent only claims what's in this list."
            action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add fact</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="size-8" />} title="No matching facts" description="Try a different search or clear the filters." />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((f) => <FactRow key={f.id} fact={f} />)}
          </div>
        )}
      </Panel>
      {!loading && facts.length > 0 && (
        <p className="text-xs text-faint">Showing {filtered.length} of {facts.length} facts</p>
      )}
    </div>
  );
}
