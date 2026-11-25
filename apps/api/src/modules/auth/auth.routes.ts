import { Router } from "express";
import { loginController, logoutController, meController, refreshController, registerController } from "./auth.controller.js";
// Import the guard that checks the token before a route runs
import { authenticate } from "../../middleware/authenticate.js";
import { buildRateLimiter } from "../../middleware/rateLimit.js";
import { env } from "../../config/env.js";
import { acceptInvitationController } from "../organizations/invitation.controller.js";

// Create an authentication router
const router = Router();
const authLimiter = buildRateLimiter({ max: env.AUTH_RATE_LIMIT_MAX, windowMs: 60_000, skipSuccessfulRequests: true });

// Register a new organization and its owner
router.post("/register", authLimiter, registerController);

// Log in with email and password to receive a token
router.post("/login", authLimiter, loginController);

router.post("/refresh", authLimiter, refreshController);
router.post("/logout", logoutController);
router.post("/invitations/accept", authLimiter, acceptInvitationController);

// Get the logged-in user's profile; authenticate runs first and blocks requests without a valid token
router.get("/me", authenticate, meController);

// Export the router
export default router;