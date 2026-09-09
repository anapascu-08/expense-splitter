import { describe, it, expect } from "vitest";
import {
  getCurrentUser,
  destroySession,
  createPasswordResetToken,
  checkPasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/auth";
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

describe("password reset tokens", () => {
  it("createPasswordResetToken writes a hashed, not-yet-expired row", async () => {
    const { user } = await makeUser();
    const token = await createPasswordResetToken(user.id);

    const rows = await prisma.passwordResetToken.findMany({
      where: { userId: user.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(token); // only the hash is stored
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(rows[0].usedAt).toBeNull();
  });

  it("createPasswordResetToken invalidates a previous unused token for the same user", async () => {
    const { user } = await makeUser();
    const first = await createPasswordResetToken(user.id);
    const second = await createPasswordResetToken(user.id);

    expect(await checkPasswordResetToken(first)).toEqual({ valid: false });
    expect(await checkPasswordResetToken(second)).toEqual({
      valid: true,
      userId: user.id,
    });
  });

  it("checkPasswordResetToken rejects an unknown token", async () => {
    expect(await checkPasswordResetToken("not-a-real-token")).toEqual({
      valid: false,
    });
  });

  it("checkPasswordResetToken rejects an expired token", async () => {
    const { user } = await makeUser();
    const token = await createPasswordResetToken(user.id);
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await checkPasswordResetToken(token)).toEqual({ valid: false });
  });

  it("consumePasswordResetToken updates the password and kills existing sessions", async () => {
    const { user } = await makeUser();
    await signIn(user.id);
    const token = await createPasswordResetToken(user.id);

    const userId = await consumePasswordResetToken(token, "newSalt:newHash");

    expect(userId).toBe(user.id);
    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(updated.passwordHash).toBe("newSalt:newHash");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("consumePasswordResetToken is single-use", async () => {
    const { user } = await makeUser();
    const token = await createPasswordResetToken(user.id);

    expect(await consumePasswordResetToken(token, "a:b")).toBe(user.id);
    expect(await consumePasswordResetToken(token, "c:d")).toBeNull();

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(updated.passwordHash).toBe("a:b"); // the second call didn't apply
  });

  it("consumePasswordResetToken rejects an unknown token without touching any user", async () => {
    expect(await consumePasswordResetToken("bogus", "x:y")).toBeNull();
  });
});
