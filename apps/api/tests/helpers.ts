// supertest = sends real HTTP requests to our Express app without opening a network port
import request from "supertest";
// expect = the assertion function (a failed expect fails the test)
import { expect } from "vitest";
// The Express app (exported separately from server.ts, which is what makes it testable)
import app from "../src/app.js";
// The database client, used to set up situations that have no API endpoint yet
import { prisma } from "../src/lib/prisma.js";
// The Role type (OWNER | ADMIN | AGENT)
import type { Role } from "../src/generated/prisma/enums.js";

// Start a request against the app: api().get("/path"), api().post("/path").send({...})
export const api = () => request(app);

// One password for every test user
export const PASSWORD = "password123";

// A counter that makes sure two generated values never collide
let counter = 0;

// Generate an email nobody used before (tests share one database, so data must never overlap)
export function uniqueEmail(label = "user") {
  // Increase the counter
  counter += 1;
  // Combine label, time, counter and random letters
  return `${label}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

// Build the Authorization header for a token
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// Everything a test needs to act as one person inside one business
export type Actor = { email: string; token: string; userId: string; orgId: string };

// Log in and describe the person; orgId picks which business to act in (default: their first)
export async function loginAs(email: string, orgId?: string): Promise<Actor> {
  // Call the real login endpoint
  const res = await api().post("/api/auth/login").send({ email, password: PASSWORD });
  // Login must work, otherwise the test setup itself is broken
  expect(res.status).toBe(200);
  // The businesses this person belongs to
  const memberships: { organizationId: string }[] = res.body.data.memberships;
  // Choose the requested business, or the first one
  const chosen = orgId ?? memberships[0]?.organizationId;
  // A person with no business would be a setup bug
  expect(chosen).toBeTruthy();
  // Return what tests need
  return { email, token: res.body.data.token, userId: res.body.data.user.id, orgId: chosen as string };
}

// Register a brand-new business with its OWNER (through the real register endpoint) and log in as that owner
export async function createWorkspace(label = "Org"): Promise<Actor> {
  // A fresh email for the owner
  const email = uniqueEmail("owner");
  // Register (this also creates the business and the OWNER membership in one transaction)
  const res = await api()
    .post("/api/auth/register")
    .send({ name: "Owner Person", email, password: PASSWORD, organizationName: `${label} ${uniqueEmail("org")}` });
  // Registration must succeed
  expect(res.status).toBe(201);
  // Log in as the new owner
  return loginAs(email);
}

// Add a new team member with a given role to an existing business (there is no invite endpoint yet, so we write the membership directly)
export async function addMember(orgId: string, role: Role): Promise<Actor> {
  // A fresh email for the new person
  const email = uniqueEmail(role.toLowerCase());
  // Register them (this creates a separate business of their own, which we ignore)
  const res = await api()
    .post("/api/auth/register")
    .send({ name: `${role} Person`, email, password: PASSWORD, organizationName: `Side ${uniqueEmail("org")}` });
  // Registration must succeed
  expect(res.status).toBe(201);
  // Find the new user's id
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  // Make them a member of the target business with the requested role
  await prisma.membership.create({ data: { userId: user.id, organizationId: orgId, role } });
  // Log in, acting inside the target business
  return loginAs(email, orgId);
}

// Create a ticket through the API as the given person and return the response body's data
export async function createTicket(actor: Actor, overrides: Record<string, unknown> = {}) {
  // Send a valid ticket; tests override only what they care about
  const res = await api()
    .post(`/api/orgs/${actor.orgId}/tickets`)
    .set(bearer(actor.token))
    .send({
      customer: { name: "Ali Khan", email: "ali@shop.com" },
      subject: "Order not delivered",
      description: "Ordered five days ago",
      ...overrides,
    });
  // Creation must succeed
  expect(res.status).toBe(201);
  // Return the created ticket
  return res.body.data as { id: string; status: string; customer: { id: string; email: string } };
}
