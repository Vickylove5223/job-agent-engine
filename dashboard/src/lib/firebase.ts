import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut as fbSignOut, connectAuthEmulator, type Auth, type User,
} from "firebase/auth";
import {
  initializeFirestore, connectFirestoreEmulator, collection, doc, onSnapshot, query, orderBy, limit as qLimit,
  setDoc, updateDoc, addDoc, deleteDoc, type Firestore, type QueryConstraint,
} from "firebase/firestore";
import type { Backend } from "./db";
import type { CollectionName, Collections, WithId } from "@shared/types";

// Read each variable individually: referencing the whole import.meta.env object makes Vite inline
// EVERY VITE_* value (including private ones) into the public bundle.
const env = { VITE_USE_EMULATORS: import.meta.env.VITE_USE_EMULATORS as string | undefined };
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let fs: Firestore | null = null;

function init() {
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
    // `npm run dev:emulator` — local Auth + Firestore emulators (test accounts, real rules).
    if (import.meta.env.DEV && env.VITE_USE_EMULATORS === "true") {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(fs, "127.0.0.1", 8080);
    }
  }
  return { auth: auth!, fs: fs! };
}

// Every user's data lives under users/{uid}/<collection>/<doc>. The scope is set by
// AuthProvider as soon as the user signs in, before any page subscribes.
let scopeUid: string | null = null;
export function setUserScope(uid: string | null) {
  scopeUid = uid;
}
function base(): string {
  if (!scopeUid) throw new Error("Not signed in");
  return `users/${scopeUid}`;
}

export function firebaseBackend(): Backend {
  const { fs } = init();
  const colRef = (col: CollectionName) => collection(fs, base(), col);
  const docRef = (col: CollectionName, id: string) => doc(fs, base(), col, id);
  return {
    kind: "firebase",
    subscribeCollection(col, opts, cb) {
      const cons: QueryConstraint[] = [];
      if (opts.orderBy) cons.push(orderBy(opts.orderBy, opts.desc ? "desc" : "asc"));
      if (opts.limit) cons.push(qLimit(opts.limit));
      return onSnapshot(
        query(colRef(col), ...cons),
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as WithId<Collections[typeof col]>)),
        (err) => console.error(`[db] ${col}:`, err.message),
      );
    },
    subscribeDoc(col, id, cb) {
      return onSnapshot(
        docRef(col, id),
        (d) => cb(d.exists() ? ({ ...(d.data() as object), id: d.id } as WithId<Collections[typeof col]>) : null),
        (err) => console.error(`[db] ${col}/${id}:`, err.message),
      );
    },
    set: (col, id, data) => setDoc(docRef(col, id), data as object),
    update: (col, id, data) => updateDoc(docRef(col, id), data as object),
    async add(col, data) {
      const ref = await addDoc(colRef(col), data as object);
      return ref.id;
    },
    remove: (col: CollectionName, id: string) => deleteDoc(docRef(col, id)),
  };
}

// ---------- auth ----------
export type AuthUser = Pick<User, "uid" | "email">;

export function watchAuth(cb: (u: AuthUser | null) => void) {
  if (!isFirebaseConfigured) {
    cb({ uid: "local-dev", email: "local@dev" });
    return () => {};
  }
  return onAuthStateChanged(init().auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
}
export const signIn = (email: string, password: string) => signInWithEmailAndPassword(init().auth, email, password);
export const signUp = (email: string, password: string) => createUserWithEmailAndPassword(init().auth, email, password);
export const resetPassword = (email: string) => sendPasswordResetEmail(init().auth, email);
export const signOut = () => fbSignOut(init().auth);
/** ID token for calling the agent API; null in local dev mode or when signed out. */
export async function getIdToken(): Promise<string | null> {
  if (!isFirebaseConfigured) return null;
  const u = init().auth.currentUser;
  return u ? u.getIdToken() : null;
}
