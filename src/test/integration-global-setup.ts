import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

// Runs once before the integration project. Recreates prisma/test.db from the
// committed migrations so tests start from a schema identical to production.
export default function setup(): void {
  const testDb = path.resolve(process.cwd(), "prisma/test.db");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(testDb + suffix, { force: true });
  }

  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: `file:${testDb}` },
  });
}
