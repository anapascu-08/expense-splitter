import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Uses the pg driver adapter + Prisma's query compiler (see the generator's
// previewFeatures in prisma/schema.prisma) instead of the native Rust query
// engine — there is no libquery_engine binary to bundle, which is what broke
// on Vercel's serverless runtime. Connection string comes from DATABASE_URL
// (pooled Neon URL on Vercel; see README).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
