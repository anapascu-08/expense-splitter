import { describe, it, expect } from "vitest";
import { getCurrentUser, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeUser, signIn } from "@/test/factories";
import { cookieJar } from "@/test/cookie-jar";

describe("sessions", () => {
  it("createSession writes a Session row and a cookie", async () => {
    const { user } = await makeUser();
    await signIn(user.id);

    expect(cookieJar.get("session")).toBeTruthy();
    const rows = await prisma.session.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("getCurrentUser resolves the signed-in user", async () => {
    const { user } = await makeUser({ name: "Dana", email: "dana@test.dev" });
    await signIn(user.id);

    expect(await getCurrentUser()).toEqual({
      id: user.id,
      name: "Dana",
      email: "dana@test.dev",
    });
  });

  it("getCurrentUser returns null with no cookie", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("getCurrentUser returns null for an expired session and deletes the row", async () => {
    const { user } = await makeUser();
    await signIn(user.id);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await getCurrentUser()).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("destroySession removes the row and clears the cookie", async () => {
    const { user } = await makeUser();
    await signIn(user.id);
    await destroySession();

    expect(cookieJar.get("session")).toBeUndefined();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});
