// Import the shared database client (Prisma)
import { prisma } from "../lib/prisma.js";
// Import the function that sends one notification
import { sendNotification } from "../lib/notifier.js";
// Import the shape of the data a job carries
import type { JobData } from "../queue/queues.js";

// Job: tell the business's OWNERs and ADMINs that a new ticket arrived
export async function ticketCreatedNotification(data: JobData) {
  // Read FRESH data from the database (the job only carried ids; the ticket may have changed since)
  const ticket = await prisma.ticket.findFirst({
    // TENANT FILTER: the ticket must belong to the business named in the job
    where: { id: data.ticketId, organizationId: data.organizationId },
    // Only the columns we need
    select: { subject: true, priority: true },
  });
  // If the ticket vanished, there is nothing to notify about; finishing quietly means "do not retry"
  if (!ticket) return;

  // Find the people who should be told: owners and admins of THIS business only
  const managers = await prisma.membership.findMany({
    // TENANT FILTER plus the role filter ("in" = any of these values)
    where: { organizationId: data.organizationId, role: { in: ["OWNER", "ADMIN"] } },
    // We only need their email addresses
    select: { user: { select: { email: true } } },
  });

  // Notify each manager one by one
  for (const manager of managers) {
    // If this throws, the whole job fails and BullMQ retries it later with backoff
    await sendNotification(manager.user.email, `New ${ticket.priority} ticket: ${ticket.subject}`);
  }
}
