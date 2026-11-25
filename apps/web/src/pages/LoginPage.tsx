// State for the form, and the submit event type
import { useState, type FormEvent } from "react";
// Link goes to another page without reloading; Navigate redirects
import { Link, Navigate } from "react-router-dom";
// The auth system
import { useAuth } from "../auth/AuthContext.js";
// Error text helper
import { errorMessage } from "../lib/format.js";

// The login screen
export function LoginPage() {
  // The login action and the current session
  const { login, session } = useAuth();
  // What the person typed
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // A message to show when login fails
  const [error, setError] = useState<string | null>(null);
  // True while we wait for the server (disables the button so it cannot be double-clicked)
  const [busy, setBusy] = useState(false);

  // Already logged in: go to the app instead of showing the form
  if (session) return <Navigate to="/" replace />;

  // Runs when the form is submitted
  async function handleSubmit(event: FormEvent) {
    // Stop the browser's default page reload
    event.preventDefault();
    // Clear an old error and show the busy state
    setError(null);
    setBusy(true);
    try {
      // Ask the API to log in; on success the session is saved and the redirect above takes over
      await login(email, password);
    } catch (caught) {
      // Show the server's message (for example "Invalid email or password")
      setError(errorMessage(caught));
    } finally {
      // Always leave the busy state
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card form" onSubmit={handleSubmit}>
        <h2>Log in</h2>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {/* role="alert" makes screen readers announce the error */}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Logging in..." : "Log in"}
        </button>
        <p>
          New here? <Link to="/register">Create a business account</Link>
        </p>
      </form>
    </div>
  );
}
