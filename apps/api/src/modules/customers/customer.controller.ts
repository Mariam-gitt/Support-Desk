// Import TypeScript types for Express requests and responses
import type { Request, Response } from "express";
// zod = a library that checks incoming data before we use it
import { z } from "zod";
// Import the service functions that talk to the database
import { getCustomerHistory, listCustomers } from "./customer.service.js";

// Rules for the customer list URL (?search=ali&page=1&limit=20)
const listCustomersQuerySchema = z.object({
  // Optional search text, trimmed, up to 100 characters
  search: z.string().trim().max(100).optional(),
  // Page number (coerce turns the text "2" into the number 2); default is 1
  page: z.coerce.number().int().min(1).default(1),
  // Page size, at most 50; default is 20
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// List the customers of the business in the URL
export async function listCustomersController(req: Request, res: Response) {
  // Validate and convert the query string
  const validation = listCustomersQuerySchema.safeParse(req.query);
  // Reject bad input
  if (!validation.success) {
    // 400 = Bad Request
    return res.status(400).json({ success: false, message: "Invalid query", errors: validation.error.flatten().fieldErrors });
  }
  try {
    // Ask the service for this business's customers only
    const result = await listCustomers(req.params.orgId as string, validation.data);
    // 200 = OK
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("List customers error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

// Show one customer with their ticket history
export async function getCustomerController(req: Request, res: Response) {
  try {
    // Ask the service; it only finds customers that belong to the business in the URL
    const customer = await getCustomerHistory(req.params.orgId as string, req.params.customerId as string);
    // Not found (or another business's customer)
    if (!customer) return res.status(404).json({ success: false, message: "Not found" });
    // 200 = OK
    return res.status(200).json({ success: true, data: customer });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("Get customer error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}
