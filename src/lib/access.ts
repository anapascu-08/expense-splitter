import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/auth";

export type GroupAccess = { user: CurrentUser; role: string };

// Requires the current user to be a member of `groupId`. A non-member gets a
// 404 rather than a 403 so we don't reveal that the group exists.
export const requireGroupAccess = cache(
  async (groupId: string): Promise<GroupAccess> => {
    const user = await requireUser();
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
      select: { role: true },
    });
    if (!membership) notFound();
    return { user, role: membership.role };
  }
);
