import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "./auth.schema.js";
import { getProfile, loginUser, registerUser } from "./auth.service.js";

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

// Handle login: check the form, verify credentials, return a token
export async function loginController(req: Request, res: Response) {
  // Validate the incoming request body against the login rules (zod)
  const validation = loginSchema.safeParse(req.body);

  // Return validation errors if the input is invalid
  if (!validation.success) {
    // 400 = Bad Request (the client sent bad data)
    return res.status(400).json({
      success: false,
      message: "Invalid login data",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  try {
    // Ask the service to check the email and password
    const result = await loginUser(validation.data);

    // null means wrong email or wrong password (we deliberately do not say which one)
    if (!result) {
      // 401 = Unauthorized (credentials not accepted)
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // 200 = OK; send back the token, user and memberships
    return res.status(200).json({ success: true, message: "Logged in successfully", data: result });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("Login error:", error);
    // 500 = Server Error (something broke on our side)
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

// Return the profile of whoever is logged in (runs after the authenticate middleware)
export async function meController(_req: Request, res: Response) {
  try {
    // The authenticate middleware stored the verified user id in res.locals
    const profile = await getProfile(res.locals.userId as string);

    // The account may have been deleted since the token was issued
    if (!profile) {
      // 401 = treat the token as no longer valid
      return res.status(401).json({ success: false, message: "Account no longer exists" });
    }

    // 200 = OK; send the profile
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    // Log unexpected errors on the server only
    console.error("Profile error:", error);
    // 500 = Server Error
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}
