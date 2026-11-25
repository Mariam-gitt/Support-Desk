// React tools: createContext shares data with the whole app, the hooks keep state and react to events
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
// The API helper and the event name fired when the token stops working
import { UNAUTHORIZED_EVENT, api } from "../lib/api.js";
// The shapes of our data
import type { LoginData, Membership } from "../lib/types.js";
// Helpers that save and read the login in the browser tab
import { clearSession, readOrgId, readSession, writeOrgId, writeSession } from "./session.js";

// Everything other components may use from the auth system
type AuthValue = {
  // The saved login (null = logged out)
  session: LoginData | null;
  // The business the person is currently working in (with their role there)
  currentOrg: Membership | null;
  // Switch to another business
  setCurrentOrg: (orgId: string) => void;
  // Log in with email and password
  login: (email: string, password: string) => Promise<void>;
  // Create a business plus its owner account, then log in
  register: (input: { name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  // Log out
  logout: () => void;
};

// The context itself: a "shared box" any component can read
const AuthContext = createContext<AuthValue | null>(null);

// The provider wraps the whole app (see main.tsx) and fills the shared box
export function AuthProvider({ children }: { children: ReactNode }) {
  // The login, loaded from the tab's storage when the app starts (so a refresh keeps you logged in)
  const [session, setSession] = useState<LoginData | null>(() => readSession());
  // The chosen business id
  const [orgId, setOrgId] = useState<string | null>(() => readOrgId());

  // When the API says our token is no longer valid, drop the login (this shows the login page)
  useEffect(() => {
    // The function that runs when the event fires
    const onUnauthorized = () => setSession(null);
    // Start listening
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    // Stop listening when this component goes away (cleanup)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Save a fresh login and pick a business (the remembered one if it still exists, otherwise the first)
  const startSession = useCallback((data: LoginData) => {
    // Save it in the tab's storage
    writeSession(data);
    // Remember it in memory (this re-renders the app)
    setSession(data);
    // Prefer the previously chosen business
    const remembered = data.memberships.find((m) => m.organizationId === readOrgId());
    // Otherwise the first business
    const chosen = remembered ?? data.memberships[0];
    // Save and remember the choice
    if (chosen) {
      writeOrgId(chosen.organizationId);
      setOrgId(chosen.organizationId);
    }
  }, []);

  // Log in: ask the API, then start the session
  const login = useCallback(
    async (email: string, password: string) => {
      // auth: false because we have no token yet
      const data = await api<LoginData>("/auth/login", { method: "POST", body: { email, password }, auth: false });
      // Save the result
      startSession(data);
    },
    [startSession],
  );

  // Register: create the account, then log in with the same details
  const register = useCallback(
    async (input: { name: string; email: string; password: string; organizationName: string }) => {
      // Create the business and owner
      await api("/auth/register", { method: "POST", body: input, auth: false });
      // Log in right away
      await login(input.email, input.password);
    },
    [login],
  );

  // Log out: forget everything saved
  const logout = useCallback(() => {
    // Clear the tab's storage
    clearSession();
    // Clear memory
    setSession(null);
    setOrgId(null);
  }, []);

  // Switch business
  const setCurrentOrg = useCallback((id: string) => {
    // Save it so a refresh keeps it
    writeOrgId(id);
    // Update the screen
    setOrgId(id);
  }, []);

  // Work out the current business from the id (fall back to the first one)
  const currentOrg = session ? (session.memberships.find((m) => m.organizationId === orgId) ?? session.memberships[0] ?? null) : null;

  // useMemo keeps the object the same between renders unless something really changed (avoids needless re-renders)
  const value = useMemo<AuthValue>(
    () => ({ session, currentOrg, setCurrentOrg, login, register, logout }),
    [session, currentOrg, setCurrentOrg, login, register, logout],
  );

  // Make the value available to every component inside
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The hook components call to read the auth system: const { session, login } = useAuth()
export function useAuth(): AuthValue {
  // Read the shared box
  const value = useContext(AuthContext);
  // Using it outside the provider is a programming mistake, so fail loudly
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  // Return it
  return value;
}

// A stricter hook for screens that only exist inside a business: it always returns the current business (never null)
export function useCurrentOrg(): Membership {
  // Read the auth system
  const { currentOrg } = useAuth();
  // The Layout only renders these screens when a business exists, so null here would be a programming mistake
  if (!currentOrg) throw new Error("useCurrentOrg needs a current business");
  // Return the business with the person's role in it
  return currentOrg;
}
