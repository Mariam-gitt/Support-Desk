import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { io as createClient } from "socket.io-client";
import { addMember, api, bearer, createWorkspace, PASSWORD, uniqueEmail } from "../helpers.js";
import { prisma } from "../../src/lib/prisma.js";
import app from "../../src/app.js";
import { closeRealtime, initRealtime } from "../../src/realtime/realtime.js";

describe("team invitations and membership management", () => {
  it("creates and accepts a one-time invitation with its assigned role", async () => {
    const owner = await createWorkspace();
    const stranger = await createWorkspace();
    const invalid = await api().post(`/api/orgs/${owner.orgId}/invitations`).set(bearer(owner.token)).send({ email: "bad", role: "AGENT" });
    expect(invalid.status).toBe(400);

    const unauthenticated = await api().post(`/api/orgs/${owner.orgId}/invitations`).send({ email: uniqueEmail(), role: "AGENT" });
    expect(unauthenticated.status).toBe(401);

    const outside = await api().post(`/api/orgs/${owner.orgId}/invitations`).set(bearer(stranger.token)).send({ email: uniqueEmail(), role: "AGENT" });
    expect(outside.status).toBe(404);

    const invitation = await api()
      .post(`/api/orgs/${owner.orgId}/invitations`)
      .set(bearer(owner.token))
      .send({ email: uniqueEmail("invite"), role: "ADMIN" });
    expect(invitation.status).toBe(201);
    expect(invitation.body.data).toMatchObject({ role: "ADMIN" });
    expect(invitation.body.data.token).toEqual(expect.any(String));
    expect(JSON.stringify(invitation.body)).not.toContain("tokenHash");

    const accept = await api().post("/api/auth/invitations/accept").send({
      token: invitation.body.data.token,
      name: "Invited Admin",
      password: PASSWORD,
    });
    expect(accept.status).toBe(200);
    expect(accept.body.data.memberships).toContainEqual(expect.objectContaining({ organizationId: owner.orgId, role: "ADMIN" }));
    expect(String(accept.headers["set-cookie"])).toMatch(/HttpOnly/i);
    expect((await api().post("/api/auth/invitations/accept").send({ token: "short", name: "x", password: "x" })).status).toBe(400);

    const replay = await api().post("/api/auth/invitations/accept").send({
      token: invitation.body.data.token,
      name: "Invited Admin",
      password: PASSWORD,
    });
    expect(replay.status).toBe(400);
  });

  it("limits admins to agent invitations and agent removals", async () => {
    const owner = await createWorkspace();
    const stranger = await createWorkspace();
    const admin = await addMember(owner.orgId, "ADMIN");
    const agent = await addMember(owner.orgId, "AGENT");
    const inviteAdmin = await api()
      .post(`/api/orgs/${owner.orgId}/invitations`)
      .set(bearer(admin.token))
      .send({ email: uniqueEmail("admin-invite"), role: "ADMIN" });
    expect(inviteAdmin.status).toBe(403);

    const inviteAgent = await api()
      .post(`/api/orgs/${owner.orgId}/invitations`)
      .set(bearer(admin.token))
      .send({ email: uniqueEmail("agent-invite"), role: "AGENT" });
    expect(inviteAgent.status).toBe(201);

    const removeAdmin = await api().delete(`/api/orgs/${owner.orgId}/members/${admin.userId}`).set(bearer(admin.token));
    expect(removeAdmin.status).toBe(409);

    const unauthenticated = await api().delete(`/api/orgs/${owner.orgId}/members/${agent.userId}`);
    expect(unauthenticated.status).toBe(401);
    const outside = await api().delete(`/api/orgs/${owner.orgId}/members/${agent.userId}`).set(bearer(stranger.token));
    expect(outside.status).toBe(404);

    const removeAgent = await api().delete(`/api/orgs/${owner.orgId}/members/${agent.userId}`).set(bearer(admin.token));
    expect(removeAgent.status).toBe(200);
    expect(await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: agent.userId, organizationId: owner.orgId } },
    })).toBeNull();
  });

  it("requires the existing account password before joining another business", async () => {
    const owner = await createWorkspace();
    const existing = await createWorkspace();
    const invitation = await api()
      .post(`/api/orgs/${owner.orgId}/invitations`)
      .set(bearer(owner.token))
      .send({ email: existing.email, role: "AGENT" });
    expect(invitation.status).toBe(201);

    const wrongPassword = await api().post("/api/auth/invitations/accept").send({
      token: invitation.body.data.token,
      name: "Existing Account",
      password: "wrong-password",
    });
    expect(wrongPassword.status).toBe(400);

    const accepted = await api().post("/api/auth/invitations/accept").send({
      token: invitation.body.data.token,
      name: "Existing Account",
      password: PASSWORD,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.memberships).toContainEqual(expect.objectContaining({ organizationId: owner.orgId, role: "AGENT" }));
  });

  it("disconnects a removed member's socket from the business", async () => {
    const owner = await createWorkspace();
    const agent = await addMember(owner.orgId, "AGENT");
    const server = createServer(app);
    initRealtime(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const client = createClient(`http://127.0.0.1:${address.port}`, {
      autoConnect: false,
      transports: ["websocket"],
      auth: { token: agent.token },
    });

    try {
      const connected = new Promise<void>((resolve, reject) => {
        client.once("connect", resolve);
        client.once("connect_error", reject);
      });
      client.connect();
      await connected;
      const joined = await new Promise<{ ok: boolean }>((resolve) => client.emit("org:join", owner.orgId, resolve));
      expect(joined.ok).toBe(true);

      const disconnected = new Promise<string>((resolve) => client.once("disconnect", resolve));
      const removed = await api().delete(`/api/orgs/${owner.orgId}/members/${agent.userId}`).set(bearer(owner.token));
      expect(removed.status).toBe(200);
      expect(await disconnected).toBe("io server disconnect");
    } finally {
      client.close();
      await closeRealtime();
    }
  });
});
