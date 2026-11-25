import { z } from "zod";

export const startConversationSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
  }),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(5000),
});

export const publicMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});
