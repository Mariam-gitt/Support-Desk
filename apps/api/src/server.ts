
// The validated settings (imported first so a configuration mistake is reported before anything else happens)
import { env } from "./config/env.js";
// Node's built-in HTTP module; we need the raw server so Express and Socket.IO can share one port
import { createServer } from "node:http";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";
// Import the function that starts real-time (Socket.IO) support
import { initRealtime } from "./realtime/realtime.js";

// Read the port from environment variables
const PORT = env.PORT;

// Connect to the database before starting the API
async function startServer() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully!");

    // Wrap the Express app in a plain HTTP server (app.listen would hide this server from us)
    const httpServer = createServer(app);
    // Attach Socket.IO to the same HTTP server, so one port serves both the REST API and real-time events
    initRealtime(httpServer);
    // Start listening for connections
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }
}

// Start the application
startServer();
