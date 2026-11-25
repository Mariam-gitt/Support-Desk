// Test tools
import { describe, expect, it, vi } from "vitest";
// The code under test
import { ApiError, UNAUTHORIZED_EVENT, api, setAccessToken } from "./api.js";
// Helpers to pretend someone is logged in
import { readSession, writeSession } from "../auth/session.js";
import { mockFetch, sessionWithRole } from "../test/utils.js";

// Group: the one function every screen uses to talk to the server
describe("api()", () => {
  // The token must be attached and the { success, data } envelope removed
  it("sends the login token and returns only the data", async () => {
    // Pretend someone is logged in
    const session = sessionWithRole("OWNER");
    writeSession(session);
    setAccessToken(session.token);
    // A fake server answer
    const fake = mockFetch({ "GET /api/orgs/org1/tickets": { body: { success: true, data: { items: [] } } } });
    // Call the API
    const data = await api<{ items: unknown[] }>("/orgs/org1/tickets");
    // Only the inner data comes back
    expect(data).toEqual({ items: [] });
    // And the Authorization header carried the token
    const headers = (fake.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
  });

  // Failures must become errors that carry the server's message
  it("throws an ApiError with the server's message and status", async () => {
    // The server refuses
    mockFetch({ "POST /api/x": { status: 409, body: { success: false, message: "This status change is not allowed" } } });
    // The promise rejects with our error type
    await expect(api("/x", { method: "POST", body: {} })).rejects.toMatchObject({ message: "This status change is not allowed", status: 409 });
    // And it really is an ApiError
    await expect(api("/x", { method: "POST", body: {} })).rejects.toBeInstanceOf(ApiError);
  });

  // An expired token must log the person out everywhere
  it("clears the session and fires the unauthorized event on 401", async () => {
    // Logged in, but the server says the token is invalid
    const session = sessionWithRole("OWNER");
    writeSession(session);
    setAccessToken(session.token);
    mockFetch({ "GET /api/auth/me": { status: 401, body: { success: false, message: "Invalid or expired token" } } });
    // Listen for the event the AuthProvider reacts to
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    // The call fails...
    await expect(api("/auth/me")).rejects.toBeInstanceOf(ApiError);
    // ...the saved login is gone...
    expect(readSession()).toBeNull();
    // ...and the app was told
    expect(listener).toHaveBeenCalledTimes(1);
    // Tidy up
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  // A failed LOGIN is just a wrong password, not an expired session
  it("does not treat a 401 from a public call (login) as an expired session", async () => {
    // Someone else's session exists; a failed login attempt must not wipe it
    writeSession(sessionWithRole("OWNER"));
    mockFetch({ "POST /api/auth/login": { status: 401, body: { success: false, message: "Invalid email or password" } } });
    // The login fails with the server's message
    await expect(api("/auth/login", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({ message: "Invalid email or password" });
    // The saved session is untouched
    expect(readSession()).not.toBeNull();
  });
});
