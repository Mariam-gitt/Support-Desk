// Test tools
import { describe, expect, it } from "vitest";
// Shared helpers
import { addMember, api, bearer, createTicket, createWorkspace } from "../helpers.js";

// Group: tickets, customers and the status state machine, over real HTTP and a real database
describe("tickets", () => {
  // The same person writing twice must be one customer with a growing history
  it("reuses one customer per email (case-insensitive) and builds their history", async () => {
    // A business
    const owner = await createWorkspace();
    // Two tickets from the same person, the second with different casing and name
    const first = await createTicket(owner, { subject: "First problem" });
    const second = await createTicket(owner, { customer: { name: "Ali K.", email: "ALI@Shop.com" }, subject: "Second problem" });
    // Same customer record
    expect(second.customer.id).toBe(first.customer.id);
    // The history shows both tickets
    const history = await api().get(`/api/orgs/${owner.orgId}/customers/${first.customer.id}`).set(bearer(owner.token));
    expect(history.status).toBe(200);
    expect(history.body.data.tickets).toHaveLength(2);
    // The customer list counts them
    const list = await api().get(`/api/orgs/${owner.orgId}/customers?search=ali`).set(bearer(owner.token));
    expect(list.body.data.items[0].ticketCount).toBe(2);
  });

  // The same email in two businesses must stay two separate customers
  it("keeps the same email as separate customers in different businesses", async () => {
    // Two businesses, one ticket each from the same email
    const a = await createWorkspace("A");
    const b = await createWorkspace("B");
    const ticketA = await createTicket(a);
    const ticketB = await createTicket(b);
    // Different customer records
    expect(ticketA.customer.id).not.toBe(ticketB.customer.id);
    // And business B cannot open business A's customer
    expect((await api().get(`/api/orgs/${b.orgId}/customers/${ticketA.customer.id}`).set(bearer(b.token))).status).toBe(404);
  });

  // Input validation
  it("rejects an invalid ticket with 400", async () => {
    // A business
    const owner = await createWorkspace();
    // Too short subject, bad email
    const res = await api().post(`/api/orgs/${owner.orgId}/tickets`).set(bearer(owner.token)).send({ customer: { name: "A", email: "x" }, subject: "a", description: "" });
    // 400 = Bad Request
    expect(res.status).toBe(400);
  });

  // Listing: filters and paging
  it("lists with filters and paging, and caps the page size", async () => {
    // A business with three tickets
    const owner = await createWorkspace();
    for (let i = 0; i < 3; i += 1) await createTicket(owner, { subject: `Ticket number ${i}` });
    // Page 2 with 2 per page has 1 item and a total of 3
    const page = await api().get(`/api/orgs/${owner.orgId}/tickets?limit=2&page=2`).set(bearer(owner.token));
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.total).toBe(3);
    // Filtering by a status nobody has returns nothing
    const none = await api().get(`/api/orgs/${owner.orgId}/tickets?status=RESOLVED`).set(bearer(owner.token));
    expect(none.body.data.total).toBe(0);
    // A huge limit is refused
    expect((await api().get(`/api/orgs/${owner.orgId}/tickets?limit=999`).set(bearer(owner.token))).status).toBe(400);
  });

  // The state machine, end to end
  it("follows the state machine and protects closing", async () => {
    // A business with an agent and a ticket
    const owner = await createWorkspace();
    const agent = await addMember(owner.orgId, "AGENT");
    const ticket = await createTicket(owner);
    // Helper: change status as a person
    const move = (who: { token: string }, status: string) => api().patch(`/api/orgs/${owner.orgId}/tickets/${ticket.id}/status`).set(bearer(who.token)).send({ status });
    // OPEN straight to RESOLVED is not allowed, and the answer lists what IS allowed
    const skipped = await move(owner, "RESOLVED");
    expect(skipped.status).toBe(409);
    expect(skipped.body.allowedNext).toEqual(["IN_PROGRESS"]);
    // The ticket itself tells clients which moves are allowed, so a frontend never copies the rules
    const detail = await api().get(`/api/orgs/${owner.orgId}/tickets/${ticket.id}`).set(bearer(owner.token));
    expect(detail.body.data.allowedNext).toEqual(["IN_PROGRESS"]);
    // Normal path: OPEN -> IN_PROGRESS -> RESOLVED (an AGENT may do these)
    expect((await move(agent, "IN_PROGRESS")).status).toBe(200);
    expect((await move(agent, "RESOLVED")).status).toBe(200);
    // An AGENT may not close
    expect((await move(agent, "CLOSED")).status).toBe(403);
    // The OWNER may
    expect((await move(owner, "CLOSED")).status).toBe(200);
    // CLOSED is final
    expect((await move(owner, "OPEN")).status).toBe(409);
  });

  // Assignment rules
  it("assigns only to members, only by OWNER/ADMIN, and not on closed tickets", async () => {
    // A business with an agent, an outsider and a ticket
    const owner = await createWorkspace();
    const agent = await addMember(owner.orgId, "AGENT");
    const outsider = await createWorkspace("Other");
    const ticket = await createTicket(owner);
    // Helper: assign as a person
    const assign = (who: { token: string }, userId: string | null) => api().patch(`/api/orgs/${owner.orgId}/tickets/${ticket.id}/assign`).set(bearer(who.token)).send({ userId });
    // An AGENT cannot assign
    expect((await assign(agent, agent.userId)).status).toBe(403);
    // The OWNER can assign a member
    const ok = await assign(owner, agent.userId);
    expect(ok.status).toBe(200);
    expect(ok.body.data.assignee.name).toBe("AGENT Person");
    // But not someone outside the business
    expect((await assign(owner, outsider.userId)).status).toBe(400);
    // After closing, no more assignment
    for (const status of ["IN_PROGRESS", "RESOLVED", "CLOSED"]) {
      await api().patch(`/api/orgs/${owner.orgId}/tickets/${ticket.id}/status`).set(bearer(owner.token)).send({ status });
    }
    expect((await assign(owner, null)).status).toBe(409);
  });

  // Replies
  it("adds messages with the sender taken from the token, and blocks them on closed tickets", async () => {
    // A business with a ticket
    const owner = await createWorkspace();
    const ticket = await createTicket(owner);
    // Reply, trying to fake another sender in the body
    const reply = await api().post(`/api/orgs/${owner.orgId}/tickets/${ticket.id}/messages`).set(bearer(owner.token)).send({ body: "We are on it", senderId: "someone-else" });
    // Created, and the sender is the logged-in person
    expect(reply.status).toBe(201);
    expect(reply.body.data.sender.id).toBe(owner.userId);
    // The conversation shows it
    const detail = await api().get(`/api/orgs/${owner.orgId}/tickets/${ticket.id}`).set(bearer(owner.token));
    expect(detail.body.data.messages).toHaveLength(1);
    // Close the ticket, then replying is refused
    for (const status of ["IN_PROGRESS", "RESOLVED", "CLOSED"]) {
      await api().patch(`/api/orgs/${owner.orgId}/tickets/${ticket.id}/status`).set(bearer(owner.token)).send({ status });
    }
    expect((await api().post(`/api/orgs/${owner.orgId}/tickets/${ticket.id}/messages`).set(bearer(owner.token)).send({ body: "late" })).status).toBe(409);
  });

  // The most important test of the project
  it("never exposes one business's tickets to another business", async () => {
    // Two businesses; A has a ticket
    const a = await createWorkspace("A");
    const b = await createWorkspace("B");
    const ticket = await createTicket(a);
    // B asks for A's ticket through B's OWN url (the id-guessing attack)
    expect((await api().get(`/api/orgs/${b.orgId}/tickets/${ticket.id}`).set(bearer(b.token))).status).toBe(404);
    // B tries to change A's ticket through B's own url
    expect((await api().patch(`/api/orgs/${b.orgId}/tickets/${ticket.id}/status`).set(bearer(b.token)).send({ status: "IN_PROGRESS" })).status).toBe(404);
    // B tries to reply to it
    expect((await api().post(`/api/orgs/${b.orgId}/tickets/${ticket.id}/messages`).set(bearer(b.token)).send({ body: "hi" })).status).toBe(404);
    // B's own list is empty
    expect((await api().get(`/api/orgs/${b.orgId}/tickets`).set(bearer(b.token))).body.data.total).toBe(0);
    // And A's ticket is untouched
    expect((await api().get(`/api/orgs/${a.orgId}/tickets/${ticket.id}`).set(bearer(a.token))).body.data.status).toBe("OPEN");
  });

  // The race condition: two people act at the same instant
  it("lets exactly one of two simultaneous status changes win", async () => {
    // A business with two people and a ticket
    const owner = await createWorkspace();
    const agent = await addMember(owner.orgId, "AGENT");
    const ticket = await createTicket(owner);
    // Both move OPEN -> IN_PROGRESS at the same time
    const send = (who: { token: string }) => api().patch(`/api/orgs/${owner.orgId}/tickets/${ticket.id}/status`).set(bearer(who.token)).send({ status: "IN_PROGRESS" });
    const results = await Promise.all([send(owner), send(agent)]);
    // Exactly one 200 and one 409
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});
