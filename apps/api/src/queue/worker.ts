// Worker = BullMQ's class that takes jobs from the queue and runs them
import { Worker } from "bullmq";
// The validated settings (imported first, so a configuration mistake is reported before anything else happens)
import "../config/env.js";
// Our helper that creates the Redis connection
import { createRedisConnection } from "./connection.js";
// The queue name and the types shared with the API
import { QUEUE_NAME, type JobData, type JobName } from "./queues.js";
// The shared database client, closed politely on shutdown
import { prisma } from "../lib/prisma.js";
// The job handlers (the actual work)
import { ticketCreatedNotification } from "../jobs/ticketCreatedNotification.js";
import { slaFirstResponseCheck } from "../jobs/slaFirstResponseCheck.js";

// The worker needs Redis; without it there is nothing to listen to
const connection = createRedisConnection("worker");
// Stop with a clear message if Redis is not configured
if (!connection) {
  // Explain what to do
  console.error("REDIS_URL is not set. Add it to your .env file to run the worker.");
  // Exit with an error code
  process.exit(1);
}

// Create the worker: it waits for jobs and calls the function below for each one
const worker = new Worker<JobData, void, JobName>(
  // Which queue to listen to (must match the API's queue name)
  QUEUE_NAME,
  // The function that runs for every job; "job.name" tells us which kind it is
  async (job) => {
    // Pick the right handler for this kind of job
    switch (job.name) {
      // New ticket: notify the managers
      case "ticket-created-notification":
        return ticketCreatedNotification(job.data);
      // Deadline reached: check that someone replied
      case "sla-first-response-check":
        return slaFirstResponseCheck(job.data);
    }
  },
  // Worker settings
  {
    // Use our Redis connection
    connection,
    // Run up to 5 jobs at the same time (jobs mostly wait on the network, so this is cheap)
    concurrency: 5,
  },
);

// Runs after a job finishes successfully
worker.on("completed", (job) => console.log(`[worker] done   ${job.name} (${job.id})`));
// Runs after an attempt fails; BullMQ retries automatically until "attempts" is used up
worker.on("failed", (job, error) =>
  console.error(`[worker] failed ${job?.name} (${job?.id}) attempt ${job?.attemptsMade}/${job?.opts.attempts}: ${error.message}`),
);
// Runs on connection-level problems (log them instead of crashing)
worker.on("error", (error) => console.error("[worker] error:", error.message));

// Tell the person the worker is alive
console.log(`[worker] listening on queue "${QUEUE_NAME}"`);

// Graceful shutdown: finish the job in progress, then close connections (so no job is cut in half)
async function shutdown() {
  // Say what is happening
  console.log("[worker] shutting down...");
  // Stop taking new jobs and wait for running ones to finish
  await worker.close();
  // Close the database connection
  await prisma.$disconnect();
  // Exit normally
  process.exit(0);
}
// Ctrl+C in the terminal
process.on("SIGINT", shutdown);
// A "please stop" signal from a hosting platform (Docker, Railway, etc.)
process.on("SIGTERM", shutdown);
