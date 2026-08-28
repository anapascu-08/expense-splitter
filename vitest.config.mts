import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const alias = { "@": path.join(root, "src") };

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
          env: { DATABASE_URL: `file:${path.join(root, "prisma/test.db")}` },
        },
      },
    ],
  },
});
