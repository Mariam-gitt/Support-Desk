// The validated settings (so a missing DATABASE_URL gives one clear error)
import { env } from "../config/env.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Create a PostgreSQL adapter using our Neon connection string
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

// Create one shared Prisma Client instance
export const prisma = new PrismaClient({ adapter });