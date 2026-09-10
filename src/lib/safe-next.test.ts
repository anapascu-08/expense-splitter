import { describe, it, expect } from "vitest";
import { safeNext, loginRedirect } from "@/lib/safe-next";

describe("safeNext", () => {
  it("passes same-origin absolute paths through", () => {
    expect(safeNext("/groups/abc")).toBe("/groups/abc");
    expect(safeNext("/")).toBe("/");
  });

  it("rejects non-string and non-absolute values", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(42)).toBe("/");
    expect(safeNext("groups/abc")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
  });

  it("rejects protocol-relative and backslash bypasses", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
  });
});

describe("loginRedirect", () => {
  it("drops the query for the home destination", () => {
    expect(loginRedirect("/")).toBe("/login");
    expect(loginRedirect(undefined)).toBe("/login");
  });

  it("encodes a real destination into ?next=", () => {
    expect(loginRedirect("/groups/abc")).toBe("/login?next=%2Fgroups%2Fabc");
  });

  it("sanitises an unsafe destination back to /login", () => {
    expect(loginRedirect("//evil.com")).toBe("/login");
  });
});
