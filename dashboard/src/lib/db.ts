// Data layer. Pages use ONLY the hooks + mutation helpers exported here.
// Two backends behind one interface:
//   - firebase: Firestore with realtime listeners (production + dev)
//   - local:    dev-only JSON file served by the Vite plugin in dev/localDb.ts
import { useEffect, useState } from "react";
import type { CollectionName, Collections, WithId } from "@shared/types";
import { firebaseBackend, isFirebaseConfigured } from "./firebase";

export type Unsub = () => void;
export interface QueryOpts {
  orderBy?: string;
  desc?: boolean;
  limit?: number;
}

export interface Backend {
  kind: "firebase" | "local";
  subscribeCollection<K extends CollectionName>(col: K, opts: QueryOpts, cb: (docs: WithId<Collections[K]>[]) => void): Unsub;
  subscribeDoc<K extends CollectionName>(col: K, id: string, cb: (doc: WithId<Collections[K]> | null) => void): Unsub;
  set<K extends CollectionName>(col: K, id: string, data: Collections[K]): Promise<void>;
  update<K extends CollectionName>(col: K, id: string, data: Partial<Collections[K]>): Promise<void>;
  add<K extends CollectionName>(col: K, data: Collections[K]): Promise<string>;
  remove(col: CollectionName, id: string): Promise<void>;
}

// ---------- local backend (dev only) ----------
type LocalDb = Record<string, Record<string, Record<string, unknown>>>;

function createLocalBackend(): Backend {
  let cache: LocalDb | null = null;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const dbUrl = (p: string) => (typeof window !== "undefined" ? p : `http://127.0.0.1:5180${p}`);

  const refresh = async () => {
    try {
      const res = await fetch(dbUrl("/__db"));
      cache = await res.json();
      listeners.forEach((l) => l());
    } catch {}
  };
  const ensurePolling = () => {
    if (timer) return;
    refresh();
    timer = setInterval(refresh, 3000);
  };
  const listen = (fn: () => void): Unsub => {
    listeners.add(fn);
    ensurePolling();
    if (cache) fn();
    return () => listeners.delete(fn);
  };
  const mutate = async (method: string, col: string, id: string, body?: unknown) => {
    // optimistic
    if (cache) {
      cache[col] ??= {};
      if (method === "PUT") cache[col][id] = body as Record<string, unknown>;
      if (method === "PATCH") cache[col][id] = { ...(cache[col][id] ?? {}), ...(body as object) };
      if (method === "DELETE") delete cache[col][id];
      listeners.forEach((l) => l());
    }
    try {
      await fetch(dbUrl(`/__db/${encodeURIComponent(col)}/${encodeURIComponent(id)}`), {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {}
  };

  return {
    kind: "local",
    subscribeCollection(col, opts, cb) {
      return listen(() => {
        let docs = Object.entries(cache?.[col] ?? {}).map(([id, d]) => ({ ...(d as object), id })) as WithId<Collections[typeof col]>[];
        docs = sortAndLimit(docs, opts);
        cb(docs);
      });
    },
    subscribeDoc(col, id, cb) {
      return listen(() => {
        const d = cache?.[col]?.[id];
        cb(d ? ({ ...(d as object), id } as WithId<Collections[typeof col]>) : null);
      });
    },
    set: (col, id, data) => mutate("PUT", col, id, data),
    update: (col, id, data) => mutate("PATCH", col, id, data),
    async add(col, data) {
      const id = `${col.slice(0, 2)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await mutate("PUT", col, id, data);
      return id;
    },
    remove: (col, id) => mutate("DELETE", col, id),
  };
}

export function sortAndLimit<T>(docs: T[], opts: QueryOpts): T[] {
  let out = docs;
  if (opts.orderBy) {
    const k = opts.orderBy as keyof T;
    out = [...out].sort((a, b) => {
      const av = a[k] as unknown as string | number;
      const bv = b[k] as unknown as string | number;
      if (av === bv) return 0;
      const r = av > bv ? 1 : -1;
      return opts.desc ? -r : r;
    });
  }
  if (opts.limit) out = out.slice(0, opts.limit);
  return out;
}

const dataBackend = typeof import.meta !== "undefined" ? import.meta.env.VITE_DATA_BACKEND : (typeof process !== "undefined" ? process.env?.VITE_DATA_BACKEND : undefined);
const wantLocal = !isFirebaseConfigured || dataBackend === "local";
export const backend: Backend = wantLocal ? createLocalBackend() : firebaseBackend();

// ---------- hooks ----------
export function useCollection<K extends CollectionName>(col: K, opts: QueryOpts = {}) {
  const [data, setData] = useState<WithId<Collections[K]>[]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(opts);
  useEffect(() => {
    setLoading(true);
    return backend.subscribeCollection(col, JSON.parse(key) as QueryOpts, (docs) => {
      setData(docs);
      setLoading(false);
    });
  }, [col, key]);
  return { data, loading };
}

export function useDoc<K extends CollectionName>(col: K, id: string | undefined) {
  const [data, setData] = useState<WithId<Collections[K]> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return backend.subscribeDoc(col, id, (d) => {
      setData(d);
      setLoading(false);
    });
  }, [col, id]);
  return { data, loading };
}

export function getCollectionOnce<K extends CollectionName>(col: K): Promise<WithId<Collections[K]>[]> {
  return new Promise((resolve) => {
    const unsub = backend.subscribeCollection(col, {}, (docs) => {
      unsub();
      resolve(docs);
    });
  });
}
export const getCollection = getCollectionOnce;

// ---------- mutations ----------
export const setDocument = <K extends CollectionName>(col: K, id: string, data: Collections[K]) => backend.set(col, id, data);
export const updateDocument = <K extends CollectionName>(col: K, id: string, data: Partial<Collections[K]>) => backend.update(col, id, data);
export const addDocument = <K extends CollectionName>(col: K, data: Collections[K]) => backend.add(col, data);
export const deleteDocument = (col: CollectionName, id: string) => backend.remove(col, id);

export const nowIso = () => new Date().toISOString();

/** Append an entry to the activity log. */
export function logActivity(level: "info" | "success" | "warn" | "error", type: string, message: string, jobId?: string) {
  return addDocument("activity", { ts: nowIso(), level, type, message, jobId });
}
