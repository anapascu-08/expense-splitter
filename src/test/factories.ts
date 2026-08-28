import { prisma } from "@/lib/prisma";
import { hashPassword, createSession, destroySession } from "@/lib/auth";

let seq = 0;
const uniq = () => `${Date.now()}-${seq++}`;

export async function makeUser(opts?: {
  email?: string;
  name?: string;
  password?: string;
}) {
  const password = opts?.password ?? "password123";
  const email = opts?.email ?? `user-${uniq()}@test.dev`;
  const user = await prisma.user.create({
    data: {
      email,
      name: opts?.name ?? "Test User",
      passwordHash: await hashPassword(password),
    },
  });
  return { user, password };
}

export async function makeGroup(ownerId: string, opts?: { name?: string }) {
  return prisma.group.create({
    data: {
      name: opts?.name ?? `Group ${uniq()}`,
      ownerId,
      groupMembers: { create: { userId: ownerId, role: "owner" } },
    },
  });
}

export function addMember(groupId: string, userId: string, role = "member") {
  return prisma.groupMember.create({ data: { groupId, userId, role } });
}

// Writes a real Session row + the cookie the app expects, so getCurrentUser()
// resolves to this user for the rest of the test.
export const signIn = (userId: string) => createSession(userId);
export const signOut = () => destroySession();

// Build a FormData from a plain object (arrays become repeated fields).
export function formData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}
