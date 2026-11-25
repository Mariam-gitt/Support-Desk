// Import the shared database client (Prisma)
import { prisma } from "../../lib/prisma.js";

// List the customers of one business, optionally searching by name or email
export async function listCustomers(orgId: string, query: { search?: string | undefined; page: number; limit: number }) {
  // Build the WHERE condition; organizationId is ALWAYS present (the tenant filter)
  const where = {
    // TENANT FILTER: never list customers of another business
    organizationId: orgId,
    // Add the search only if the client sent one
    ...(query.search
      ? {
          // OR = match if the name OR the email contains the search text
          OR: [
            // contains + insensitive = "anywhere in the text, ignoring upper/lower case"
            { name: { contains: query.search, mode: "insensitive" as const } },
            // Same for the email
            { email: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // Run the page query and the total count together
  const [rows, total] = await prisma.$transaction([
    // The page of customers, newest first
    prisma.customer.findMany({
      // The filters from above
      where,
      // The columns to return, plus how many tickets each customer has
      select: { id: true, name: true, email: true, createdAt: true, _count: { select: { tickets: true } } },
      // Newest customers first
      orderBy: { createdAt: "desc" },
      // Skip earlier pages
      skip: (query.page - 1) * query.limit,
      // Take at most "limit" rows
      take: query.limit,
    }),
    // The total number of matching customers
    prisma.customer.count({ where }),
  ]);

  // Reshape: expose ticketCount instead of Prisma's internal _count
  const items = rows.map(({ _count, ...customer }) => ({ ...customer, ticketCount: _count.tickets }));
  // Return the page plus paging information
  return { items, page: query.page, limit: query.limit, total };
}

// Fetch ONE customer with their full ticket history; null if they are not in this business
export async function getCustomerHistory(orgId: string, customerId: string) {
  // findFirst because we filter by TWO fields: the customer id AND the business
  return prisma.customer.findFirst({
    // TENANT FILTER: a customer id from another business will not match
    where: { id: customerId, organizationId: orgId },
    // Choose the columns
    select: {
      // The customer's own details
      id: true,
      name: true,
      email: true,
      createdAt: true,
      // THE HISTORY: all their tickets, newest first (capped at 100 for safety)
      tickets: {
        // Newest ticket first
        orderBy: { createdAt: "desc" },
        // Never return an unlimited list
        take: 100,
        // Ticket columns for the history view
        select: { id: true, subject: true, status: true, priority: true, createdAt: true, updatedAt: true },
      },
    },
  });
}
