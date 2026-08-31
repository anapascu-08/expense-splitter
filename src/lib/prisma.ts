import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reads the connection string from DATABASE_URL (see prisma/schema.prisma).
// On Vercel this is the pooled Neon URL injected by the Neon integration;
// locally it points at a Postgres instance (see README).
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
