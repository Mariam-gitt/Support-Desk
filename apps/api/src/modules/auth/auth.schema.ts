
import { z } from "zod";

// Validate organization-owner registration
export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(2).max(100),
});

// Validate login credentials
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
