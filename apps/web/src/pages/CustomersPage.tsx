// State for the search box and the selected customer, and the submit event type
import { useState, type FormEvent } from "react";
// useQuery reads data from the server
import { useQuery } from "@tanstack/react-query";
// Link goes to another page without reloading
import { Link } from "react-router-dom";
// The current business
import { useCurrentOrg } from "../auth/AuthContext.js";
// The API helper
import { api } from "../lib/api.js";
// Formatting helpers
import { errorMessage, formatDate } from "../lib/format.js";
// Types
import type { CustomerHistory, CustomerRow, Page } from "../lib/types.js";
// Child component
import { StatusBadge } from "../components/StatusBadge.js";

// Customers and their ticket history
export function CustomersPage() {
  // Which business we are working in
  const { organizationId: orgId } = useCurrentOrg();
  // What is typed in the search box, and the search that is actually applied (applied on submit)
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  // The customer whose history is open (null = none)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load the customer list
  const customers = useQuery({
    queryKey: ["customers", orgId, "list", search],
    queryFn: () => api<Page<CustomerRow>>(`/orgs/${orgId}/customers?limit=50${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  });

  // Load the selected customer's history (only when someone is selected)
  const history = useQuery({
    queryKey: ["customers", orgId, "history", selectedId],
    queryFn: () => api<CustomerHistory>(`/orgs/${orgId}/customers/${selectedId}`),
    enabled: selectedId !== null,
  });

  // Runs when the search form is submitted
  function handleSearch(event: FormEvent) {
    // Stop the browser's default page reload
    event.preventDefault();
    // Apply the typed text as the search
    setSearch(searchText.trim());
  }

  return (
    <section>
      <h2>Customers</h2>
      <form className="row" onSubmit={handleSearch}>
        <input placeholder="Search by name or email" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        <button type="submit">Search</button>
      </form>

      {customers.isPending && <p>Loading customers...</p>}
      {customers.isError && <p className="error">{errorMessage(customers.error)}</p>}
      {customers.data && customers.data.items.length === 0 && <p className="muted">No customers found. They appear automatically when a ticket is created.</p>}

      <div className="two-columns">
        <div>
          {customers.data?.items.map((customer) => (
            // Clicking selects the customer (the button is full width so the whole row is clickable)
            <button key={customer.id} className={customer.id === selectedId ? "list-item selected" : "list-item"} onClick={() => setSelectedId(customer.id)}>
              <strong>{customer.name}</strong>
              <span className="muted">{customer.email}</span>
              <span className="muted">
                {customer.ticketCount} ticket{customer.ticketCount === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>

        <div>
          {selectedId === null && <p className="muted">Pick a customer to see their history.</p>}
          {history.isPending && selectedId !== null && <p>Loading history...</p>}
          {history.isError && <p className="error">{errorMessage(history.error)}</p>}
          {history.data && (
            <div className="card">
              <h3>{history.data.name}</h3>
              <p className="muted">
                {history.data.email} · customer since {formatDate(history.data.createdAt)}
              </p>
              {history.data.tickets.map((ticket) => (
                <div className="row between history-row" key={ticket.id}>
                  <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
                  {/* DATA FLOW (parent -> child): each row passes its status to a badge */}
                  <StatusBadge status={ticket.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
