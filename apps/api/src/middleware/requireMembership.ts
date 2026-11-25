// Import TypeScript types for Express: Request (incoming), Response (outgoing), NextFunction (go to the next step)
import type { NextFunction, Request, Response } from "express";
// Import the shared database client (Prisma) so we can look up memberships
import { prisma } from "../lib/prisma.js";

// Guard #2: confirms the logged-in user belongs to the business named in the URL (/api/orgs/:orgId/...)
// This is the "wall between flats" from multi-tenancy: no membership = you cannot even see that the business exists
export async function requireMembership(req: Request, res: Response, next: NextFunction) {
  try {
    // The business id comes from the URL; ":orgId" in the route path becomes req.params.orgId
    const orgId = req.params.orgId as string;
    // The user id was saved by the authenticate middleware (guard #1), so this guard must run AFTER it
    const userId = res.locals.userId as string;

    // Look for the membership row linking this user to this business (always a fresh DB lookup, never trusted from the token)
    const membership = await prisma.membership.findUnique({
      // userId_organizationId is the name Prisma gives the @@unique([userId, organizationId]) pair in the schema
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });

    // No membership means this user is a stranger to that business
    if (!membership) {
      // 404 (not 403) on purpose: 403 would confirm "that business exists", which leaks information to strangers
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // Save the user's role in THIS business so the next guard and the controller can use it
    res.locals.membership = { organizationId: membership.organizationId, role: membership.role };
    // The user belongs here, so let the request continue to the next step
    next();
  } catch (error) {
    // Log unexpected errors on the server only (never send internals to the client)
    console.error("Membership check error:", error);
    // 500 = Server Error (something broke on our side)
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}
