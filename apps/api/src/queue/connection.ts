// The validated settings
import { env } from "../config/env.js";
// ioredis = the Redis client library BullMQ talks through (Redis = a very fast in-memory database, here used as the job list)
import { Redis } from "ioredis";

// Create a Redis connection, or return null when REDIS_URL is not configured (so the app still runs without Redis)
export function createRedisConnection(role: "producer" | "worker"): Redis | null {
  // Read the Redis address from the environment, e.g. redis://localhost:6379
  const url = env.REDIS_URL;
  // No address means the queue feature is switched off
  if (!url) return null;

  // The API only ADDS jobs ("producer"): if Redis is down we want to fail fast, not hang the user's request
  if (role === "producer") {
    // enableOfflineQueue: false = do not store commands while disconnected; fail immediately instead
    return new Redis(url, { enableOfflineQueue: false });
  }

  // The worker WAITS for jobs: BullMQ requires maxRetriesPerRequest: null so waiting commands never give up
  return new Redis(url, { maxRetriesPerRequest: null });
}
