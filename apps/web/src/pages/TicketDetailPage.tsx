// State for the reply box, and the submit event type
import { useState, type FormEvent } from "react";
// useQuery reads data; useMutation changes data; useQueryClient refreshes the cache after a change
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// Link goes to another page; useParams reads :ticketId from the address
import { Link, useParams } from "react-router-dom";
// The current business and the person's role in it
import { useCurrentOrg } from "../auth/AuthContext.js";
// The API helper
import { api } from "../lib/api.js";
// Formatting helpers
import { errorMessage, formatDate, statusActionLabel } from "../lib/format.js";
// Types
import type { Member, TicketDetail, TicketStatus } from "../lib/types.js";
// Child component
import { StatusBadge } from "../components/StatusBadge.js";

// One ticket: details, conversation, status buttons, assignment and replies
export function TicketDetailPage() {
  // The ticket id from the address (/tickets/:ticketId)
  const { ticketId } = useParams();
  // The business and the person's role in it
  const { organizationId: orgId, role } = useCurrentOrg();
  // The shared cache of server data
  const queryClient = useQueryClient();
  // The text in the reply box
  const [reply, setReply] = useState("");

  // Only OWNER and ADMIN may assign tickets (the server enforces it too; this only decides what to SHOW)
  const canAssign = role === "OWNER" || role === "ADMIN";
  // Only OWNER and ADMIN may close tickets (again: the server is the real guard)
  const canClose = canAssign;

  // Load the ticket
  const ticket = useQuery({
    queryKey: ["ticket", orgId, ticketId],
    queryFn: () => api<TicketDetail>(`/orgs/${orgId}/tickets/${ticketId}`),
  });

  // Load the team members for the "assign" dropdown, but only for people allowed to assign
  const members = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => api<Member[]>(`/orgs/${orgId}/members`),
    enabled: canAssign,
  });

  // After any successful change, reload this ticket and the lists
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["ticket", orgId, ticketId] });
    await queryClient.invalidateQueries({ queryKey: ["tickets", orgId] });
  };

  // Change the status
  const changeStatus = useMutation({
    mutationFn: (status: TicketStatus) => api(`/orgs/${orgId}/tickets/${ticketId}/status`, { method: "PATCH", body: { status } }),
    onSuccess: refresh,
  });

  // Assign or unassign
  const assign = useMutation({
    mutationFn: (userId: string | null) => api(`/orgs/${orgId}/tickets/${ticketId}/assign`, { method: "PATCH", body: { userId } }),
    onSuccess: refresh,
  });

  // Send a reply
  const sendReply = useMutation({
    mutationFn: (body: string) => api(`/orgs/${orgId}/tickets/${ticketId}/messages`, { method: "POST", body: { body } }),
    onSuccess: async () => {
      // Empty the reply box, then reload
      setReply("");
      await refresh();
    },
  });

  // Runs when the reply form is submitted
  function handleReply(event: FormEvent) {
    // Stop the browser's default page reload
    event.preventDefault();
    // Send it
    sendReply.mutate(reply);
  }

  // The three states of server data: loading, error, loaded
  if (ticket.isPending) return <p>Loading ticket...</p>;
  if (ticket.isError) return <p className="error">{errorMessage(ticket.error)}</p>;

  // From here on the ticket exists
  const data = ticket.data;
  // The buttons to show: the moves the SERVER says are allowed, minus "close" for people who may not close
  const moves = data.allowedNext.filter((status) => status !== "CLOSED" || canClose);
  // The first error from any of the three actions (shown under the ticket)
  const actionError = changeStatus.error ?? assign.error ?? sendReply.error;

  return (
    <section>
      <p>
        <Link to="/tickets">← Back to tickets</Link>
      </p>
      <div className="card">
        <div className="row between">
          <h2>{data.subject}</h2>
          {/* DATA FLOW (parent -> child): the status goes down to the badge */}
          <StatusBadge status={data.status} />
        </div>
        <p className="muted">
          From {data.customer.name} ({data.customer.email}) · priority {data.priority} · opened {formatDate(data.createdAt)}
        </p>
        <p>{data.description}</p>

        {/* Status buttons: one per allowed move; closed tickets show none */}
        <div className="row">
          {moves.map((status) => (
            <button key={status} disabled={changeStatus.isPending} onClick={() => changeStatus.mutate(status)}>
              {statusActionLabel(status)}
            </button>
          ))}
          {data.status === "CLOSED" && <span className="muted">This ticket is closed.</span>}
        </div>

        {/* Assignment: only for OWNER and ADMIN, and not on closed tickets */}
        {canAssign && data.status !== "CLOSED" && (
          <label className="inline">
            Assigned to
            <select
              value={data.assignee?.id ?? ""}
              // DATA FLOW (child -> parent): the dropdown reports the choice; an empty value means "unassign"
              onChange={(event) => assign.mutate(event.target.value || null)}
              disabled={assign.isPending || members.isPending}
            >
              <option value="">Unassigned</option>
              {members.data?.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name} ({member.role})
                </option>
              ))}
            </select>
          </label>
        )}
        {!canAssign && <p className="muted">Assigned to: {data.assignee?.name ?? "nobody yet"}</p>}

        {actionError && <p className="error">{errorMessage(actionError)}</p>}
      </div>

      <h3>Conversation</h3>
      {data.messages.length === 0 && <p className="muted">No replies yet.</p>}
      {data.messages.map((message) => (
        <div className="message" key={message.id}>
          <strong>{message.sender.name}</strong> <span className="muted">{formatDate(message.createdAt)}</span>
          <p>{message.body}</p>
        </div>
      ))}

      {/* The reply form is hidden on closed tickets (the server refuses replies there anyway) */}
      {data.status !== "CLOSED" && (
        <form className="card form" onSubmit={handleReply}>
          <label>
            Reply
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} required />
          </label>
          <button type="submit" disabled={sendReply.isPending}>
            {sendReply.isPending ? "Sending..." : "Send reply"}
          </button>
        </form>
      )}
    </section>
  );
}
