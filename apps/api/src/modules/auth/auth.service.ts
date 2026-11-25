import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import type { z } from "zod";
import type { loginSchema, registerSchema } from "./auth.schema.js";
// Import our helper that creates a login token (JWT)
import { signToken } from "../../lib/jwt.js";

// Infer the TypeScript type from our Zod validation schema
type RegisterInput = z.infer<typeof registerSchema>;
// Same idea for the login form: the TypeScript shape of { email, password }
type LoginInput = z.infer<typeof loginSchema>;

// A fake bcrypt hash used when the email does not exist, so a wrong email takes as long as a wrong password
// (otherwise an attacker could measure response time to discover which emails are registered: a "timing attack")
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

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

// Check email + password and return a token plus the user's businesses, or null if the login is wrong
export async function loginUser(data: LoginInput) {
  // Look up the user by email (email is @unique in the schema, so findUnique works) and load their memberships
  const user = await prisma.user.findUnique({
    // Search condition: the email the person typed
    where: { email: data.email },
    // "include" = also fetch related rows; here each membership together with its organization
    include: { memberships: { include: { organization: true } } },
  });

  // Compare the typed password with the stored hash; use the dummy hash if no user was found (see DUMMY_HASH above)
  const passwordMatches = await bcrypt.compare(data.password, user ? user.passwordHash : DUMMY_HASH);

  // Same answer for "no such email" and "wrong password" so attackers learn nothing
  if (!user || !passwordMatches) {
    // null tells the controller that the login failed
    return null;
  }

  // Create a token that carries only the user id
  const token = signToken(user.id);

  // Return the token and only information that is safe to expose (never the passwordHash)
  return {
    // The token the frontend will store and send with every later request
    token,
    // Basic public details of the user
    user: { id: user.id, name: user.name, email: user.email },
    // Every business this user belongs to, with their role in each
    memberships: user.memberships.map((m) => ({
      // Which business
      organizationId: m.organizationId,
      // The business name, handy for showing a workspace switcher
      organizationName: m.organization.name,
      // The user's role in that business (OWNER, ADMIN or AGENT)
      role: m.role,
    })),
  };
}

// Load the currently logged-in user (found via the token) with their businesses; null if the user no longer exists
export async function getProfile(userId: string) {
  // Fetch the user by primary key (id) and include memberships with their organizations
  const user = await prisma.user.findUnique({
    // Search condition: the id that came from the verified token
    where: { id: userId },
    // Also fetch each membership and its organization
    include: { memberships: { include: { organization: true } } },
  });

  // The account may have been deleted after the token was issued
  if (!user) {
    // null tells the controller to answer 401
    return null;
  }

  // Return only safe fields, in the same shape as login
  return {
    // Basic public details of the user
    user: { id: user.id, name: user.name, email: user.email },
    // Every business this user belongs to, with their role in each (always fresh from the DB)
    memberships: user.memberships.map((m) => ({
      // Which business
      organizationId: m.organizationId,
      // The business name
      organizationName: m.organization.name,
      // The user's role in that business
      role: m.role,
    })),
  };
}
