// Load variables from the .env file into process.env (.env = a private settings file, never committed)
import "dotenv/config";
// zod = a library that checks data has the right shape; here it checks our settings
import { z } from "zod";

// An optional text setting where an empty value (like REDIS_URL=) counts as "not set"
const optionalText = z
  // Must be text if present
  .string()
  // Remove spaces around it
  .trim()
  // It may be missing entirely
  .optional()
  // Turn "" into undefined so the rest of the code only has to check one case
  .transform((value) => (value ? value : undefined));

// The full list of settings the app understands, with rules and defaults (this is the ONE place settings are defined)
const envSchema = z.object({
  // Which mode we run in; hosting platforms set "production"; tests set "test"
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // The port the API listens on (coerce turns the text "5000" into the number 5000)
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  // The PostgreSQL connection string (required)
  DATABASE_URL: z.string({ error: "is required (your PostgreSQL connection string)" }).min(1, "is required (your PostgreSQL connection string)"),
  // The secret that signs login tokens; at least 32 characters, because a short secret can be guessed
  JWT_SECRET: z
    .string({ error: "is required (a long random secret)" })
    .min(32, "JWT_SECRET must be at least 32 characters. Generate one: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""),
  // Optional: Redis address for background jobs (jobs are switched off when missing)
  REDIS_URL: optionalText,
  // Optional: websites allowed to connect to real-time events from another address (comma separated)
  CORS_ORIGIN: optionalText,
  // Minutes to wait before checking that a ticket got a first reply
  SLA_FIRST_RESPONSE_MINUTES: z.coerce.number().positive().default(15),
  // DEVELOPMENT ONLY: how many notification sends should fail on purpose (to watch retries)
  SIMULATE_NOTIFY_FAILURES: z.coerce.number().int().min(0).default(0),
  // How many failed logins (or registrations) one IP address may make per time window
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  // How long an access token remains usable before the browser refreshes it
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(15),
  // How long a refresh token may be used before the user must sign in again
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  // How long an invitation link remains valid
  INVITATION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  // How many requests one IP may send to the unauthenticated customer chat in one minute
  PUBLIC_CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  // How expensive password hashing is: each +1 doubles the time (12 is a good production value; tests use 4 for speed)
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});

// Check the real environment against the rules (safeParse returns success or a list of problems instead of crashing)
const result = envSchema.safeParse(process.env);

// If anything is wrong, stop immediately with ONE clear message listing every problem ("fail fast")
if (!result.success) {
  // Turn each problem into a readable line like "  - JWT_SECRET: must be at least 32 characters"
  const problems = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  // Crash at startup with the list, instead of failing mysteriously later
  throw new Error(`Invalid environment settings:\n${problems}`);
}

// The validated, typed settings; import this everywhere instead of reading process.env directly
export const env = result.data;
