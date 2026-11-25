// Test tools
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
// The test helpers
import { mockFetch, renderApp, sessionWithRole, ticketFixture } from "../test/utils.js";

// The real-time connection needs a server; in these tests it is replaced by a do-nothing version
vi.mock("../realtime/useRealtime.js", () => ({ useRealtime: () => false }));

// The address and the matching fake server answers shared by the tests
const TICKET_URL = "GET /api/orgs/org1/tickets/t1";
const MEMBERS_URL = "GET /api/orgs/org1/members";
const members = { body: { success: true, data: [{ userId: "u2", name: "Sara", email: "s@x.com", role: "AGENT" }] } };

// Group: what each role sees on a ticket
describe("ticket detail", () => {
  // The buttons come from the SERVER's allowedNext list, not from rules copied into the frontend
  it("shows a button for each move the server allows, for an OWNER", async () => {
    // The server says: this ticket may go to IN_PROGRESS or be closed
    mockFetch({ [TICKET_URL]: { body: { success: true, data: ticketFixture({ allowedNext: ["IN_PROGRESS", "CLOSED"] }) } }, [MEMBERS_URL]: members });
    renderApp("/tickets/t1", sessionWithRole("OWNER"));
    // Both buttons appear for an owner
    expect(await screen.findByRole("button", { name: "Start working" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close ticket" })).toBeInTheDocument();
    // And the owner can assign
    expect(await screen.findByLabelText("Assigned to")).toBeInTheDocument();
  });

  // Roles change what is OFFERED (the server still enforces the rules)
  it("hides Close and assignment from an AGENT, and never asks for the member list", async () => {
    // The server allows RESOLVED or CLOSED from here
    const fake = mockFetch({ [TICKET_URL]: { body: { success: true, data: ticketFixture({ status: "IN_PROGRESS", allowedNext: ["RESOLVED", "CLOSED"] }) } } });
    renderApp("/tickets/t1", sessionWithRole("AGENT"));
    // The allowed non-closing move is offered
    expect(await screen.findByRole("button", { name: "Mark resolved" })).toBeInTheDocument();
    // Closing and assigning are not offered
    expect(screen.queryByRole("button", { name: "Close ticket" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Assigned to")).not.toBeInTheDocument();
    // The member list (OWNER/ADMIN only) was never requested, so no pointless 403
    expect(fake.mock.calls.some(([url]) => String(url).endsWith("/members"))).toBe(false);
  });

  // Clicking must send exactly what the API expects
  it("sends the chosen status to the server", async () => {
    // The ticket, plus a fake answer for the change
    const fake = mockFetch({
      [TICKET_URL]: { body: { success: true, data: ticketFixture() } },
      [MEMBERS_URL]: members,
      "PATCH /api/orgs/org1/tickets/t1/status": { body: { success: true, data: ticketFixture({ status: "IN_PROGRESS" }) } },
    });
    renderApp("/tickets/t1", sessionWithRole("OWNER"));
    // Click the button
    await userEvent.click(await screen.findByRole("button", { name: "Start working" }));
    // Find the request the app made
    const call = fake.mock.calls.find(([url, init]) => String(url).endsWith("/status") && init?.method === "PATCH");
    // Its body carries the new status
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ status: "IN_PROGRESS" });
  });

  // Server refusals must be visible, not swallowed
  it("shows the server's message when a change is refused", async () => {
    // The server says someone else changed the ticket first
    mockFetch({
      [TICKET_URL]: { body: { success: true, data: ticketFixture() } },
      [MEMBERS_URL]: members,
      "PATCH /api/orgs/org1/tickets/t1/status": { status: 409, body: { success: false, message: "The ticket was just changed by someone else. Please refresh and try again" } },
    });
    renderApp("/tickets/t1", sessionWithRole("OWNER"));
    await userEvent.click(await screen.findByRole("button", { name: "Start working" }));
    // The message appears on screen
    expect(await screen.findByText(/just changed by someone else/)).toBeInTheDocument();
  });

  // A closed ticket is read-only
  it("shows a closed ticket without action buttons or a reply form", async () => {
    // A closed ticket: the server allows nothing next
    mockFetch({ [TICKET_URL]: { body: { success: true, data: ticketFixture({ status: "CLOSED", allowedNext: [] }) } }, [MEMBERS_URL]: members });
    renderApp("/tickets/t1", sessionWithRole("OWNER"));
    // The notice is shown
    expect(await screen.findByText("This ticket is closed.")).toBeInTheDocument();
    // No reply form
    expect(screen.queryByRole("button", { name: "Send reply" })).not.toBeInTheDocument();
  });
});
