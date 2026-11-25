// Import the shared database client (Prisma)
import { prisma } from "../lib/prisma.js";
// Import the shape of the data a job carries
import type { JobData } from "../queue/queues.js";

// Job: SLA = Service Level Agreement, a promise like "every ticket gets a first reply within 15 minutes"; this checks that promise
export async function slaFirstResponseCheck(data: JobData) {
  // Read the CURRENT state of the ticket (a lot may have happened since the job was scheduled)
  const ticket = await prisma.ticket.findFirst({
    // TENANT FILTER: the ticket must belong to the business named in the job
    where: { id: data.ticketId, organizationId: data.organizationId },
    // We need its status and how many messages it has
    select: { status: true, _count: { select: { messages: true } } },
  });
  // Ticket gone: nothing to check
  if (!ticket) return;

  // Anyone replied, or the ticket moved on from OPEN: the promise was kept (or no longer applies)
  if (ticket._count.messages > 0 || ticket.status !== "OPEN") {
    // Log the good outcome so the demo is easy to follow
    console.log(`[sla] ticket ${data.ticketId}: first response OK`);
    // Done
    return;
  }

  // Still OPEN with no reply after the deadline: the promise was broken
  console.warn(`[sla] BREACH: ticket ${data.ticketId} has had no reply (business ${data.organizationId})`);
  // Later steps will turn this into a live alert and an escalation (it needs Redis-based real-time first)
}
