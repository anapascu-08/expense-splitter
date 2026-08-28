import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { acceptInvite } from "@/app/actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const invite = await prisma.groupInvite.findFirst({
    where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
    include: {
      group: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!invite) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
        <h1 className="text-2xl font-semibold">Invitație invalidă</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Linkul a expirat, a fost revocat sau nu există. Cere-i persoanei care
          te-a invitat un link nou.
        </p>
        <Link href="/" className="text-sm underline">
          ← Grupurile tale
        </Link>
      </main>
    );
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: invite.group.id, userId: user.id } },
    select: { groupId: true },
  });
  if (existing) {
    redirect(`/groups/${invite.group.id}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Ai o invitație</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium">{invite.createdBy.name}</span> te-a invitat
        în grupul{" "}
        <span className="font-medium">„{invite.group.name}”</span>.
      </p>
      <form action={acceptInvite.bind(null, token)}>
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Intră în grup
        </button>
      </form>
    </main>
  );
}
