import { beforeEach, vi } from "vitest";
import { RedirectError, NotFoundError } from "@/test/next-navigation-errors";

// --- Module mocks (apply to every integration test file) -----------------

// React's cache() memoizes for the lifetime of the wrapped fn. In RSC that's
// one request; here there's no request boundary, so it would leak state across
// calls and tests (e.g. getCurrentUser() caching the first null). Make it a
// pass-through — memoization is only an optimization.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T): T => fn };
});

vi.mock("next/headers", async () => {
  const { cookieStore } = await import("@/test/cookie-jar");
  return { cookies: async () => cookieStore() };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  notFound: () => {
    throw new NotFoundError();
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// --- Per-test reset -------------------------------------------------------

// FK-safe order (children first); mirrors prisma/seed.mjs.
const TABLES = [
  "Payment",
  "ExpenseParticipant",
  "Expense",
  "GroupInvite",
  "GroupMember",
  "Member",
  "Group",
  "Session",
  "User",
];

beforeEach(async () => {
  const { prisma } = await import("@/lib/prisma");
  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
  const { resetCookies } = await import("@/test/cookie-jar");
  resetCookies();
  vi.clearAllMocks();
});
