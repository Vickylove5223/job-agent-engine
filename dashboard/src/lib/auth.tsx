import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { backend } from "./db";
import { setUserScope, watchAuth, type AuthUser } from "./firebase";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}
const Ctx = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  useEffect(() => {
    if (backend.kind === "local") {
      setState({ user: { uid: "local-dev", email: "local@dev" }, loading: false });
      return;
    }
    return watchAuth((user) => {
      // Scope must be set before pages mount and subscribe to users/{uid}/...
      setUserScope(user?.uid ?? null);
      setState({ user, loading: false });
    });
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
