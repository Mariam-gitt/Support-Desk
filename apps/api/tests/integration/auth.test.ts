// Test tools
import { describe, expect, it } from "vitest";
// Shared helpers
import { PASSWORD, api, bearer, createWorkspace, uniqueEmail } from "../helpers.js";

// Group: registration, login and the "who am I" endpoint
describe("auth", () => {
  // Registration creates the account and never leaks the password hash
  it("registers an owner with a business and does not leak the password hash", async () => {
    // Register a new person
    const res = await api().post("/api/auth/register").send({ name: "Mariam", email: uniqueEmail(), password: PASSWORD, organizationName: "Boutique" });
    // 201 = Created
    expect(res.status).toBe(201);
    // The raw response text must not contain any hash (bcrypt hashes start with $2)
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  // One email = one account, whatever the letter case
  it("refuses a duplicate email, even with different letter case", async () => {
    // First registration
    const email = uniqueEmail("dup");
    await api().post("/api/auth/register").send({ name: "First", email, password: PASSWORD, organizationName: "One" });
    // Second registration with the email in capitals
    const res = await api().post("/api/auth/register").send({ name: "Second", email: email.toUpperCase(), password: PASSWORD, organizationName: "Two" });
    // 409 = Conflict
    expect(res.status).toBe(409);
  });

  // Login works regardless of how the email was typed
  it("logs in with the email in any letter case", async () => {
    // A registered owner
    const owner = await createWorkspace();
    // Log in with the email in capitals
    const res = await api().post("/api/auth/login").send({ email: owner.email.toUpperCase(), password: PASSWORD });
    // Success with a token and the business list
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.memberships).toHaveLength(1);
  });

  it("rotates refresh tokens in an httpOnly cookie and revokes them on logout", async () => {
    const owner = await createWorkspace();
    const login = await api().post("/api/auth/login").send({ email: owner.email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data).not.toHaveProperty("refreshToken");
    const initialCookie = String(login.headers["set-cookie"]);
    expect(initialCookie).toMatch(/HttpOnly/i);
    expect(initialCookie).toMatch(/SameSite=Strict/i);
    const initialPair = initialCookie.split(";")[0]!;

    const unauthenticated = await api().post("/api/auth/refresh");
    expect(unauthenticated.status).toBe(401);

    const refreshed = await api().post("/api/auth/refresh").set("Cookie", initialPair);
    expect(refreshed.status).toBe(200);
    const rotatedCookie = String(refreshed.headers["set-cookie"]);
    const rotatedPair = rotatedCookie.split(";")[0]!;
    expect(rotatedPair).not.toBe(initialPair);
    expect(refreshed.body.data.token).toEqual(expect.any(String));

    const reused = await api().post("/api/auth/refresh").set("Cookie", initialPair);
    expect(reused.status).toBe(401);
    const logout = await api().post("/api/auth/logout").set("Cookie", rotatedPair);
    expect(logout.status).toBe(200);
    expect((await api().post("/api/auth/refresh").set("Cookie", rotatedPair)).status).toBe(401);
  });

  // The error must not reveal whether the email exists
  it("answers a wrong password and an unknown email identically", async () => {
    // A real account
    const owner = await createWorkspace();
    // Wrong password
    const wrongPassword = await api().post("/api/auth/login").send({ email: owner.email, password: "wrong-password" });
    // Unknown email
    const unknownEmail = await api().post("/api/auth/login").send({ email: uniqueEmail("ghost"), password: PASSWORD });
    // Same status
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Same body (an attacker learns nothing)
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  // Bad input is refused before touching the database
  it("rejects an invalid login body with 400", async () => {
    // Not an email
    const res = await api().post("/api/auth/login").send({ email: "nope" });
    // 400 = Bad Request
    expect(res.status).toBe(400);
  });

  // The profile endpoint needs a valid token
  it("protects /me", async () => {
    // A logged-in owner
    const owner = await createWorkspace();
    // No token
    expect((await api().get("/api/auth/me")).status).toBe(401);
    // A fake token
    expect((await api().get("/api/auth/me").set(bearer("abc.def.ghi"))).status).toBe(401);
    // A valid token
    const ok = await api().get("/api/auth/me").set(bearer(owner.token));
    // Works and shows the right person
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.email).toBe(owner.email);
  });
});

// Group: behavior that applies to the whole API
describe("api hardening", () => {
  // Broken JSON must give our JSON error, not Express's HTML error page
  it("answers malformed JSON with a JSON 400", async () => {
    // Send a broken body on purpose
    const res = await api().post("/api/auth/login").set("Content-Type", "application/json").send('{"email": ');
    // 400 = Bad Request
    expect(res.status).toBe(400);
    // Our error shape
    expect(res.body).toEqual({ success: false, message: "Invalid JSON in request body" });
  });

  // Oversized bodies are refused
  it("refuses a body larger than 100kb", async () => {
    // A 200kb text field
    const res = await api().post("/api/auth/login").send({ email: "a@b.co", password: "x".repeat(200_000) });
    // 413 = Payload Too Large
    expect(res.status).toBe(413);
  });

  // Unknown URLs get a JSON 404
  it("answers an unknown route with a JSON 404", async () => {
    // A URL that does not exist
    const res = await api().get("/api/does-not-exist");
    // 404 with our shape
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Not found" });
  });

  // Security headers must be present and the framework must not advertise itself
  it("sends security headers", async () => {
    // Any endpoint
    const res = await api().get("/api/health");
    // Stops browsers guessing content types
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    // Does not reveal "Express"
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
