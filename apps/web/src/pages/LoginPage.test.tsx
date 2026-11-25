// Test tools: screen finds things like a user would, waitFor waits for async changes, userEvent types and clicks like a person
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
// The test helpers
import { mockFetch, renderApp } from "../test/utils.js";
import { readSession } from "../auth/session.js";
import { getAccessToken } from "../lib/api.js";

// The real-time connection needs a server; in these tests it is replaced by a do-nothing version
vi.mock("../realtime/useRealtime.js", () => ({ useRealtime: () => false }));

// Group: the login screen
describe("login", () => {
  // Anyone who is not logged in must land on the login page
  it("sends logged-out visitors to the login page", async () => {
    // Open a protected address without a login
    mockFetch({});
    renderApp("/tickets");
    // The login form is shown instead
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  // A wrong password shows the server's message
  it("shows the server's error when the credentials are wrong", async () => {
    // The server refuses the login
    mockFetch({ "POST /api/auth/login": { status: 401, body: { success: false, message: "Invalid email or password" } } });
    renderApp("/login");
    // Type like a person would
    await userEvent.type(screen.getByLabelText("Email"), "m@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    // The error appears (role="alert")
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    // And nothing was saved
    expect(readSession()).toBeNull();
  });

  // The happy path: log in and arrive at the ticket list
  it("logs in and shows the ticket list", async () => {
    // The server accepts the login and has no tickets yet
    mockFetch({
      "POST /api/auth/login": {
        body: {
          success: true,
          data: {
            token: "abc",
            user: { id: "u1", name: "Mariam", email: "m@x.com" },
            memberships: [{ organizationId: "org1", organizationName: "Boutique", role: "OWNER" }],
          },
        },
      },
      "GET /api/orgs/org1/tickets?page=1&limit=10": { body: { success: true, data: { items: [], page: 1, limit: 10, total: 0 } } },
    });
    renderApp("/login");
    await userEvent.type(screen.getByLabelText("Email"), "m@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    // We end up on the tickets page
    expect(await screen.findByRole("heading", { name: "Tickets" })).toBeInTheDocument();
    // The business name and role are shown in the header
    expect(screen.getByText("Boutique (OWNER)")).toBeInTheDocument();
    // And the login was saved so a refresh keeps it
    await waitFor(() => expect(getAccessToken()).toBe("abc"));
    expect(readSession()).not.toHaveProperty("token");
  });

  it("restores a session from the refresh cookie without persisting the access token", async () => {
    const fake = mockFetch({
      "POST /api/auth/refresh": {
        body: {
          success: true,
          data: {
            token: "restored-access",
            user: { id: "u1", name: "Mariam", email: "m@x.com" },
            memberships: [{ organizationId: "org1", organizationName: "Boutique", role: "OWNER" }],
          },
        },
      },
      "GET /api/orgs/org1/tickets?page=1&limit=10": {
        body: { success: true, data: { items: [], page: 1, limit: 10, total: 0 } },
      },
    });
    renderApp("/tickets");
    expect(await screen.findByRole("heading", { name: "Tickets" })).toBeInTheDocument();
    expect(readSession()).not.toHaveProperty("token");
    const refresh = fake.mock.calls.find(([url]) => String(url).endsWith("/auth/refresh"));
    expect((refresh?.[1] as RequestInit).credentials).toBe("include");
  });
});
