// Import TypeScript types for Express requests and responses
import type { Request, Response } from "express";
// Import the service functions that talk to the database
import { getOrganization, listMembers } from "./org.service.js";

// Return the details of the business named in the URL
export async function getOrganizationController(req: Request, res: Response) {
  try {
    // req.params.orgId comes from the URL (/api/orgs/:orgId); the guards already verified membership
    const organization = await getOrganization(req.params.orgId as string);

    // Extremely unlikely (membership exists so the business exists), but we handle it safely
    if (!organization) {
      // 404 = Not Found
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // 200 = OK; send the business details
    return res.status(200).json({ success: true, data: organization });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("Get organization error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

// Return all members of the business named in the URL
export async function listMembersController(req: Request, res: Response) {
  try {
    // Ask the service for this business's members only
    const members = await listMembers(req.params.orgId as string);
    // 200 = OK; send the list
    return res.status(200).json({ success: true, data: members });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("List members error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}
