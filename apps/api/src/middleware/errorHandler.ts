// Import the Express types for a normal middleware and for an error-handling middleware
import type { ErrorRequestHandler, RequestHandler } from "express";

// Runs when NO route matched the URL: answer with our JSON error shape instead of Express's default HTML page
export const notFoundHandler: RequestHandler = (_req, res) => {
  // 404 = Not Found
  res.status(404).json({ success: false, message: "Not found" });
};

// The "last line of defense": any error that escapes a route lands here (Express recognizes it by its 4 parameters)
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // Body-parser errors (broken JSON, body too large) carry an HTTP status of their own (4xx = the client's fault)
  const status = typeof error?.status === "number" ? error.status : 500;
  // Client mistakes: tell them what was wrong, in our JSON shape
  if (status >= 400 && status < 500) {
    // Broken JSON gets a specific message; other client errors get a generic one
    const message = error.type === "entity.parse.failed" ? "Invalid JSON in request body" : "Invalid request";
    // Send it with the matching status (400 bad JSON, 413 body too large, ...)
    return res.status(status).json({ success: false, message });
  }
  // Our own bug: log details on the server ONLY, never send them to the client
  console.error("Unhandled error:", error);
  // 500 = Server Error
  res.status(500).json({ success: false, message: "Something went wrong" });
};
