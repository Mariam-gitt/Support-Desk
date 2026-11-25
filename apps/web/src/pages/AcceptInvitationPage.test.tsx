import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockFetch, renderApp } from "../test/utils.js";

vi.mock("../realtime/useRealtime.js", () => ({ useRealtime: () => false }));

describe("accept invitation", () => {
  it("accepts a single-use invite and signs the teammate in", async () => {
    const fake = mockFetch({
      "POST /api/auth/invitations/accept": {
        body: {
          success: true,
          data: {
            token: "short-lived-access",
            user: { id: "agent1", name: "Alex", email: "alex@example.com" },
            memberships: [{ organizationId: "org1", organizationName: "Shop", role: "AGENT" }],
          },
        },
      },
      "GET /api/orgs/org1/tickets?page=1&limit=10": {
        body: { success: true, data: { items: [], page: 1, limit: 10, total: 0 } },
      },
    });
    renderApp("/invite?token=invitation-capability-token");
    await userEvent.type(await screen.findByLabelText("Name"), "Alex");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("heading", { name: "Tickets" })).toBeInTheDocument();
    const request = fake.mock.calls.find(([url]) => String(url).endsWith("/invitations/accept"));
    expect(JSON.parse((request?.[1] as RequestInit).body as string)).toEqual({
      token: "invitation-capability-token",
      name: "Alex",
      password: "password123",
    });
  });
});
