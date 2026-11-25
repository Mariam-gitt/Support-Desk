import type { Request, Response } from "express";
import { setRefreshCookie } from "../../lib/refreshCookie.js";
import { acceptInvitation } from "./team.service.js";
import { acceptInvitationSchema } from "./team.schema.js";

export async function acceptInvitationController(req: Request, res: Response) {
  const validation = acceptInvitationSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: "Invalid invitation data", errors: validation.error.flatten().fieldErrors });
  }
  try {
    const result = await acceptInvitation(validation.data);
    if (!result) return res.status(400).json({ success: false, message: "Invitation is invalid, expired, used, or credentials do not match" });
    const { refreshToken, ...session } = result;
    setRefreshCookie(res, refreshToken);
    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return res.status(409).json({ success: false, message: "This account is already a member of the business" });
    }
    console.error("Accept invitation error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}
