// Tools: render draws a component on a fake page; vi creates fake functions
import { render } from "@testing-library/react";
import { vi } from "vitest";
// A fake in-memory router (tests have no real browser address bar)
import { MemoryRouter } from "react-router-dom";
// The cache for server data; a fresh one per test so tests never share data
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// The real app and auth system: we test the app the way people use it
import { App } from "../App.js";
import { AuthProvider } from "../auth/AuthContext.js";
import { writeOrgId, writeSession } from "../auth/session.js";
import { setAccessToken } from "../lib/api.js";
// Types
import type { LoginData, Role, TicketDetail } from "../lib/types.js";

// A pretend logged-in person with one business and the given role
export function sessionWithRole(role: Role): LoginData {
  return {
    token: "test-token",
    user: { id: "u1", name: "Mariam", email: "m@x.com" },
    memberships: [{ organizationId: "org1", organizationName: "Boutique", role }],
  };
}

// Draw the whole app at an address; optionally start logged in
export function renderApp(route: string, session?: LoginData) {
  // Pretend the person logged in earlier (the app reads this from the tab's storage when it starts)
  if (session) {
    setAccessToken(session.token);
    writeSession(session);
    writeOrgId(session.memberships[0]!.organizationId);
  } else {
    setAccessToken(null);
  }
  // A cache that never retries failed requests, so error tests are fast
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Draw it
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// What a fake server answer looks like: a status and a JSON body
type Reply = { status?: number; body: unknown };

// Replace the browser's fetch with a fake that answers from a table like { "GET /api/x": { body: {...} } }
export function mockFetch(routes: Record<string, Reply>) {
  // vi.fn records every call, so tests can check what the app sent
  const fake = vi.fn(async (url: string, init?: RequestInit) => {
    // The lookup key is "METHOD /path"
    const key = `${init?.method ?? "GET"} ${url}`;
    // Find the prepared answer
    const reply = routes[key] ?? (key === "POST /api/auth/refresh"
      ? { status: 401, body: { success: false, message: "Session expired. Please log in again" } }
      : undefined);
    // Unknown requests answer 404, which makes missing mocks easy to spot
    const status = reply ? (reply.status ?? 200) : 404;
    const body = reply ? reply.body : { success: false, message: `No mock for ${key}` };
    // A minimal Response look-alike with the parts our API helper uses
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  });
  // Install the fake for the duration of the test (setup.ts removes it afterwards)
  vi.stubGlobal("fetch", fake);
  // Return it so tests can inspect calls
  return fake;
}

// A ticket as the API returns it, with sensible defaults
export function ticketFixture(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    id: "t1",
    subject: "Order not delivered",
    description: "Ordered five days ago",
    status: "OPEN",
    priority: "HIGH",
    createdAt: "2026-11-25T10:00:00.000Z",
    updatedAt: "2026-11-25T10:00:00.000Z",
    customer: { id: "c1", name: "Ali Khan", email: "ali@shop.com" },
    assignee: null,
    allowedNext: ["IN_PROGRESS"],
    messages: [],
    ...overrides,
  };
}
