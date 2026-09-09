import { describe, it, expect } from "vitest";
import {
  register,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
} from "@/app/auth-actions";
import { getCurrentUser, verifyPassword, createPasswordResetToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeUser, signIn, formData } from "@/test/factories";
import { catchRedirect } from "@/test/next-navigation-errors";

describe("register", () => {
  it("creates the user, opens a session, and redirects home", async () => {
    const url = await catchRedirect(
      register(
        undefined,
        formData({ name: "New", email: "new@test.dev", password: "password123" })
      )
    );
    expect(url).toBe("/");

    const user = await prisma.user.findUnique({ where: { email: "new@test.dev" } });
    expect(user).not.toBeNull();
    expect(await prisma.session.count({ where: { userId: user!.id } })).toBe(1);
    expect(await getCurrentUser()).toMatchObject({ email: "new@test.dev" });
  });

  it("rejects a duplicate email", async () => {
    await makeUser({ email: "dup@test.dev" });
    const state = await register(
      undefined,
      formData({ name: "X", email: "dup@test.dev", password: "password123" })
    );
    expect(state).toEqual({
      error: "Există deja un cont cu acest email.",
      field: "email",
    });
  });

  it("rejects a malformed email", async () => {
    const state = await register(
      undefined,
      formData({ name: "X", email: "nope", password: "password123" })
    );
    expect(state).toEqual({ error: "Email invalid.", field: "email" });
  });

  it("rejects a short password", async () => {
    const state = await register(
      undefined,
      formData({ name: "X", email: "short@test.dev", password: "short" })
    );
    expect(state).toEqual({
      error: "Parola trebuie să aibă minim 8 caractere.",
      field: "password",
    });
  });
});

describe("login", () => {
  it("signs in on correct credentials and redirects to `next`", async () => {
    await makeUser({ email: "log@test.dev", password: "password123" });
    const url = await catchRedirect(
      login(
        undefined,
        formData({
          email: "log@test.dev",
          password: "password123",
          next: "/groups/abc",
        })
      )
    );
    expect(url).toBe("/groups/abc");
    expect(await getCurrentUser()).toMatchObject({ email: "log@test.dev" });
  });

  it("ignores an off-site `next` and redirects home", async () => {
    await makeUser({ email: "safe@test.dev", password: "password123" });
    const url = await catchRedirect(
      login(
        undefined,
        formData({
          email: "safe@test.dev",
          password: "password123",
          next: "//evil.com",
        })
      )
    );
    expect(url).toBe("/");
  });

  it("returns an error on a wrong password", async () => {
    await makeUser({ email: "wrong@test.dev", password: "password123" });
    const state = await login(
      undefined,
      formData({ email: "wrong@test.dev", password: "nope" })
    );
    expect(state).toEqual({
      error: "Email sau parolă greșite.",
      field: ["email", "password"],
    });
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("logout", () => {
  it("clears the session and redirects to /login", async () => {
    const { user } = await makeUser();
    await signIn(user.id);

    expect(await catchRedirect(logout())).toBe("/login");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requestPasswordReset", () => {
  // No RESEND_API_KEY in the test env, so sendEmail always throws here —
  // requestPasswordReset swallows that and still returns the generic message,
  // which is exactly the case this suite is pinning down.
  const GENERIC_OK = {
    ok: "Dacă adresa există într-un cont, ai primit un email cu instrucțiuni de resetare.",
  };

  it("creates a reset token for an existing account", async () => {
    const { user } = await makeUser({ email: "reset@test.dev" });

    const state = await requestPasswordReset(
      undefined,
      formData({ email: "reset@test.dev" })
    );

    expect(state).toEqual(GENERIC_OK);
    expect(
      await prisma.passwordResetToken.count({ where: { userId: user.id } })
    ).toBe(1);
  });

  it("returns the same generic message for an unknown email, without creating a token", async () => {
    const state = await requestPasswordReset(
      undefined,
      formData({ email: "nobody@test.dev" })
    );

    expect(state).toEqual(GENERIC_OK);
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("rejects a malformed email", async () => {
    const state = await requestPasswordReset(
      undefined,
      formData({ email: "not-an-email" })
    );
    expect(state).toEqual({ error: "Email invalid.", field: "email" });
  });
});

describe("resetPassword", () => {
  it("sets the new password, signs the caller in, and redirects home", async () => {
    const { user } = await makeUser({ email: "willreset@test.dev" });
    const token = await createPasswordResetToken(user.id);

    const url = await catchRedirect(
      resetPassword(undefined, formData({ password: "newpassword123", token }))
    );

    expect(url).toBe("/");
    expect(await getCurrentUser()).toMatchObject({ email: "willreset@test.dev" });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("newpassword123", updated.passwordHash)).toBe(
      true
    );
  });

  it("signs out every other session on reset", async () => {
    const { user } = await makeUser();
    await signIn(user.id); // an existing session, e.g. from another device
    const token = await createPasswordResetToken(user.id);

    await catchRedirect(
      resetPassword(undefined, formData({ password: "newpassword123", token }))
    );

    // The old session row is gone; only the fresh one from resetPassword's
    // own createSession() remains.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it("rejects a short password without consuming the token", async () => {
    const { user } = await makeUser();
    const token = await createPasswordResetToken(user.id);

    const state = await resetPassword(
      undefined,
      formData({ password: "short", token })
    );

    expect(state).toEqual({
      error: "Parola trebuie să aibă minim 8 caractere.",
      field: "password",
    });
    // Still usable afterwards — the failed attempt shouldn't have burned it.
    const url = await catchRedirect(
      resetPassword(undefined, formData({ password: "longenough1", token }))
    );
    expect(url).toBe("/");
  });

  it("rejects an unknown or already-used token", async () => {
    const state = await resetPassword(
      undefined,
      formData({ password: "longenough1", token: "bogus-token" })
    );
    expect(state).toEqual({
      error: "Linkul de resetare a expirat sau a fost deja folosit.",
    });
  });
});
