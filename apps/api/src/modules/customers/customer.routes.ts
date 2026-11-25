// Import Router, Express's tool for grouping related routes
import { Router } from "express";
// Import the controllers that handle each request
import { getCustomerController, listCustomersController } from "./customer.controller.js";

// mergeParams: true lets this router read :orgId from the parent route (/api/orgs/:orgId/customers)
const router = Router({ mergeParams: true });

// List customers with search and paging (any member)
router.get("/", listCustomersController);
// One customer with their full ticket history (any member)
router.get("/:customerId", getCustomerController);

// Export the router
export default router;
