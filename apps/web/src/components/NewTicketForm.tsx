// State for the form fields; FormEvent types the submit event
import { useState, type FormEvent } from "react";
// useMutation = React Query's tool for CHANGING data on the server; useQueryClient lets us refresh cached lists afterwards
import { useMutation, useQueryClient } from "@tanstack/react-query";
// The API helper
import { api } from "../lib/api.js";
// Error text helper
import { errorMessage } from "../lib/format.js";
// Types
import type { TicketPriority, TicketSummary } from "../lib/types.js";

// The form for creating a ticket
// DATA FLOW (parent -> child): the page passes "orgId" down so the form knows which business to create in
// DATA FLOW (child -> parent): the form calls "onCreated" and "onCancel" to tell the page what happened
export function NewTicketForm({ orgId, onCreated, onCancel }: { orgId: string; onCreated: () => void; onCancel: () => void }) {
  // The text the person types into each field (kept in state so React always knows the current values)
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  // The shared cache of server data
  const queryClient = useQueryClient();

  // The "create ticket" action
  const create = useMutation({
    // What to send: the same body our API expects
    mutationFn: () =>
      api<TicketSummary>(`/orgs/${orgId}/tickets`, {
        method: "POST",
        body: { customer: { name: customerName, email: customerEmail }, subject, description, priority },
      }),
    // After success: refresh the ticket and customer lists, then tell the parent page (child -> parent)
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
      onCreated();
    },
  });

  // Runs when the form is submitted
  function handleSubmit(event: FormEvent) {
    // Stop the browser from reloading the page (its default form behaviour)
    event.preventDefault();
    // Send the request
    create.mutate();
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h3>New ticket</h3>
      <label>
        Customer name
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required minLength={2} />
      </label>
      <label>
        Customer email
        <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
      </label>
      <label>
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} />
      </label>
      <label>
        Priority
        <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </label>
      {/* Show the server's message if creating failed */}
      {create.isError && <p className="error">{errorMessage(create.error)}</p>}
      <div className="row">
        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating..." : "Create ticket"}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
