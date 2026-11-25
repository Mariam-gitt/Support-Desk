import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockFetch, renderApp } from "../test/utils.js";

vi.mock("../realtime/useRealtime.js", () => ({ useRealtime: () => false }));

describe("public customer chat", () => {
  it("creates a customer conversation and shows sender types", async () => {
    const fake = mockFetch({
      "GET /api/public/widget/shop": { body: { success: true, data: { name: "Shop", slug: "shop" } } },
      "POST /api/public/widget/shop/conversations": {
        status: 201,
        body: { success: true, data: { ticket: { id: "ticket-1" }, accessToken: "customer-capability" } },
      },
      "GET /api/public/conversations/ticket-1": {
        body: {
          success: true,
          data: {
            id: "ticket-1",
            subject: "Delivery help",
            status: "OPEN",
            messages: [
              { id: "m1", body: "Where is my order?", createdAt: "2026-11-25T10:00:00.000Z", sender: { type: "CUSTOMER", name: "Ali" } },
              { id: "m2", body: "We are checking.", createdAt: "2026-11-25T10:01:00.000Z", sender: { type: "STAFF", name: "Sara" } },
            ],
          },
        },
      },
    });
    renderApp("/chat/shop");
    await userEvent.type(await screen.findByLabelText("Name"), "Ali Khan");
    await userEvent.type(screen.getByLabelText("Email"), "ali@example.com");
    await userEvent.type(screen.getByLabelText("Subject"), "Delivery help");
    await userEvent.type(screen.getByLabelText("Message"), "Where is my order?");
    await userEvent.click(screen.getByRole("button", { name: "Start conversation" }));

    expect(await screen.findByText("Ali (You)")).toBeInTheDocument();
    expect(screen.getByText("Sara (Support)")).toBeInTheDocument();
    const request = fake.mock.calls.find(([url, init]) => String(url).endsWith("/conversations") && init?.method === "POST");
    expect(JSON.parse((request?.[1] as RequestInit).body as string)).toMatchObject({
      customer: { name: "Ali Khan", email: "ali@example.com" },
      subject: "Delivery help",
      body: "Where is my order?",
    });
  });
});
