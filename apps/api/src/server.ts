
import "dotenv/config";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";

// Read the port from environment variables
const PORT = process.env.PORT || 5000;

// Connect to the database before starting the API
async function startServer() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully!");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }
}

// Start the application
startServer();
