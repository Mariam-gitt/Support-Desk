// Import TypeScript types for Express requests and responses
import type { Request, Response } from "express";
// Import the Role type (OWNER | ADMIN | AGENT)
import type { Role } from "../../generated/prisma/enums.js";
// Import the function that pushes live events to everyone watching this business
import { emitToOrg } from "../../realtime/realtime.js";
// Import the function that schedules background jobs for a new ticket
import { enqueueTicketCreatedJobs } from "../../queue/queues.js";
// Import the validation rules
import { addMessageSchema, assignTicketSchema, changeStatusSchema, createTicketSchema, listTicketsQuerySchema } from "./ticket.schema.js";
// Import the service functions that talk to the database
import { addMessage, assignTicket, changeTicketStatus, createTicket, getTicket, listTickets } from "./ticket.service.js";

// Turn a service failure into the right HTTP response (one place, so every route answers consistently)
function sendFailure(res: Response, failure: { reason: string; allowed?: string[] }) {
  // Pick the response based on why the action failed
  switch (failure.reason) {
    // The ticket does not exist in this business
    case "NOT_FOUND":
      // 404 = Not Found
      return res.status(404).json({ success: false, message: "Not found" });
    // The role is not enough for this action
    case "FORBIDDEN":
      // 403 = Forbidden (safe to say, the caller is already a member)
      return res.status(403).json({ success: false, message: "You do not have permission to do this" });
    // The state machine does not allow this move
    case "INVALID_TRANSITION":
      // 409 = Conflict (the request clashes with the ticket's current state); we list the moves that ARE allowed
      return res.status(409).json({ success: false, message: "This status change is not allowed", allowedNext: failure.allowed });
    // Someone else changed the ticket at the same moment
    case "CONFLICT":
      // 409 = Conflict; the client should reload and try again
      return res.status(409).json({ success: false, message: "The ticket was just changed by someone else. Please refresh and try again" });
    // The chosen assignee is not part of this business
    case "ASSIGNEE_NOT_MEMBER":
      // 400 = Bad Request (the input is wrong)
      return res.status(400).json({ success: false, message: "That user is not a member of this business" });
    // The ticket is closed, so it is read-only
    case "TICKET_CLOSED":
      // 409 = Conflict with the ticket's state
      return res.status(409).json({ success: false, message: "This ticket is closed" });
    // Anything unexpected
    default:
      // 500 = Server Error
      return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

// Create a ticket (any member of the business may do this)
export async function createTicketController(req: Request, res: Response) {
  // Validate the request body against the rules
  const validation = createTicketSchema.safeParse(req.body);
  // Reject bad input early
  if (!validation.success) {
    // 400 = Bad Request, with the list of field errors
    return res.status(400).json({ success: false, message: "Invalid ticket data", errors: validation.error.flatten().fieldErrors });
  }
  try {
    // Ask the service to create the ticket inside the business named in the URL
    const ticket = await createTicket(req.params.orgId as string, validation.data);
    // Push the new ticket live to everyone viewing this business (after the DB write succeeded)
    emitToOrg(req.params.orgId as string, "ticket.created", ticket);
    // Schedule background work (notification + SLA check); no "await" so the user is not kept waiting, and it never throws
    void enqueueTicketCreatedJobs(req.params.orgId as string, ticket.id);
    // 201 = Created
    return res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("Create ticket error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

// List tickets with filters and paging
export async function listTicketsController(req: Request, res: Response) {
  // Validate and convert the query string (?status=OPEN&page=2)
  const validation = listTicketsQuerySchema.safeParse(req.query);
  // Reject bad filters
  if (!validation.success) {
    // 400 = Bad Request
    return res.status(400).json({ success: false, message: "Invalid query", errors: validation.error.flatten().fieldErrors });
  }
  try {
    // Ask the service for this business's tickets only
    const result = await listTickets(req.params.orgId as string, res.locals.userId as string, validation.data);
    // 200 = OK
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("List tickets error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

// View one ticket with its conversation
export async function getTicketController(req: Request, res: Response) {
  try {
    // Ask the service; it only finds tickets that belong to the business in the URL
    const ticket = await getTicket(req.params.orgId as string, req.params.ticketId as string);
    // Not found (or another business's ticket)
    if (!ticket) return res.status(404).json({ success: false, message: "Not found" });
    // 200 = OK
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("Get ticket error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

// Change a ticket's status
export async function changeStatusController(req: Request, res: Response) {
  // Validate the body ({ "status": "IN_PROGRESS" })
  const validation = changeStatusSchema.safeParse(req.body);
  // Reject unknown statuses
  if (!validation.success) {
    // 400 = Bad Request
    return res.status(400).json({ success: false, message: "Invalid status", errors: validation.error.flatten().fieldErrors });
  }
  try {
    // The user's role in THIS business was saved by the requireMembership guard
    const role = (res.locals.membership as { role: Role }).role;
    // Ask the service to apply the state machine and role rules
    const result = await changeTicketStatus(req.params.orgId as string, req.params.ticketId as string, validation.data.status, role);
    // Turn any failure into the right HTTP answer
    if (!result.ok) return sendFailure(res, result);
    // Push the updated ticket live to everyone viewing this business
    emitToOrg(req.params.orgId as string, "ticket.updated", result.ticket);
    // 200 = OK; return the updated ticket
    return res.status(200).json({ success: true, data: result.ticket });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("Change status error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

// Assign (or unassign) a ticket; the route already limits this to OWNER and ADMIN
export async function assignTicketController(req: Request, res: Response) {
  // Validate the body ({ "userId": "..." } or { "userId": null })
  const validation = assignTicketSchema.safeParse(req.body);
  // Reject bad input
  if (!validation.success) {
    // 400 = Bad Request
    return res.status(400).json({ success: false, message: "Invalid assignment", errors: validation.error.flatten().fieldErrors });
  }
  try {
    // Ask the service to assign (it checks the assignee belongs to this business)
    const result = await assignTicket(req.params.orgId as string, req.params.ticketId as string, validation.data.userId);
    // Turn any failure into the right HTTP answer
    if (!result.ok) return sendFailure(res, result);
    // Push the updated ticket (with its new assignee) live to everyone viewing this business
    emitToOrg(req.params.orgId as string, "ticket.updated", result.ticket);
    // 200 = OK; return the updated ticket
    return res.status(200).json({ success: true, data: result.ticket });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("Assign ticket error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

// Add a reply to a ticket
export async function addMessageController(req: Request, res: Response) {
  // Validate the body ({ "body": "Hello..." })
  const validation = addMessageSchema.safeParse(req.body);
  // Reject empty or too-long messages
  if (!validation.success) {
    // 400 = Bad Request
    return res.status(400).json({ success: false, message: "Invalid message", errors: validation.error.flatten().fieldErrors });
  }
  try {
    // The sender is the logged-in user (taken from the verified token, never from the request body)
    const result = await addMessage(req.params.orgId as string, req.params.ticketId as string, res.locals.userId as string, validation.data.body);
    // Turn any failure into the right HTTP answer
    if (!result.ok) return sendFailure(res, result);
    // Push the new message live; the ticket id tells the browser which conversation it belongs to
    emitToOrg(req.params.orgId as string, "message.created", { ticketId: req.params.ticketId, message: result.message });
    // 201 = Created
    return res.status(201).json({ success: true, data: result.message });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("Add message error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}
