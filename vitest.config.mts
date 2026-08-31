import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const alias = { "@": path.join(root, "src") };

// Integration tests run against a real Postgres. Point TEST_DATABASE_URL at a
// throwaway database (its schema is dropped and re-migrated on every run — see
// src/test/integration-global-setup.ts). CI sets it to the postgres service;
// locally it defaults to an `expense_splitter_test` db on localhost.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/expense_splitter_test?schema=public";

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts"],
          setupFiles: ["src/test/integration-setup.ts"],
          globalSetup: ["src/test/integration-global-setup.ts"],
          fileParallelism: false,
          env: {
            DATABASE_URL: testDatabaseUrl,
            DIRECT_URL: testDatabaseUrl,
          },
        },
      },
    ],
  },
});
