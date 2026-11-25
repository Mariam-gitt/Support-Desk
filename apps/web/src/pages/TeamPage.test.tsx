import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockFetch, renderApp, sessionWithRole } from "../test/utils.js";

vi.mock("../realtime/useRealtime.js", () => ({ useRealtime: () => false }));

describe("team management", () => {
  it("lets owners create an admin invite link", async () => {
    const fake = mockFetch({
      "GET /api/orgs/org1/members": { body: { success: true, data: [{ userId: "owner", name: "Mariam", email: "m@x.com", role: "OWNER" }] } },
      "GET /api/orgs/org1": { body: { success: true, data: { id: "org1", slug: "shop" } } },
      "POST /api/orgs/org1/invitations": {
        status: 201,
        body: { success: true, data: { email: "new@x.com", role: "ADMIN", token: "one-time-secret", expiresAt: "2026-11-30T12:00:00.000Z" } },
      },
    });
    renderApp("/team", sessionWithRole("OWNER"));
    await userEvent.type(await screen.findByLabelText("Email"), "new@x.com");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "ADMIN");
    await userEvent.click(screen.getByRole("button", { name: "Create invite link" }));

    const inviteLink = await screen.findByLabelText("One-time invite link");
    expect(inviteLink.getAttribute("value")).toContain("/invite?token=one-time-secret");
    const request = fake.mock.calls.find(([url, init]) => String(url).endsWith("/invitations") && init?.method === "POST");
    expect(JSON.parse((request?.[1] as RequestInit).body as string)).toEqual({ email: "new@x.com", role: "ADMIN" });
  });

  it("does not offer admin invites or member loading to an agent", () => {
    const fake = mockFetch({});
    renderApp("/team", sessionWithRole("AGENT"));
    expect(screen.getByText("Only owners and admins can manage the team.")).toBeInTheDocument();
    expect(fake.mock.calls.some(([url]) => String(url).endsWith("/members"))).toBe(false);
  });

  it("limits admins to agent invites and shows server refusals", async () => {
    mockFetch({
      "GET /api/orgs/org1/members": { body: { success: true, data: [] } },
      "GET /api/orgs/org1": { body: { success: true, data: { id: "org1", slug: "shop" } } },
      "POST /api/orgs/org1/invitations": {
        status: 403,
        body: { success: false, message: "Admins may invite agents only" },
      },
    });
    renderApp("/team", sessionWithRole("ADMIN"));
    const role = await screen.findByLabelText("Role");
    expect(screen.queryByRole("option", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Agent" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), "agent@x.com");
    await userEvent.click(screen.getByRole("button", { name: "Create invite link" }));
    expect(await screen.findByText("Admins may invite agents only")).toBeInTheDocument();
    expect(role).toHaveValue("AGENT");
  });
});
