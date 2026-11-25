// Import Router, Express's tool for grouping related routes
import { Router } from "express";
// Guard: checks the user's role in this business
import { requireRole } from "../../middleware/requireRole.js";
// Import the controllers that handle each request
import {
  addMessageController,
  assignTicketController,
  changeStatusController,
  createTicketController,
  getTicketController,
  listTicketsController,
} from "./ticket.controller.js";

// mergeParams: true lets this router read :orgId from the parent route (/api/orgs/:orgId/tickets)
const router = Router({ mergeParams: true });

// Create a ticket (any member)
router.post("/", createTicketController);
// List tickets with filters and paging (any member)
router.get("/", listTicketsController);
// View one ticket with its conversation (any member)
router.get("/:ticketId", getTicketController);
// Change status (any member; closing is limited to OWNER/ADMIN inside the service)
router.patch("/:ticketId/status", changeStatusController);
// Assign or unassign (OWNER and ADMIN only)
router.patch("/:ticketId/assign", requireRole("OWNER", "ADMIN"), assignTicketController);
// Reply on a ticket (any member)
router.post("/:ticketId/messages", addMessageController);

// Export the router
export default router;
