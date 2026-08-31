import { execSync } from "node:child_process";

// Runs once before the integration project. Wipes the test database's `public`
// schema and re-applies the committed migrations, so tests start from a schema
// identical to production.
//
// Vitest's globalSetup does not inherit the project-level `env` block, so the
// test database URL is resolved here the same way vitest.config.mts does it.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/expense_splitter_test?schema=public";

export default function setup(): void {
  const env = {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    DIRECT_URL: testDatabaseUrl,
  };

  execSync("npx prisma db execute --schema prisma/schema.prisma --stdin", {
    input: "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    stdio: ["pipe", "inherit", "inherit"],
    env,
  });

  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    stdio: "inherit",
    env,
  });
}
