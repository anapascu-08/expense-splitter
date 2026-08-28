"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
} from "@/lib/auth";

export type AuthState = { error: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only redirect to same-origin absolute paths, never to "//evil.com".
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/";
}

export async function register(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Numele e obligatoriu." };
  if (!EMAIL_RE.test(email)) return { error: "Email invalid." };
  if (password.length < 8)
    return { error: "Parola trebuie să aibă minim 8 caractere." };

  const passwordHash = await hashPassword(password);
  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true },
    });
    await createSession(user.id);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: "Există deja un cont cu acest email." };
    }
    throw err;
  }

  redirect("/");
}

export async function login(
  next: string,
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email sau parolă greșite." };
  }

  await createSession(user.id);
  redirect(safeNext(next));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
