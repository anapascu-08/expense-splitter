import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";

// Characterization tests for the password primitives only. Session helpers need
// a request context (next/headers) + DB and are covered by the integration
// harness later.

describe("hashPassword / verifyPassword", () => {
  it("round-trips a correct password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("s3cret-pass");
    expect(await verifyPassword("s3cret-wrong", stored)).toBe(false);
  });

  it("produces a salt:hash hex string with a fresh salt each call", async () => {
    const a = await hashPassword("same-input");
    const b = await hashPassword("same-input");
    expect(a).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(a).not.toBe(b);
  });

  it("returns false for a malformed stored value instead of throwing", async () => {
    expect(await verifyPassword("whatever", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("whatever", "")).toBe(false);
  });
});
