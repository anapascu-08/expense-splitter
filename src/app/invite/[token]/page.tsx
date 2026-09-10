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

  // Names already in the group that nobody has an account for yet — the joiner
  // can claim one instead of being added as a separate name.
  const unclaimed = await prisma.member.findMany({
    where: { groupId: invite.group.id, userId: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Ești invitat</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium">{invite.createdBy.name}</span> te-a invitat
        în grupul{" "}
        <span className="font-medium">„{invite.group.name}”</span>. Acceptă mai
        jos ca să vezi cheltuielile și să intri în solduri.
      </p>
      <form action={acceptInvite.bind(null, token)} className="flex flex-col gap-4">
        {unclaimed.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              Ești deja pe listă?
            </legend>
            {unclaimed.map((member) => (
              <label
                key={member.id}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
              >
                <input
                  type="radio"
                  name="claimMemberId"
                  value={member.id}
                  className="accent-gray-900 dark:accent-white"
                />
                Sunt „{member.name}”
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="radio"
                name="claimMemberId"
                value="new"
                defaultChecked
                className="accent-gray-900 dark:accent-white"
              />
              Adaugă-mă separat
            </label>
          </fieldset>
        )}
        <button
          type="submit"
          className="self-start rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Intră în grup
        </button>
      </form>
    </main>
  );
}
