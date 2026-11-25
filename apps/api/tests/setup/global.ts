// Node's tool for running a command-line program from code
import { execSync } from "node:child_process";
// Import the function that configures the test environment
import { applyTestEnv } from "./testEnv.js";

// Runs once before all tests
export default async function setup() {
  // Point everything at the test database (and refuse unsafe ones)
  applyTestEnv();
  // Bring the test database schema up to date, unless you manage it yourself (TEST_SKIP_MIGRATE=true)
  if (process.env.TEST_SKIP_MIGRATE !== "true") {
    // "migrate deploy" applies every migration file in order; it reads DATABASE_URL, which now points at the test database
    execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
  }
  // Import the database client only NOW, after the environment was prepared
  const { prisma } = await import("../../src/lib/prisma.js");
  // Empty every table so each run starts clean (safe: the name check above guarantees this is a test database)
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Message", "Ticket", "Customer", "Membership", "Organization", "User" RESTART IDENTITY CASCADE');
  // Close the connection so the process can exit
  await prisma.$disconnect();
}
