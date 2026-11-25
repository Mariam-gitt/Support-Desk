// The validated settings
import { env } from "../config/env.js";

// How many sends should fail on purpose (DEVELOPMENT ONLY: lets you watch retries happen; leave unset in real use)
let simulatedFailuresLeft = env.SIMULATE_NOTIFY_FAILURES;

// Send a notification to one person; for now it only logs, and later we plug in a real email provider here
export async function sendNotification(to: string, subject: string) {
  // While the simulation counter is above zero, pretend the email provider is down
  if (simulatedFailuresLeft > 0) {
    // Use up one simulated failure
    simulatedFailuresLeft -= 1;
    // Throwing an Error is how a job tells the queue "this attempt failed, please retry later"
    throw new Error("Simulated email provider outage");
  }
  // Pretend the email was sent (replace this line with a real provider call later)
  console.log(`[notify] to=${to} | ${subject}`);
}
