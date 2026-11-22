
import express from "express";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";

// Create the Express application
const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// Register health-check routes
app.use("/api/health", healthRoutes);

// Register authentication routes
app.use("/api/auth", authRoutes);

// Export the app for server startup and testing
export default app;
