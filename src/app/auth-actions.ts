"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  createPasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/auth";
import { buildPasswordResetEmail, sendEmail } from "@/lib/email";
import type { FormState } from "@/app/form-state";

export type AuthState =
  | { error: string; field?: string | string[] }
  | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only redirect to same-origin absolute paths. Reject protocol-relative
// ("//evil.com") and the backslash variants ("/\evil.com", "\evil.com")
// that browsers normalise to "//" when following a Location header.
function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
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

  if (!name) return { error: "Numele e obligatoriu.", field: "name" };
  if (!EMAIL_RE.test(email))
    return { error: "Email invalid.", field: "email" };
  if (password.length < 8)
    return {
      error: "Parola trebuie să aibă minim 8 caractere.",
      field: "password",
    };

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
      return { error: "Există deja un cont cu acest email.", field: "email" };
    }
    throw err;
  }

  // Same `next` hand-off as login, so an invited new user who registers instead
  // of logging in still lands back on the invite (hidden field, sanitised).
  redirect(safeNext(formData.get("next")));
}

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return {
      error: "Email sau parolă greșite.",
      field: ["email", "password"],
    };
  }

  await createSession(user.id);
  // `next` rides along as a hidden form field (not a bound arg) so the page can
  // pass `login` straight to useActionState as a stable action reference — a
  // per-render `login.bind(null, next)` changes identity when the page
  // re-renders after the action and useActionState then drops the result.
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// --- Password reset --------------------------------------------------------

export async function requestPasswordReset(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Email invalid.", field: "email" };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  // Same response whether or not the account exists — otherwise this becomes
  // an oracle for which emails are registered.
  if (user) {
    const token = await createPasswordResetToken(user.id);
    const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
    const { subject, text } = buildPasswordResetEmail(
      `${origin}/reset-password/${token}`
    );
    try {
      await sendEmail(user.email, subject, text);
    } catch (err) {
      // Don't leak delivery failures to the caller — that would let someone
      // distinguish "account exists but email failed" from "sent fine".
      console.error("Failed to send password reset email:", err);
    }
  }

  return {
    ok: "Dacă adresa există într-un cont, ai primit un email cu instrucțiuni de resetare.",
  };
}

export async function resetPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  // `token` rides along as a hidden field rather than a bound arg — see the
  // note in `login` above (a per-render .bind() breaks useActionState).
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8)
    return {
      error: "Parola trebuie să aibă minim 8 caractere.",
      field: "password",
    };

  const passwordHash = await hashPassword(password);
  const userId = await consumePasswordResetToken(token, passwordHash);
  if (!userId)
    return { error: "Linkul de resetare a expirat sau a fost deja folosit." };

  await createSession(userId);
  redirect("/");
}
