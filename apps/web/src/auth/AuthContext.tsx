// React tools: createContext shares data with the whole app, the hooks keep state and react to events
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
// The API helper and the event name fired when the token stops working
import { ACCESS_TOKEN_EVENT, UNAUTHORIZED_EVENT, api, getAccessToken, setAccessToken } from "../lib/api.js";
// The shapes of our data
import type { LoginData, Membership, SessionProfile } from "../lib/types.js";
// Helpers that save and read the login in the browser tab
import { clearSession, readOrgId, readSession, writeOrgId, writeSession } from "./session.js";

// Everything other components may use from the auth system
type AuthValue = {
  // The saved login (null = logged out)
  session: SessionProfile | null;
  accessToken: string | null;
  ready: boolean;
  // The business the person is currently working in (with their role there)
  currentOrg: Membership | null;
  // Switch to another business
  setCurrentOrg: (orgId: string) => void;
  // Log in with email and password
  login: (email: string, password: string) => Promise<void>;
  // Create a business plus its owner account, then log in
  register: (input: { name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  acceptInvitation: (input: { token: string; name: string; password: string }) => Promise<void>;
  // Log out
  logout: () => void;
};

let restoreRequest: Promise<LoginData> | null = null;
function restoreSession() {
  if (!restoreRequest) {
    restoreRequest = api<LoginData>("/auth/refresh", { method: "POST", auth: false }).finally(() => {
      restoreRequest = null;
    });
  }
  return restoreRequest;
}

// The context itself: a "shared box" any component can read
const AuthContext = createContext<AuthValue | null>(null);

// The provider wraps the whole app (see main.tsx) and fills the shared box
export function AuthProvider({ children }: { children: ReactNode }) {
  // The login, loaded from the tab's storage when the app starts (so a refresh keeps you logged in)
  const [session, setSession] = useState<SessionProfile | null>(() => readSession());
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null);
  // The chosen business id
  const [orgId, setOrgId] = useState<string | null>(() => readOrgId());
  const [ready, setReady] = useState(false);

  const startSession = useCallback((data: LoginData) => {
    writeSession(data);
    const { token, ...profile } = data;
    setSession(profile);
    setAccessToken(token);
    setAccessTokenState(token);
    const remembered = data.memberships.find((m) => m.organizationId === readOrgId());
    const chosen = remembered ?? data.memberships[0];
    if (chosen) {
      writeOrgId(chosen.organizationId);
      setOrgId(chosen.organizationId);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const onUnauthorized = () => {
      clearSession();
      setSession(null);
      setAccessToken(null);
      setAccessTokenState(null);
      setOrgId(null);
    };
    const onAccessToken = (event: Event) => {
      setAccessTokenState((event as CustomEvent<string | null>).detail);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener(ACCESS_TOKEN_EVENT, onAccessToken);
    if (getAccessToken()) {
      setAccessTokenState(getAccessToken());
      setReady(true);
      return () => {
        active = false;
        window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
        window.removeEventListener(ACCESS_TOKEN_EVENT, onAccessToken);
      };
    }
    void restoreSession()
      .then((data) => {
        if (active) startSession(data);
      })
      .catch((error) => {
        if (active && !(error instanceof Error && "status" in error && error.status === 401)) {
          console.error("Session restore failed:", error);
        }
        if (active) {
          clearSession();
          setSession(null);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener(ACCESS_TOKEN_EVENT, onAccessToken);
    };
  }, [startSession]);

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

  const acceptInvitation = useCallback(
    async (input: { token: string; name: string; password: string }) => {
      const data = await api<LoginData>("/auth/invitations/accept", { method: "POST", body: input, auth: false });
      startSession(data);
    },
    [startSession],
  );

  // Log out: forget everything saved
  const logout = useCallback(() => {
    void api("/auth/logout", { method: "POST", auth: false }).catch((error) => {
      console.error("Logout request failed:", error);
    });
    clearSession();
    setSession(null);
    setAccessToken(null);
    setAccessTokenState(null);
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
    () => ({ session, accessToken: accessTokenState, ready, currentOrg, setCurrentOrg, login, register, acceptInvitation, logout }),
    [session, accessTokenState, ready, currentOrg, setCurrentOrg, login, register, acceptInvitation, logout],
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
