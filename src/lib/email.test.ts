import { describe, it, expect } from "vitest";
import { buildPasswordResetEmail } from "@/lib/email";

describe("buildPasswordResetEmail", () => {
  it("includes the reset link in the body", () => {
    const { text } = buildPasswordResetEmail(
      "https://example.com/reset-password/abc123"
    );
    expect(text).toContain("https://example.com/reset-password/abc123");
  });

  it("has a Romanian subject naming the app", () => {
    const { subject } = buildPasswordResetEmail("https://example.com/x");
    expect(subject).toBe("Resetează-ți parola — Expense Splitter");
  });

  it("mentions the link expires and that unsolicited requests can be ignored", () => {
    const { text } = buildPasswordResetEmail("https://example.com/x");
    expect(text).toMatch(/1 or[aă]/i);
    expect(text.toLowerCase()).toContain("ignoră");
  });
});
