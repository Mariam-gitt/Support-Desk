import type { Request, Response } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import { disconnectUserFromOrg } from "../../realtime/realtime.js";
import { inviteMember, removeMember } from "./team.service.js";
import { inviteMemberSchema } from "./team.schema.js";

export async function inviteMemberController(req: Request, res: Response) {
  const validation = inviteMemberSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: "Invalid invitation", errors: validation.error.flatten().fieldErrors });
  }
  try {
    const membership = res.locals.membership as { role: Role };
    const result = await inviteMember(req.params.orgId as string, res.locals.userId as string, membership.role, validation.data);
    if (!result.ok && result.reason === "FORBIDDEN") {
      return res.status(403).json({ success: false, message: "Admins may invite agents only" });
    }
    if (!result.ok) return res.status(409).json({ success: false, message: "This person is already a member" });
    return res.status(201).json({ success: true, data: result.invitation });
  } catch (error) {
    console.error("Create invitation error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

export async function removeMemberController(req: Request, res: Response) {
  try {
    const membership = res.locals.membership as { role: Role };
    const result = await removeMember(req.params.orgId as string, res.locals.userId as string, membership.role, req.params.userId as string);
    if (!result.ok && result.reason === "NOT_FOUND") return res.status(404).json({ success: false, message: "Not found" });
    if (!result.ok && result.reason === "FORBIDDEN") {
      return res.status(403).json({ success: false, message: "Admins may remove agents only" });
    }
    if (!result.ok && result.reason === "SELF_REMOVAL") {
      return res.status(409).json({ success: false, message: "You cannot remove your own membership" });
    }
    if (!result.ok) return res.status(409).json({ success: false, message: "The business owner cannot be removed" });
    await disconnectUserFromOrg(result.userId, req.params.orgId as string);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}
