import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// The DATABASE_URL in .env uses a path relative to prisma/schema.prisma
// (Prisma CLI convention), but the generated client resolves relative
// sqlite paths differently at runtime. Resolve to an absolute path here
// so both the CLI and the app agree on the same database file.
const dbPath = path.join(process.cwd(), "prisma", "dev.db");

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: `file:${dbPath}` });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
