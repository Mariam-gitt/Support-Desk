import type { Request, Response } from "express";
import { enqueueTicketCreatedJobs } from "../../queue/queues.js";
import { emitToOrg } from "../../realtime/realtime.js";
import { addPublicMessage, getPublicConversation, getPublicWidget, startPublicConversation } from "./publicChat.service.js";
import { publicMessageSchema, startConversationSchema } from "./publicChat.schema.js";

function readAccessToken(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function getPublicWidgetController(req: Request, res: Response) {
  try {
    const organization = await getPublicWidget(req.params.slug as string);
    if (!organization) return res.status(404).json({ success: false, message: "Not found" });
    return res.status(200).json({ success: true, data: { name: organization.name, slug: organization.slug } });
  } catch (error) {
    console.error("Get public widget error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

export async function startPublicConversationController(req: Request, res: Response) {
  const validation = startConversationSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: "Invalid conversation", errors: validation.error.flatten().fieldErrors });
  }
  try {
    const result = await startPublicConversation(req.params.slug as string, validation.data);
    if (!result) return res.status(404).json({ success: false, message: "Not found" });
    emitToOrg(result.organizationId, "ticket.created", result.ticket);
    emitToOrg(result.organizationId, "message.created", { ticketId: result.ticket.id, message: result.message });
    void enqueueTicketCreatedJobs(result.organizationId, result.ticket.id);
    const { ticket, customer, message, accessToken } = result;
    return res.status(201).json({ success: true, data: { ticket, customer, message, accessToken } });
  } catch (error) {
    console.error("Start public conversation error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

export async function getPublicConversationController(req: Request, res: Response) {
  const token = readAccessToken(req);
  if (!token) return res.status(401).json({ success: false, message: "Conversation access token required" });
  try {
    const conversation = await getPublicConversation(req.params.ticketId as string, token);
    if (!conversation) return res.status(404).json({ success: false, message: "Not found" });
    return res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    console.error("Get public conversation error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

export async function addPublicMessageController(req: Request, res: Response) {
  const token = readAccessToken(req);
  if (!token) return res.status(401).json({ success: false, message: "Conversation access token required" });
  const validation = publicMessageSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: "Invalid message", errors: validation.error.flatten().fieldErrors });
  }
  try {
    const result = await addPublicMessage(req.params.ticketId as string, token, validation.data.body);
    if (!result.ok && result.reason === "NOT_FOUND") return res.status(404).json({ success: false, message: "Not found" });
    if (!result.ok) return res.status(409).json({ success: false, message: "This ticket is closed" });
    emitToOrg(result.organizationId, "message.created", { ticketId: req.params.ticketId, message: result.message });
    return res.status(201).json({ success: true, data: result.message });
  } catch (error) {
    console.error("Add public message error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}
