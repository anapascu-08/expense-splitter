import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

const KEY_LEN = 64;
const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// --- Passwords -------------------------------------------------------------

// Stored as `saltHex:hashHex`. scrypt is intentionally slow; comparison is
// constant-time to avoid leaking the hash through timing.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LEN);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), KEY_LEN);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// --- Sessions ------------------------------------------------------------

// Only the hash of the token is stored, so a DB leak can't be used to forge
// cookies.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Must be called from a Server Action or Route Handler (writes a cookie).
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

// Must be called from a Server Action or Route Handler (clears a cookie).
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: string; name: string; email: string };

// Memoized per request so multiple callers (header, page, action) share one
// lookup during a single render pass.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// --- Password reset --------------------------------------------------------
//
// Same shape as sessions above: only the token's hash is stored, the raw
// token goes out in the emailed link and is never persisted.

// Returns the raw token to put in the emailed link. Any previous unused
// token for this user is invalidated first, so at most one link works at a
// time (requesting a new one silently supersedes an older, unopened email).
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({
      data: { id: hashToken(token), userId, expiresAt },
    }),
  ]);
  return token;
}

export type ResetTokenCheck = { valid: true; userId: string } | { valid: false };

// Read-only check for rendering the reset-password page (show the form vs.
// an "invalid link" message). Not the source of truth for the actual
// change — consumePasswordResetToken re-checks atomically on submit.
export async function checkPasswordResetToken(
  token: string
): Promise<ResetTokenCheck> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { id: hashToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return { valid: false };
  }
  return { valid: true, userId: row.userId };
}

// Validates the token, sets the new password hash, marks the token used, and
// drops every existing session for that user — all inside one transaction,
// so the token can't be replayed even under a concurrent double-submit.
// Returns the user id on success, null if the token wasn't valid.
export async function consumePasswordResetToken(
  token: string,
  passwordHash: string
): Promise<string | null> {
  const id = hashToken(token);
  return prisma.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({ where: { id } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    await tx.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    return row.userId;
  });
}
