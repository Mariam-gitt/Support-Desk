import type { Request, Response } from "express";
import { registerSchema } from "./auth.schema.js";
import { registerUser } from "./auth.service.js";

// Handle organization-owner registration
export async function registerController(req: Request, res: Response) {
  // Validate the incoming request body
  const validation = registerSchema.safeParse(req.body);

  // Return validation errors if the input is invalid
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid registration data",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  try {
    // Call the service to create the user and organization
    const result = await registerUser(validation.data);

    // Return the newly created account
    return res.status(201).json({
      success: true,
      message: "Organization registered successfully",
      data: result,
    });
  } catch (error) {
    // Handle duplicate email addresses
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered",
      });
    }

    // Log unexpected errors on the server
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
}