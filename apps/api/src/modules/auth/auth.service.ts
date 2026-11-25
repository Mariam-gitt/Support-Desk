import bcrypt from "bcrypt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
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
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", env.BCRYPT_ROUNDS);

function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createRefreshToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(now.getTime() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    await tx.refreshToken.deleteMany({ where: { userId, expiresAt: { lte: now } } });
  });
  return token;
}

async function buildSession(userId: string, refreshToken: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: { select: { organizationId: true, role: true, organization: { select: { name: true } } } },
    },
  });
  if (!user) return null;
  return {
    token: signToken(user.id),
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email },
    memberships: user.memberships.map((m) => ({
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      role: m.role,
    })),
  };
}

export async function createSessionForUser(userId: string) {
  const refreshToken = await createRefreshToken(userId);
  return buildSession(userId, refreshToken);
}

// Register a new organization owner
export async function registerUser(data: RegisterInput) {
  // Hash the password before storing it
  const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);

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
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      memberships: { select: { organizationId: true, role: true, organization: { select: { name: true } } } },
    },
  });

  // Compare the typed password with the stored hash; use the dummy hash if no user was found (see DUMMY_HASH above)
  const passwordMatches = await bcrypt.compare(data.password, user ? user.passwordHash : DUMMY_HASH);

  // Same answer for "no such email" and "wrong password" so attackers learn nothing
  if (!user || !passwordMatches) {
    // null tells the controller that the login failed
    return null;
  }

  const refreshToken = await createRefreshToken(user.id);
  return buildSession(user.id, refreshToken);
}

export async function refreshSession(token: string) {
  const now = new Date();
  const tokenHash = hashOpaqueToken(token);
  const replacement = randomBytes(32).toString("base64url");
  const userId = await prisma.$transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({ where: { tokenHash }, select: { id: true, userId: true, expiresAt: true, revokedAt: true } });
    if (!stored || stored.revokedAt || stored.expiresAt <= now) return null;
    const claimed = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (claimed.count !== 1) return null;
    await tx.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: hashOpaqueToken(replacement),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    await tx.refreshToken.deleteMany({ where: { id: stored.id } });
    await tx.refreshToken.deleteMany({ where: { userId: stored.userId, expiresAt: { lte: now } } });
    return stored.userId;
  });
  if (!userId) return null;
  return buildSession(userId, replacement);
}

export async function revokeRefreshToken(token: string | null | undefined) {
  if (!token) return;
  await prisma.refreshToken.deleteMany({
    where: { tokenHash: hashOpaqueToken(token) },
  });
}

// Load the currently logged-in user (found via the token) with their businesses; null if the user no longer exists
export async function getProfile(userId: string) {
  // Fetch the user by primary key (id) and include memberships with their organizations
  const user = await prisma.user.findUnique({
    // Search condition: the id that came from the verified token
    where: { id: userId },
    // Also fetch each membership and its organization
    select: {
      id: true,
      name: true,
      email: true,
      memberships: { select: { organizationId: true, role: true, organization: { select: { name: true } } } },
    },
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
