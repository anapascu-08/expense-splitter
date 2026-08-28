import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createGroup } from "./actions";

export default async function HomePage() {
  const user = await requireUser();
  const groups = await prisma.group.findMany({
    where: { groupMembers: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    include: { members: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Expense Splitter</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Împarte cheltuielile cu prietenii, fără bătăi de cap.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Grupurile tale</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nu ai niciun grup încă. Creează unul mai jos.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 transition hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
                >
                  <span className="font-medium">{group.name}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {group.members.length}{" "}
                    {group.members.length === 1 ? "membru" : "membri"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Creează un grup nou</h2>
        <form action={createGroup} className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="ex: Vacanța la mare"
            required
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Creează
          </button>
        </form>
      </section>
    </main>
  );
}
