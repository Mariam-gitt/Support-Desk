// Link tools: NavLink highlights the active page, Outlet shows the current page's content
import { NavLink, Outlet } from "react-router-dom";
// The auth system
import { useAuth } from "../auth/AuthContext.js";
// The live connection
import { useRealtime } from "../realtime/useRealtime.js";

// The frame around every logged-in page: header, business switcher, navigation, live indicator
export function Layout() {
  // Who is logged in and which business they are working in
  const { session, currentOrg, setCurrentOrg, logout } = useAuth();
  // Open the live connection for the current business; "live" is true when events are flowing
  const live = useRealtime(currentOrg?.organizationId ?? null, session?.token ?? null);

  // RequireAuth guarantees a session, but TypeScript does not know that
  if (!session) return null;

  return (
    <div className="shell">
      <header className="topbar">
        {/* The product name */}
        <strong className="brand">Support Desk</strong>
        {/* A dropdown when the person belongs to several businesses, plain text when only one */}
        {session.memberships.length > 1 ? (
          <select
            aria-label="Business"
            value={currentOrg?.organizationId ?? ""}
            // DATA FLOW (child -> parent): the select reports the new choice to the auth system
            onChange={(event) => setCurrentOrg(event.target.value)}
          >
            {session.memberships.map((m) => (
              <option key={m.organizationId} value={m.organizationId}>
                {m.organizationName} ({m.role})
              </option>
            ))}
          </select>
        ) : (
          <span>
            {currentOrg?.organizationName} ({currentOrg?.role})
          </span>
        )}
        {/* Navigation between the main pages */}
        <nav className="nav">
          <NavLink to="/tickets">Tickets</NavLink>
          <NavLink to="/customers">Customers</NavLink>
        </nav>
        {/* The live indicator: green dot when real-time events are flowing */}
        <span className={live ? "live live-on" : "live"} title="Real-time connection">
          {live ? "● Live" : "○ Offline"}
        </span>
        {/* Who is logged in, and the logout button */}
        <span className="who">{session.user.name}</span>
        <button className="link-button" onClick={logout}>
          Log out
        </button>
      </header>
      {/* The page content; the "key" restarts the page when the business changes so no old data lingers */}
      <main className="content" key={currentOrg?.organizationId}>
        {currentOrg ? <Outlet /> : <p>You do not belong to any business yet.</p>}
      </main>
    </div>
  );
}
