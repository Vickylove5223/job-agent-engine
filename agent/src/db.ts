// Firestore access for the agent (Admin SDK — bypasses rules; scoped per user here).
// Credentials: FIREBASE_SERVICE_ACCOUNT (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path).
// Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 to run against the local emulator.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { CollectionName, Collections, WithId } from "@shared/types";

let fs: Firestore | null = null;
export function firestore(): Firestore {
  if (fs) return fs;
  if (!getApps().length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    // Strip a UTF-8 byte-order mark (Windows tools add one) before parsing.
    if (sa) initializeApp({ credential: cert(JSON.parse(sa.replace(/^﻿/, "").trim())) });
    else initializeApp(projectId ? { projectId } : undefined);
  }
  fs = getFirestore();
  fs.settings({ ignoreUndefinedProperties: true });
  return fs;
}

export const nowIso = () => new Date().toISOString();

/** All data access for one user: users/{uid}/... */
export function userDb(uid: string) {
  const root = () => firestore().collection("users").doc(uid);
  const col = (c: CollectionName) => root().collection(c);
  return {
    uid,
    async get<K extends CollectionName>(c: K, id: string): Promise<WithId<Collections[K]> | null> {
      const d = await col(c).doc(id).get();
      return d.exists ? ({ ...(d.data() as Collections[K]), id: d.id } as WithId<Collections[K]>) : null;
    },
    async list<K extends CollectionName>(c: K, where?: [string, FirebaseFirestore.WhereFilterOp, unknown]): Promise<WithId<Collections[K]>[]> {
      let q: FirebaseFirestore.Query = col(c);
      if (where) q = q.where(where[0], where[1], where[2]);
      const s = await q.get();
      return s.docs.map((d) => ({ ...(d.data() as Collections[K]), id: d.id }) as WithId<Collections[K]>);
    },
    async exists(c: CollectionName, id: string) {
      return (await col(c).doc(id).get()).exists;
    },
    set<K extends CollectionName>(c: K, id: string, data: Collections[K]) {
      return col(c).doc(id).set(data as FirebaseFirestore.DocumentData);
    },
    update<K extends CollectionName>(c: K, id: string, data: Partial<Collections[K]>) {
      return col(c).doc(id).set(data as FirebaseFirestore.DocumentData, { merge: true });
    },
    async add<K extends CollectionName>(c: K, data: Collections[K]) {
      return (await col(c).add(data as FirebaseFirestore.DocumentData)).id;
    },
    delete(c: CollectionName, id: string) {
      return col(c).doc(id).delete();
    },
    log(level: "info" | "success" | "warn" | "error", type: string, message: string, jobId?: string) {
      return col("activity").add({ ts: nowIso(), level, type, message, ...(jobId ? { jobId } : {}) });
    },
  };
}
export type UserDb = ReturnType<typeof userDb>;

/** Users who finished onboarding (have settings/main.onboardedAt). */
export async function onboardedUserIds(): Promise<string[]> {
  const refs = await firestore().collection("users").listDocuments();
  const ids: string[] = [];
  for (const r of refs) {
    const s = await r.collection("settings").doc("main").get();
    if (s.exists && s.get("onboardedAt")) ids.push(r.id);
  }
  return ids;
}
