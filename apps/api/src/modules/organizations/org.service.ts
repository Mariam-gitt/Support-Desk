// Import the shared database client (Prisma)
import { prisma } from "../../lib/prisma.js";

// Fetch one business by id (the guards already proved the caller belongs to it)
export async function getOrganization(orgId: string) {
  // findUnique returns one row (or null) when searching by a unique field like id
  return prisma.organization.findUnique({
    // Search condition: the business id
    where: { id: orgId },
    // "select" = pick only the columns we want to send back (a safe habit: never return more than needed)
    select: { id: true, name: true, createdAt: true },
  });
}

// List every member of one business, with their role
export async function listMembers(orgId: string) {
  // findMany returns an array of rows
  const memberships = await prisma.membership.findMany({
    // TENANT FILTER: only rows of THIS business (never forget this line, it is what isolates tenants)
    where: { organizationId: orgId },
    // Also fetch the related user row for each membership
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Reshape the rows into a clean, safe response (no passwordHash, no internal ids we do not need)
  return memberships.map((m) => ({
    // The user's id
    userId: m.user.id,
    // The user's name
    name: m.user.name,
    // The user's email
    email: m.user.email,
    // The user's role inside this business
    role: m.role,
  }));
}
