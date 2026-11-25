import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { createSessionForUser } from "../auth/auth.service.js";
import type { Role } from "../../generated/prisma/enums.js";

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", env.BCRYPT_ROUNDS);
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function inviteMember(
  orgId: string,
  inviterId: string,
  inviterRole: Role,
  input: { email: string; role: "ADMIN" | "AGENT" },
) {
  if (inviterRole === "ADMIN" && input.role !== "AGENT") return { ok: false, reason: "FORBIDDEN" } as const;
  const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (user) {
    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
      select: { id: true },
    });
    if (membership) return { ok: false, reason: "ALREADY_MEMBER" } as const;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.invitation.deleteMany({
      where: { organizationId: orgId, email: input.email, acceptedAt: null },
    });
    await tx.invitation.create({
      data: { organizationId: orgId, invitedById: inviterId, email: input.email, role: input.role, tokenHash: hashToken(token), expiresAt },
    });
  });
  return { ok: true, invitation: { email: input.email, role: input.role, token, expiresAt } } as const;
}

export async function acceptInvitation(input: { token: string; name: string; password: string }) {
  const tokenHash = hashToken(input.token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: { id: true, organizationId: true, email: true, role: true, expiresAt: true, acceptedAt: true },
  });
  const now = new Date();
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= now) return null;

  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, passwordHash: true },
  });
  const passwordMatches = await bcrypt.compare(input.password, existingUser?.passwordHash ?? DUMMY_HASH);
  if (existingUser && !passwordMatches) return null;
  const passwordHash = existingUser ? undefined : await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  const userId = await prisma.$transaction(async (tx) => {
    const currentInvitation = await tx.invitation.findUnique({
      where: { id: invitation.id },
      select: { acceptedAt: true, expiresAt: true },
    });
    if (!currentInvitation || currentInvitation.acceptedAt || currentInvitation.expiresAt <= now) return null;

    const currentUser = await tx.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });
    if (existingUser ? currentUser?.id !== existingUser.id : Boolean(currentUser)) return null;

    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now },
    });
    if (claimed.count !== 1) return null;

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      if (!passwordHash) return null;
      const createdUser = await tx.user.create({
        data: { name: input.name, email: invitation.email, passwordHash },
        select: { id: true },
      });
      userId = createdUser.id;
    }
    await tx.membership.create({
      data: { userId, organizationId: invitation.organizationId, role: invitation.role },
    });
    return userId;
  });
  if (!userId) return null;
  return createSessionForUser(userId);
}

export async function removeMember(orgId: string, actorId: string, actorRole: Role, targetUserId: string) {
  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: targetUserId },
    select: { id: true, role: true },
  });
  if (!membership) return { ok: false, reason: "NOT_FOUND" } as const;
  if (actorId === targetUserId) return { ok: false, reason: "SELF_REMOVAL" } as const;
  if (membership.role === "OWNER") return { ok: false, reason: "OWNER_PROTECTED" } as const;
  if (actorRole === "ADMIN" && membership.role !== "AGENT") return { ok: false, reason: "FORBIDDEN" } as const;

  await prisma.membership.deleteMany({
    where: { id: membership.id, organizationId: orgId },
  });
  return { ok: true, userId: targetUserId } as const;
}
