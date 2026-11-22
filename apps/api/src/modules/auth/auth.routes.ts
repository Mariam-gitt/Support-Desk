import { Router } from "express";
import { registerController } from "./auth.controller.js";

// Create an authentication router
const router = Router();

// Register a new organization and its owner
router.post("/register", registerController);

// Export the router
export default router;