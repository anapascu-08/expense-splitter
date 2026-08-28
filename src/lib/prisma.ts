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

// An explicitly absolute `file:` DATABASE_URL (e.g. the integration test db)
// overrides the computed dev.db path; a relative one does not, since relative
// sqlite paths don't resolve consistently at runtime.
const envPath = process.env.DATABASE_URL?.startsWith("file:")
  ? process.env.DATABASE_URL.slice("file:".length)
  : undefined;
const dbUrl =
  envPath && path.isAbsolute(envPath) ? `file:${envPath}` : `file:${dbPath}`;

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: dbUrl });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
