// Queue = BullMQ's class for adding jobs to a named list stored in Redis
import { Queue } from "bullmq";
// Our helper that creates the Redis connection (or null when Redis is not configured)
import { createRedisConnection } from "./connection.js";
// The validated settings
import { env } from "../config/env.js";

// The name of the one queue we use; the API and the worker must use the SAME name to find each other
export const QUEUE_NAME = "support-desk";

// Every kind of job we have, as a fixed list (avoids typos)
export type JobName = "ticket-created-notification" | "sla-first-response-check";

// The data each job carries: just ids, never whole records (the worker reads fresh data from the database)
export type JobData = { organizationId: string; ticketId: string };

// Holds the queue once created; undefined = not created yet, null = Redis not configured
let queue: Queue<JobData, void, JobName> | null | undefined;

// Create the queue the first time it is needed, then reuse it (a "lazy singleton")
function getQueue() {
  // Already decided before? Return that answer
  if (queue !== undefined) return queue;
  // Ask for a producer connection
  const connection = createRedisConnection("producer");
  // Without Redis we warn once and disable queueing instead of crashing
  if (!connection) {
    console.warn("REDIS_URL is not set: background jobs are disabled");
    queue = null;
    return queue;
  }
  // Create the queue with default settings applied to every job
  queue = new Queue<JobData, void, JobName>(QUEUE_NAME, {
    // Use our Redis connection
    connection,
    // Settings every job inherits unless overridden
    defaultJobOptions: {
      // Try up to 5 times in total before giving up (retries handle temporary failures like an email outage)
      attempts: 5,
      // Wait longer between each retry: 2s, 4s, 8s, 16s ("exponential backoff" avoids hammering a struggling service)
      backoff: { type: "exponential", delay: 2000 },
      // Keep finished jobs for 1 hour (max 1000) so Redis does not fill up
      removeOnComplete: { age: 3600, count: 1000 },
      // Keep failed jobs for 7 days so a human can inspect them (this is a simple "dead letter" store)
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
  // If Redis drops, log the problem instead of crashing the API (unhandled "error" events would crash Node)
  queue.on("error", (error) => console.error("Queue error:", error.message));
  // Return the ready queue
  return queue;
}

// How long to wait before checking that a ticket got a first reply, in milliseconds (the setting is in minutes; default 15)
function slaDelayMs() {
  // Minutes to milliseconds
  return env.SLA_FIRST_RESPONSE_MINUTES * 60 * 1000;
}

// Schedule the background work for a brand-new ticket; NEVER throws, because a queue problem must not break ticket creation
export async function enqueueTicketCreatedJobs(organizationId: string, ticketId: string) {
  // Get the queue (null means background jobs are switched off)
  const q = getQueue();
  // Nothing to do without a queue
  if (!q) return;
  try {
    // The data both jobs share
    const data = { organizationId, ticketId };
    // Job 1: notify managers right away. A fixed jobId makes adding it twice harmless (idempotent)
    await q.add("ticket-created-notification", data, { jobId: `notify-${ticketId}` });
    // Job 2: check later whether anyone replied; "delay" keeps it waiting in Redis until the SLA time has passed
    await q.add("sla-first-response-check", data, { jobId: `sla-${ticketId}`, delay: slaDelayMs() });
  } catch (error) {
    // Log it and move on; the ticket itself was already saved
    console.error("Could not enqueue ticket jobs:", error);
  }
}
