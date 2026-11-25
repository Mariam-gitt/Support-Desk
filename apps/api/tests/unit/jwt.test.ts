// Test tools
import { describe, expect, it } from "vitest";
// The raw library, used here to forge bad tokens on purpose
import jwt from "jsonwebtoken";
// Our helpers under test
import { signToken, verifyToken } from "../../src/lib/jwt.js";
// The validated settings (we need the real secret to forge an expired but correctly signed token)
import { env } from "../../src/config/env.js";

// Group: login token behavior
describe("JWT helpers", () => {
  // The happy path
  it("round-trips a user id", () => {
    // Sign a token for a user id
    const token = signToken("user-123");
    // Verifying it must give the same id back
    expect(verifyToken(token)).toBe("user-123");
  });

  // Editing the token must break the signature
  it("rejects a tampered token", () => {
    // A valid token
    const token = signToken("user-123");
    // Change the last character
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    // Verification must throw
    expect(() => verifyToken(tampered)).toThrow();
  });

  // A token signed with a different secret is a forgery
  it("rejects a token signed with another secret", () => {
    // Forge one with a wrong secret
    const forged = jwt.sign({}, "another-secret-that-is-long-enough-to-sign", { subject: "user-123", algorithm: "HS256" });
    // Must be refused
    expect(() => verifyToken(forged)).toThrow();
  });

  // Expired tokens must stop working
  it("rejects an expired token", () => {
    // Correct secret, but it expired 10 seconds ago
    const expired = jwt.sign({}, env.JWT_SECRET, { subject: "user-123", algorithm: "HS256", expiresIn: -10 });
    // Must be refused
    expect(() => verifyToken(expired)).toThrow();
  });

  // The classic "alg: none" attack: an unsigned token that claims it needs no signature
  it("rejects an unsigned (alg none) token", () => {
    // Build an unsigned token
    const unsigned = jwt.sign({}, "", { subject: "user-123", algorithm: "none" });
    // Must be refused because we only accept HS256
    expect(() => verifyToken(unsigned)).toThrow();
  });

  // A correctly signed token without a user id is useless
  it("rejects a token that has no subject", () => {
    // Signed correctly but no "sub"
    const noSubject = jwt.sign({}, env.JWT_SECRET, { algorithm: "HS256" });
    // Must be refused
    expect(() => verifyToken(noSubject)).toThrow();
  });
});
