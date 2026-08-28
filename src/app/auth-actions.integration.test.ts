import { describe, it, expect } from "vitest";
import { register, login, logout } from "@/app/auth-actions";
import { getCurrentUser } from "@/lib/auth";
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
    expect(state).toEqual({ error: "Există deja un cont cu acest email." });
  });

  it("rejects a malformed email", async () => {
    const state = await register(
      undefined,
      formData({ name: "X", email: "nope", password: "password123" })
    );
    expect(state).toEqual({ error: "Email invalid." });
  });

  it("rejects a short password", async () => {
    const state = await register(
      undefined,
      formData({ name: "X", email: "short@test.dev", password: "short" })
    );
    expect(state).toEqual({
      error: "Parola trebuie să aibă minim 8 caractere.",
    });
  });
});

describe("login", () => {
  it("signs in on correct credentials and redirects to `next`", async () => {
    await makeUser({ email: "log@test.dev", password: "password123" });
    const url = await catchRedirect(
      login(
        "/groups/abc",
        undefined,
        formData({ email: "log@test.dev", password: "password123" })
      )
    );
    expect(url).toBe("/groups/abc");
    expect(await getCurrentUser()).toMatchObject({ email: "log@test.dev" });
  });

  it("ignores an off-site `next` and redirects home", async () => {
    await makeUser({ email: "safe@test.dev", password: "password123" });
    const url = await catchRedirect(
      login(
        "//evil.com",
        undefined,
        formData({ email: "safe@test.dev", password: "password123" })
      )
    );
    expect(url).toBe("/");
  });

  it("returns an error on a wrong password", async () => {
    await makeUser({ email: "wrong@test.dev", password: "password123" });
    const state = await login(
      "/",
      undefined,
      formData({ email: "wrong@test.dev", password: "nope" })
    );
    expect(state).toEqual({ error: "Email sau parolă greșite." });
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
