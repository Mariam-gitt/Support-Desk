import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { errorMessage } from "../lib/format.js";

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { acceptInvitation } = useAuth();
  const token = searchParams.get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await acceptInvitation({ token, name, password });
      navigate("/tickets", { replace: true });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <h1>Join a Support Desk team</h1>
      {!token ? <p className="error">This invitation link is missing its token.</p> : (
        <form className="card form" onSubmit={submit}>
          <p className="muted">If you already have an account, enter its current password to join this business.</p>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}>{submitting ? "Joining..." : "Accept invitation"}</button>
        </form>
      )}
    </main>
  );
}
