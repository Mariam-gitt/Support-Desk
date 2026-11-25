import { Router } from "express";
import { env } from "../../config/env.js";
import { buildRateLimiter } from "../../middleware/rateLimit.js";
import {
  addPublicMessageController,
  getPublicConversationController,
  getPublicWidgetController,
  startPublicConversationController,
} from "./publicChat.controller.js";

const router = Router();
router.use(buildRateLimiter({ max: env.PUBLIC_CHAT_RATE_LIMIT_MAX, windowMs: 60_000 }));

router.get("/widget/:slug", getPublicWidgetController);
router.post("/widget/:slug/conversations", startPublicConversationController);
router.get("/conversations/:ticketId", getPublicConversationController);
router.post("/conversations/:ticketId/messages", addPublicMessageController);

export default router;
