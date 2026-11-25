// Test tools
import { describe, expect, it } from "vitest";
// The validation rules under test
import { loginSchema, registerSchema } from "../../src/modules/auth/auth.schema.js";
import { createTicketSchema, listTicketsQuerySchema } from "../../src/modules/tickets/ticket.schema.js";

// Group: authentication input rules
describe("auth schemas", () => {
  // Emails must be normalized so one person cannot own two accounts by changing letter case
  it("normalizes the email on register and login", () => {
    // Register input with messy email
    const registered = registerSchema.parse({ name: "Mariam", email: "  Mariam@Shop.COM ", password: "password123", organizationName: "Boutique" });
    // Trimmed and lowercase
    expect(registered.email).toBe("mariam@shop.com");
    // Same for login
    expect(loginSchema.parse({ email: " Mariam@Shop.COM", password: "x" }).email).toBe("mariam@shop.com");
  });

  // Short passwords must be refused at registration
  it("rejects a short password", () => {
    // safeParse returns a result object instead of throwing
    const result = registerSchema.safeParse({ name: "Mariam", email: "m@x.com", password: "short", organizationName: "Boutique" });
    // Must fail
    expect(result.success).toBe(false);
  });
});

// Group: ticket input rules
describe("ticket schemas", () => {
  // A valid ticket with no priority gets the default
  it("defaults priority to MEDIUM and lowercases the customer email", () => {
    // Parse a minimal ticket
    const ticket = createTicketSchema.parse({ customer: { name: "Ali", email: "ALI@Shop.com" }, subject: "Help me", description: "details" });
    // Default priority
    expect(ticket.priority).toBe("MEDIUM");
    // Normalized email (this is what makes customer history match)
    expect(ticket.customer.email).toBe("ali@shop.com");
  });

  // Nonsense must be refused
  it("rejects a bad email and an unknown priority", () => {
    // Bad email
    expect(createTicketSchema.safeParse({ customer: { name: "Ali", email: "nope" }, subject: "Help me", description: "d" }).success).toBe(false);
    // Unknown priority
    expect(createTicketSchema.safeParse({ customer: { name: "Ali", email: "a@x.com" }, subject: "Help me", description: "d", priority: "SOON" }).success).toBe(false);
  });

  // Query strings arrive as text; the schema must convert and cap them
  it("converts paging values and caps the page size", () => {
    // Text becomes numbers
    expect(listTicketsQuerySchema.parse({ page: "2", limit: "10" })).toMatchObject({ page: 2, limit: 10 });
    // Defaults apply when nothing is sent
    expect(listTicketsQuerySchema.parse({})).toMatchObject({ page: 1, limit: 20 });
    // A huge limit is refused (nobody may ask for the whole database)
    expect(listTicketsQuerySchema.safeParse({ limit: "999" }).success).toBe(false);
  });
});
