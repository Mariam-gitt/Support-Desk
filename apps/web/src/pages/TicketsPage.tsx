// State for filters and paging
import { useState } from "react";
// useQuery = React Query's tool for READING data (it caches, reloads and tracks loading/error for us); keepPreviousData avoids flicker between pages
import { keepPreviousData, useQuery } from "@tanstack/react-query";
// Link goes to another page without reloading
import { Link } from "react-router-dom";
// The current business and the person's role in it
import { useCurrentOrg } from "../auth/AuthContext.js";
// The API helper
import { api } from "../lib/api.js";
// Formatting helpers
import { errorMessage, formatDate } from "../lib/format.js";
// Types
import type { Page, TicketStatus, TicketSummary } from "../lib/types.js";
// Child components
import { NewTicketForm } from "../components/NewTicketForm.js";
import { StatusBadge } from "../components/StatusBadge.js";

// The ticket list screen
export function TicketsPage() {
  // Which business we are working in
  const { organizationId: orgId } = useCurrentOrg();
  // The status filter ("" = all) and the page number
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [page, setPage] = useState(1);
  // Is the "new ticket" form open?
  const [showForm, setShowForm] = useState(false);

  // Build the URL's query string, for example ?page=1&limit=10&status=OPEN
  const params = new URLSearchParams({ page: String(page), limit: "10" });
  // Only add the status filter when one is chosen
  if (status) params.set("status", status);

  // Load the tickets; the "key" identifies this data in the cache: a new business, filter or page means new data
  const tickets = useQuery({
    queryKey: ["tickets", orgId, { status, page }],
    queryFn: () => api<Page<TicketSummary>>(`/orgs/${orgId}/tickets?${params.toString()}`),
    // Keep showing the old page while the next one loads
    placeholderData: keepPreviousData,
  });

  // How many pages exist (at least 1)
  const totalPages = tickets.data ? Math.max(1, Math.ceil(tickets.data.total / tickets.data.limit)) : 1;

  return (
    <section>
      <div className="row between">
        <h2>Tickets</h2>
        <div className="row">
          {/* The filter: changing it resets to page 1 */}
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as TicketStatus | "");
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <button onClick={() => setShowForm((open) => !open)}>New ticket</button>
        </div>
      </div>

      {/* The creation form; DATA FLOW: parent passes orgId + callbacks down, the form calls them to report back (child -> parent) */}
      {showForm && <NewTicketForm orgId={orgId} onCreated={() => setShowForm(false)} onCancel={() => setShowForm(false)} />}

      {/* The three states of any server data: loading, error, loaded */}
      {tickets.isPending && <p>Loading tickets...</p>}
      {tickets.isError && <p className="error">{errorMessage(tickets.error)}</p>}
      {tickets.data && tickets.data.items.length === 0 && <p className="muted">No tickets yet. Create the first one with "New ticket".</p>}

      {tickets.data && tickets.data.items.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned to</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.data.items.map((ticket) => (
              // "key" helps React track each row between updates
              <tr key={ticket.id}>
                <td>
                  <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
                </td>
                <td>{ticket.customer.name}</td>
                <td>
                  {/* DATA FLOW (parent -> child): the row passes the status down to the badge */}
                  <StatusBadge status={ticket.status} />
                </td>
                <td>{ticket.priority}</td>
                <td>{ticket.assignee?.name ?? <span className="muted">Unassigned</span>}</td>
                <td>{formatDate(ticket.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Paging controls */}
      <div className="row">
        <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button className="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </section>
  );
}
