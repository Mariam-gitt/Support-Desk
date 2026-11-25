// State for the form, and the submit event type
import { useState, type FormEvent } from "react";
// Link goes to another page without reloading; Navigate redirects
import { Link, Navigate } from "react-router-dom";
// The auth system
import { useAuth } from "../auth/AuthContext.js";
// Error text helper
import { errorMessage } from "../lib/format.js";

// The sign-up screen: creates a business and its owner account
export function RegisterPage() {
  // The register action and the current session
  const { register, session } = useAuth();
  // What the person typed
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // A message to show when sign-up fails
  const [error, setError] = useState<string | null>(null);
  // True while we wait for the server
  const [busy, setBusy] = useState(false);

  // Already logged in: go to the app
  if (session) return <Navigate to="/" replace />;

  // Runs when the form is submitted
  async function handleSubmit(event: FormEvent) {
    // Stop the browser's default page reload
    event.preventDefault();
    // Clear an old error and show the busy state
    setError(null);
    setBusy(true);
    try {
      // Create the business and log in; the redirect above then takes over
      await register({ name, email, password, organizationName });
    } catch (caught) {
      // Show the server's message (for example "email already registered")
      setError(errorMessage(caught));
    } finally {
      // Always leave the busy state
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card form" onSubmit={handleSubmit}>
        <h2>Create your business account</h2>
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label>
          Business name
          <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required minLength={2} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password (at least 8 characters)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create account"}
        </button>
        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
