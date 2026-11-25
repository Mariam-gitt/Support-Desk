// Navigate redirects, Outlet shows the matched child route
import { Navigate, Outlet } from "react-router-dom";
// The auth system
import { useAuth } from "../auth/AuthContext.js";

// A "gate": logged-in people see the pages inside it, everyone else is sent to the login page
export function RequireAuth() {
  // Is anyone logged in?
  const { session } = useAuth();
  // Not logged in: redirect (replace stops the Back button from returning to this blocked page)
  if (!session) return <Navigate to="/login" replace />;
  // Logged in: show the child page
  return <Outlet />;
}
