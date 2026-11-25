// Import TypeScript types for Express: Request (incoming), Response (outgoing), NextFunction (go to the next step)
import type { NextFunction, Request, Response } from "express";
// Import our helper that checks a JWT and gives back the user id
import { verifyToken } from "../lib/jwt.js";

// Middleware = a function that runs BEFORE a route handler, like a security guard at the door
export function authenticate(req: Request, res: Response, next: NextFunction) {
  // The client sends the token in the "Authorization" header, formatted as: Bearer <token>
  const header = req.headers.authorization;

  // If the header is missing or is not in the "Bearer ..." format, the person is not logged in
  if (!header || !header.startsWith("Bearer ")) {
    // 401 = Unauthorized (we do not know who you are); "return" stops the request here
    return res.status(401).json({ success: false, message: "Please log in first" });
  }

  // Cut off the first 7 characters ("Bearer ") so only the token itself remains
  const token = header.slice(7);

  try {
    // Verify the token and save the user id in res.locals (a per-request notebook shared with later handlers)
    res.locals.userId = verifyToken(token);
    // Token is good, so let the request continue to the next step (the controller)
    next();
  } catch {
    // Token was fake, edited or expired, so refuse the request with 401
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}
