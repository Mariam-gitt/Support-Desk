import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Create a PostgreSQL adapter using our Neon connection string
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

// Create one shared Prisma Client instance
export const prisma = new PrismaClient({ adapter });