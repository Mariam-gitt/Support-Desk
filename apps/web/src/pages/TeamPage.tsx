import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "../auth/AuthContext.js";
import { api } from "../lib/api.js";
import { errorMessage } from "../lib/format.js";
import type { Member } from "../lib/types.js";

type CreatedInvitation = { email: string; role: "ADMIN" | "AGENT"; token: string; expiresAt: string };

export function TeamPage() {
  const { organizationId: orgId, role } = useCurrentOrg();
  const queryClient = useQueryClient();
  const canManage = role === "OWNER" || role === "ADMIN";
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "AGENT">("AGENT");
  const [createdInvite, setCreatedInvite] = useState<CreatedInvitation | null>(null);
  const [copyError, setCopyError] = useState(false);

  const members = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => api<Member[]>(`/orgs/${orgId}/members`),
    enabled: canManage,
  });
  const organization = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => api<{ slug: string }>(`/orgs/${orgId}`),
    enabled: canManage,
  });
  const invite = useMutation({
    mutationFn: (input: { email: string; role: "ADMIN" | "AGENT" }) =>
      api<CreatedInvitation>(`/orgs/${orgId}/invitations`, { method: "POST", body: input }),
    onSuccess: async (created) => {
      setCreatedInvite(created);
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: ["members", orgId] });
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api(`/orgs/${orgId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", orgId] }),
  });

  function submitInvite(event: FormEvent) {
    event.preventDefault();
    invite.mutate({ email, role: inviteRole });
  }

  if (!canManage) return <p className="error">Only owners and admins can manage the team.</p>;
  if (members.isPending || organization.isPending) return <p>Loading team...</p>;
  if (members.isError) return <p className="error">{errorMessage(members.error)}</p>;
  if (organization.isError) return <p className="error">{errorMessage(organization.error)}</p>;

  return (
    <section>
      <h2>Team</h2>
      <div className="card">
        <h3>Invite a teammate</h3>
        <p className="muted">Create a one-time link and share it directly. Its expiry is shown with the link.</p>
        <form className="form" onSubmit={submitInvite}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Role
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "ADMIN" | "AGENT")}>
              {role === "OWNER" && <option value="ADMIN">Admin</option>}
              <option value="AGENT">Agent</option>
            </select>
          </label>
          <button type="submit" disabled={invite.isPending}>{invite.isPending ? "Creating link..." : "Create invite link"}</button>
        </form>
        {invite.isError && <p className="error">{errorMessage(invite.error)}</p>}
        {createdInvite && (
          <div className="card">
            <p className="muted">Expires {new Date(createdInvite.expiresAt).toLocaleString()}.</p>
            <label>
              One-time invite link
              <input
                aria-label="One-time invite link"
                readOnly
                value={`${window.location.origin}/invite?token=${encodeURIComponent(createdInvite.token)}`}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <button type="button" className="secondary" onClick={() => {
              void navigator.clipboard.writeText(`${window.location.origin}/invite?token=${encodeURIComponent(createdInvite.token)}`)
                .then(() => setCopyError(false))
                .catch(() => setCopyError(true));
            }}>Copy link</button>
            {copyError && <p className="error">Copy failed. Select and copy the link above.</p>}
          </div>
        )}
      </div>

      <h3>Members</h3>
      {members.data.length === 0 ? <p className="muted">No team members yet.</p> : (
        <div className="card">
          {members.data.map((member) => (
            <div className="row between" key={member.userId}>
              <span>{member.name} ({member.email}) — {member.role}</span>
              {member.role !== "OWNER" && (role === "OWNER" || member.role === "AGENT") && (
                <button
                  type="button"
                  className="secondary"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove ${member.name} from this business?`)) remove.mutate(member.userId);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
        </div>
      )}
      {organization.data && <p className="muted">Customer chat: <a href={`/chat/${organization.data.slug}`}>/chat/{organization.data.slug}</a></p>}
    </section>
  );
}
