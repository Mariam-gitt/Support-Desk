import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import type { z } from "zod";
import type { registerSchema } from "./auth.schema.js";

// Infer the TypeScript type from our Zod validation schema
type RegisterInput = z.infer<typeof registerSchema>;

// Register a new organization owner
export async function registerUser(data: RegisterInput) {
  // Hash the password before storing it
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Create a URL-friendly, unique organization slug
  const slug =
    data.organizationName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
    "-" +
    randomUUID().slice(0, 8);

  // Create all related records in one database transaction
  const result = await prisma.$transaction(
    async (tx) => {
      // Create the organization
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug,
        },
      });

      // Create the owner's user account
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
        },
      });

      // Connect the user to the organization as its owner
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "OWNER",
        },
      });

      // Return only information safe to expose
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        organization,
      };
    },
    { maxWait: 10_000 },
  );

  return result;
}