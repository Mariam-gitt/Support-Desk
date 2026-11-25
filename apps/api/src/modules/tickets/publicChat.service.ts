import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function getPublicWidget(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export async function startPublicConversation(
  slug: string,
  input: { customer: { name: string; email: string }; subject: string; body: string },
) {
  const organization = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  if (!organization) return null;

  const token = randomBytes(32).toString("base64url");
  const conversation = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: input.customer.email } },
      create: { organizationId: organization.id, name: input.customer.name, email: input.customer.email },
      update: {},
      select: { id: true, name: true, email: true },
    });
    const ticket = await tx.ticket.create({
      data: {
        organizationId: organization.id,
        customerId: customer.id,
        subject: input.subject,
        description: input.body,
        publicTokenHash: hashToken(token),
      },
      select: { id: true, subject: true, status: true, createdAt: true },
    });
    const message = await tx.message.create({
      data: { ticketId: ticket.id, customerId: customer.id, senderType: "CUSTOMER", body: input.body },
      select: { id: true, body: true, createdAt: true },
    });
    return { ticket, customer, message };
  });
  return { ...conversation, accessToken: token, organizationId: organization.id };
}

export async function getPublicConversation(ticketId: string, token: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, publicTokenHash: hashToken(token) },
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      customer: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderType: true,
          sender: { select: { name: true } },
          customer: { select: { name: true } },
        },
      },
    },
  });
  if (!ticket) return null;
  return {
    ...ticket,
    messages: ticket.messages.map(({ senderType, sender, customer, ...message }) => ({
      ...message,
      sender: {
        type: senderType,
        name: senderType === "STAFF" ? sender?.name ?? "Former staff member" : customer?.name ?? "Customer",
      },
    })),
  };
}

export async function addPublicMessage(ticketId: string, token: string, body: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, publicTokenHash: hashToken(token) },
    select: { id: true, organizationId: true, customerId: true, status: true },
  });
  if (!ticket) return { ok: false, reason: "NOT_FOUND" } as const;
  if (ticket.status === "CLOSED") return { ok: false, reason: "TICKET_CLOSED" } as const;

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { ticketId: ticket.id, customerId: ticket.customerId, senderType: "CUSTOMER", body },
      select: { id: true, body: true, createdAt: true, senderType: true, customer: { select: { id: true, name: true } } },
    }),
    prisma.ticket.updateMany({
      where: { id: ticket.id, organizationId: ticket.organizationId },
      data: { updatedAt: new Date() },
    }),
  ]);
  return {
    ok: true,
    organizationId: ticket.organizationId,
    message: {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      sender: { id: message.customer?.id ?? null, name: message.customer?.name ?? "Customer", type: message.senderType },
    },
  } as const;
}
