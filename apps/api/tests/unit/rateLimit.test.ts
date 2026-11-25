// Test tools
import { describe, expect, it } from "vitest";
// A tiny Express app, built just for this test
import express from "express";
// supertest sends requests to it
import request from "supertest";
// The real rate limiter factory under test
import { buildRateLimiter } from "../../src/middleware/rateLimit.js";

// Build a mini login route that succeeds only when the body says ok:true
function buildApp(options: { max: number; skipSuccessfulRequests: boolean }) {
  // New app
  const app = express();
  // Read JSON bodies
  app.use(express.json());
  // The limiter in front of a fake login
  app.post("/login", buildRateLimiter({ ...options, windowMs: 60_000 }), (req, res) => {
    // 200 for "ok", 401 otherwise
    res.status(req.body.ok ? 200 : 401).json({ success: Boolean(req.body.ok) });
  });
  // Return it
  return app;
}

// Group: rate limiting behavior
describe("rate limiter", () => {
  // After the allowed number of failures, the next attempt is blocked
  it("blocks with 429 after too many failed attempts", async () => {
    // Allow 2 failures
    const app = buildApp({ max: 2, skipSuccessfulRequests: true });
    // First failure is a normal 401
    expect((await request(app).post("/login").send({ ok: false })).status).toBe(401);
    // Second failure is a normal 401
    expect((await request(app).post("/login").send({ ok: false })).status).toBe(401);
    // The third attempt is blocked
    const blocked = await request(app).post("/login").send({ ok: false });
    // 429 = Too Many Requests
    expect(blocked.status).toBe(429);
    // And the body uses our standard error shape
    expect(blocked.body.success).toBe(false);
  });

  // Real users who log in correctly must never be locked out by their own successes
  it("does not count successful requests when skipSuccessfulRequests is on", async () => {
    // Allow 2 failures
    const app = buildApp({ max: 2, skipSuccessfulRequests: true });
    // Five successful logins in a row
    for (let i = 0; i < 5; i += 1) {
      // Each must pass
      expect((await request(app).post("/login").send({ ok: true })).status).toBe(200);
    }
    // A failure afterwards is still a normal 401, not a 429
    expect((await request(app).post("/login").send({ ok: false })).status).toBe(401);
  });
});
