// Import Router, Express's tool for grouping related routes
import { Router } from "express";
// Guard #1: who are you? (checks the login token)
import { authenticate } from "../../middleware/authenticate.js";
// Guard #2: do you belong to THIS business?
import { requireMembership } from "../../middleware/requireMembership.js";
// Guard #3: is your role allowed to do THIS?
import { requireRole } from "../../middleware/requireRole.js";
// Import the ticket routes (/api/orgs/:orgId/tickets/...)
import ticketRoutes from "../tickets/ticket.routes.js";
// Import the customer routes (/api/orgs/:orgId/customers/...)
import customerRoutes from "../customers/customer.routes.js";
// Import the controllers that handle the requests
import { getOrganizationController, listMembersController } from "./org.controller.js";

// Create the organizations router
const router = Router();

// router.use runs these two guards for EVERY route below, in this order (":orgId" is a URL variable)
router.use("/:orgId", authenticate, requireMembership);

// Any member (OWNER, ADMIN or AGENT) may view the business details
router.get("/:orgId", getOrganizationController);

// Only OWNER and ADMIN may see the member list (AGENTs get 403)
router.get("/:orgId/members", requireRole("OWNER", "ADMIN"), listMembersController);

// Mount the ticket routes under a business; the guards above already ran for them
router.use("/:orgId/tickets", ticketRoutes);

// Mount the customer routes under a business; the guards above already ran for them
router.use("/:orgId/customers", customerRoutes);

// Export the router
export default router;
