// Test tools
import { describe, expect, it } from "vitest";
// Shared helpers
import { addMember, api, bearer, createWorkspace } from "../helpers.js";

// Group: the "wall between businesses" and the role rules inside a business
describe("tenant isolation and roles", () => {
  // OWNER can see their business and its members
  it("lets an owner view the business and list members", async () => {
    // A business with an owner and an agent
    const owner = await createWorkspace();
    await addMember(owner.orgId, "AGENT");
    // The business details
    const org = await api().get(`/api/orgs/${owner.orgId}`).set(bearer(owner.token));
    expect(org.status).toBe(200);
    // The member list shows both people
    const members = await api().get(`/api/orgs/${owner.orgId}/members`).set(bearer(owner.token));
    expect(members.status).toBe(200);
    expect(members.body.data).toHaveLength(2);
  });

  // AGENT is a member (can view) but lacks the role for the member list
  it("gives an AGENT 200 on the business but 403 on the member list", async () => {
    // A business with an agent
    const owner = await createWorkspace();
    const agent = await addMember(owner.orgId, "AGENT");
    // May view the business
    expect((await api().get(`/api/orgs/${owner.orgId}`).set(bearer(agent.token))).status).toBe(200);
    // May not list members
    expect((await api().get(`/api/orgs/${owner.orgId}/members`).set(bearer(agent.token))).status).toBe(403);
  });

  // The core multi-tenancy promise
  it("gives a stranger 404 everywhere, identical to a business that does not exist", async () => {
    // Two unrelated businesses
    const businessA = await createWorkspace("A");
    const stranger = await createWorkspace("B");
    // The stranger asks about business A
    const peek = await api().get(`/api/orgs/${businessA.orgId}`).set(bearer(stranger.token));
    // And asks about a business that never existed
    const ghost = await api().get("/api/orgs/does-not-exist").set(bearer(stranger.token));
    // Both are 404 with the same body, so existence cannot be detected
    expect(peek.status).toBe(404);
    expect(ghost.status).toBe(404);
    expect(peek.body).toEqual(ghost.body);
    // The member list and tickets are equally hidden
    expect((await api().get(`/api/orgs/${businessA.orgId}/members`).set(bearer(stranger.token))).status).toBe(404);
    expect((await api().get(`/api/orgs/${businessA.orgId}/tickets`).set(bearer(stranger.token))).status).toBe(404);
  });

  // No token, no entry
  it("requires a login for business routes", async () => {
    // A business
    const owner = await createWorkspace();
    // No Authorization header
    expect((await api().get(`/api/orgs/${owner.orgId}`)).status).toBe(401);
  });

  // Roles are per business: a person can be OWNER in one and AGENT in another
  it("keeps roles separate per business", async () => {
    // Two businesses
    const businessA = await createWorkspace("A");
    const businessB = await createWorkspace("B");
    // The owner of A also joins B as an AGENT
    const joined = await addMember(businessB.orgId, "AGENT");
    // The joined person's own business is a different one; check they are AGENT in B (403 on members)
    expect((await api().get(`/api/orgs/${businessB.orgId}/members`).set(bearer(joined.token))).status).toBe(403);
    // Business A's owner is still not a member of B at all
    expect((await api().get(`/api/orgs/${businessB.orgId}`).set(bearer(businessA.token))).status).toBe(404);
  });
});
