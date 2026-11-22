import { Router } from "express";

// Create a router to manage health-related endpoints
const router = Router();

// Define a GET health-check endpoint
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SupportDesk API is healthy!",
  });
});

// Export the router
export default router;