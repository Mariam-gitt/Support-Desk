// The error class our API helper throws
import { ApiError } from "./api.js";
// The status type
import type { TicketStatus } from "./types.js";

// Show an ISO date text (2026-11-25T10:00:00Z) the way the person's computer prefers
export function formatDate(iso: string): string {
  // Date understands the ISO format; toLocaleString formats it for the person's language and time zone
  return new Date(iso).toLocaleString();
}

// Turn any error into text safe to show on screen (our API errors carry a friendly message already)
export function errorMessage(error: unknown): string {
  // Errors from our API helper carry the server's message
  if (error instanceof ApiError) return error.message;
  // Anything else (network down, a bug): a generic message, never technical details
  return "Something went wrong. Please try again.";
}

// The text on the button that moves a ticket INTO a status
export function statusActionLabel(status: TicketStatus): string {
  // One friendly label per target status
  switch (status) {
    // Moving back to the start of the queue
    case "OPEN":
      return "Reopen";
    // Someone starts working on it
    case "IN_PROGRESS":
      return "Start working";
    // The problem is solved
    case "RESOLVED":
      return "Mark resolved";
    // The ticket is finished for good
    case "CLOSED":
      return "Close ticket";
  }
}
