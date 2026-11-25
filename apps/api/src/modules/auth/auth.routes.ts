import { Router } from "express";
import { loginController, meController, registerController } from "./auth.controller.js";
// Import the guard that checks the token before a route runs
import { authenticate } from "../../middleware/authenticate.js";

// Create an authentication router
const router = Router();

// Register a new organization and its owner
router.post("/register", registerController);

// Log in with email and password to receive a token
router.post("/login", loginController);

// Get the logged-in user's profile; authenticate runs first and blocks requests without a valid token
router.get("/me", authenticate, meController);

// Export the router
export default router;