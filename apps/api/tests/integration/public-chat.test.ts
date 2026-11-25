import { describe, expect, it } from "vitest";
import { api, bearer, createWorkspace } from "../helpers.js";
import { prisma } from "../../src/lib/prisma.js";

describe("public customer conversations", () => {
  it("creates a customer ticket, stores customer message types, and protects follow-ups with a capability", async () => {
    const owner = await createWorkspace();
    const stranger = await createWorkspace();
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: owner.orgId },
      select: { slug: true },
    });
    expect((await api().get("/api/public/widget/not-a-real-business")).status).toBe(404);

    const invalid = await api().post(`/api/public/widget/${organization.slug}/conversations`).send({
      customer: { name: "A", email: "not-an-email" },
      subject: "x",
      body: "",
    });
    expect(invalid.status).toBe(400);

    const created = await api().post(`/api/public/widget/${organization.slug}/conversations`).send({
      customer: { name: "Customer One", email: "customer@example.com" },
      subject: "Order issue",
      body: "My order has not arrived.",
    });
    expect(created.status).toBe(201);
    expect(created.body.data.accessToken).toEqual(expect.any(String));
    const ticketId = created.body.data.ticket.id as string;
    const token = created.body.data.accessToken as string;

    const noToken = await api().get(`/api/public/conversations/${ticketId}`);
    expect(noToken.status).toBe(401);
    const wrongToken = await api().get(`/api/public/conversations/${ticketId}`).set(bearer(stranger.token));
    expect(wrongToken.status).toBe(404);
    expect((await api().post(`/api/public/conversations/${ticketId}/messages`).send({ body: "No capability" })).status).toBe(401);
    expect((await api().post(`/api/public/conversations/${ticketId}/messages`).set(bearer(stranger.token)).send({ body: "Wrong capability" })).status).toBe(404);
    expect((await api().post(`/api/public/conversations/${ticketId}/messages`).set(bearer(token)).send({ body: "" })).status).toBe(400);

    const thread = await api().get(`/api/public/conversations/${ticketId}`).set(bearer(token));
    expect(thread.status).toBe(200);
    expect(thread.body.data.messages[0].sender).toEqual({ type: "CUSTOMER", name: "Customer One" });

    const followUp = await api()
      .post(`/api/public/conversations/${ticketId}/messages`)
      .set(bearer(token))
      .send({ body: "Any update?" });
    expect(followUp.status).toBe(201);
    expect(followUp.body.data.sender.type).toBe("CUSTOMER");

    const staffView = await api().get(`/api/orgs/${owner.orgId}/tickets/${ticketId}`).set(bearer(owner.token));
    expect(staffView.status).toBe(200);
    expect(staffView.body.data.messages.map((message: { sender: { type: string } }) => message.sender.type)).toEqual(["CUSTOMER", "CUSTOMER"]);
  });

  it("does not allow public messages on closed tickets", async () => {
    const owner = await createWorkspace();
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: owner.orgId }, select: { slug: true } });
    const created = await api().post(`/api/public/widget/${organization.slug}/conversations`).send({
      customer: { name: "Customer Two", email: "customer2@example.com" },
      subject: "Close me",
      body: "Initial message",
    });
    const ticketId = created.body.data.ticket.id as string;
    const token = created.body.data.accessToken as string;

    await api().patch(`/api/orgs/${owner.orgId}/tickets/${ticketId}/status`).set(bearer(owner.token)).send({ status: "IN_PROGRESS" });
    await api().patch(`/api/orgs/${owner.orgId}/tickets/${ticketId}/status`).set(bearer(owner.token)).send({ status: "RESOLVED" });
    await api().patch(`/api/orgs/${owner.orgId}/tickets/${ticketId}/status`).set(bearer(owner.token)).send({ status: "CLOSED" });
    const response = await api()
      .post(`/api/public/conversations/${ticketId}/messages`)
      .set(bearer(token))
      .send({ body: "Please reopen this." });
    expect(response.status).toBe(409);
  });
});
