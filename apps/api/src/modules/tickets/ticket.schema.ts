// zod = a library that checks that incoming data has the right shape (type, length, format) before we use it
import { z } from "zod";

// The allowed ticket statuses (must match the TicketStatus enum in schema.prisma)
const statusEnum = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
// The allowed priorities (must match the TicketPriority enum in schema.prisma)
const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

// Rules for creating a ticket: who the customer is, plus what they need
export const createTicketSchema = z.object({
  // The customer is described inline; we find or create their record by email
  customer: z.object({
    // The customer's name: trimmed (extra spaces removed), 2 to 100 characters
    name: z.string().trim().min(2).max(100),
    // The customer's email: trimmed, forced to lowercase (so A@x.com and a@x.com are the same person), must look like an email
    email: z.string().trim().toLowerCase().email(),
  }),
  // A short title for the problem, 3 to 200 characters
  subject: z.string().trim().min(3).max(200),
  // The full explanation, up to 5000 characters (a limit stops people from sending giant payloads)
  description: z.string().trim().min(1).max(5000),
  // Priority is optional; if the client does not send it, MEDIUM is used
  priority: priorityEnum.default("MEDIUM"),
});

// Rules for the filters and paging in the ticket list URL (?status=OPEN&page=2)
export const listTicketsQuerySchema = z.object({
  // Optional filter: only tickets with this status
  status: statusEnum.optional(),
  // Optional filter: only tickets with this priority
  priority: priorityEnum.optional(),
  // Optional filter: tickets assigned to me, or tickets nobody has taken yet
  assignedTo: z.enum(["me", "unassigned"]).optional(),
  // Page number; query strings arrive as text, so coerce turns "2" into the number 2; default is page 1
  page: z.coerce.number().int().min(1).default(1),
  // Page size, at most 50 so nobody can ask for the whole database at once; default is 20
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Rules for changing a ticket's status
export const changeStatusSchema = z.object({
  // The status we want to move to
  status: statusEnum,
});

// Rules for assigning a ticket
export const assignTicketSchema = z.object({
  // The id of the USER (team member) to assign, or null to unassign
  userId: z.string().min(1).nullable(),
});

// Rules for adding a reply message to a ticket
export const addMessageSchema = z.object({
  // The message text: trimmed, 1 to 5000 characters
  body: z.string().trim().min(1).max(5000),
});
