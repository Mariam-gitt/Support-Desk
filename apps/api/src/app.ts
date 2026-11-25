
import express from "express";
// helmet = sets safe security headers on every response (blocks common browser attacks)
import helmet from "helmet";
// Node's path helper, used to build the folder path of the demo page
import path from "node:path";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
// Import the routes that live under a specific business: /api/orgs/:orgId/...
import orgRoutes from "./modules/organizations/org.routes.js";
// The "no route matched" and "something threw" handlers (JSON answers instead of HTML pages)
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
// The validated settings
import { env } from "./config/env.js";

// Create the Express application
const app = express();

// Safe security headers; the content-security-policy is relaxed in development only, so the inline demo page still works
app.use(env.NODE_ENV === "production" ? helmet() : helmet({ contentSecurityPolicy: false }));

// Parse incoming JSON request bodies, refusing anything bigger than 100 kilobytes
app.use(express.json({ limit: "100kb" }));

// Development only: serve files from the "public" folder (the real-time demo page at /realtime-test.html)
if (env.NODE_ENV !== "production") {
  // express.static serves plain files; process.cwd() is the folder you start the server from (apps/api)
  app.use(express.static(path.join(process.cwd(), "public")));
}

// Register health-check routes
app.use("/api/health", healthRoutes);

// Register authentication routes
app.use("/api/auth", authRoutes);

// Register organization routes (all protected by the authenticate + requireMembership guards)
app.use("/api/orgs", orgRoutes);

// Any URL that matched nothing above gets a JSON 404 (must come AFTER all routes)
app.use(notFoundHandler);

// Any error thrown above ends up here (must be the LAST middleware)
app.use(errorHandler);

// Export the app for server startup and testing
export default app;
