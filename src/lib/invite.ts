import { prisma } from "@/lib/prisma";

// If `next` is an invite-accept path (`/invite/<token>`) whose token is still
// valid, return who invited and to which group. The login/register screens use
// this to show the invitation context that the bare `?next=` redirect would
// otherwise drop for a logged-out invitee.
export async function inviteContext(
  next: string | undefined | null
): Promise<{ groupName: string; inviterName: string } | null> {
  if (!next) return null;
  const match = /^\/invite\/([^/?#]+)$/.exec(next);
  if (!match) return null;

  const invite = await prisma.groupInvite.findFirst({
    where: { token: match[1], revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      group: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!invite) return null;

  return { groupName: invite.group.name, inviterName: invite.createdBy.name };
}
