import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeBalances, computeSettlement } from "@/lib/balances";
import { formatBani } from "@/lib/money";
import { addExpense, addMember, deleteExpense } from "@/app/actions";

// Data is per-request; never prerender at build time (no DB connection needed then).
export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: { orderBy: { name: "asc" } },
      expenses: {
        orderBy: { createdAt: "desc" },
        include: { paidBy: true, participants: { include: { member: true } } },
      },
    },
  });

  if (!group) notFound();

  const balances = computeBalances(group.members, group.expenses);
  const settlement = computeSettlement(balances);

  const boundAddMember = addMember.bind(null, group.id);
  const boundAddExpense = addExpense.bind(null, group.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <header>
        <Link
          href="/"
          className="text-sm text-gray-500 hover:underline dark:text-gray-400"
        >
          ← toate grupurile
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{group.name}</h1>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Membri</h2>
        {group.members.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Niciun membru încă. Adaugă mai jos.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {group.members.map((member) => (
              <li
                key={member.id}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm dark:border-gray-800"
              >
                {member.name}
              </li>
            ))}
          </ul>
        )}
        <form action={boundAddMember} className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="Nume membru"
            required
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium transition hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
          >
            Adaugă membru
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Solduri</h2>
        {group.members.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Adaugă membri pentru a vedea soldurile.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {balances.map((b) => (
              <li key={b.memberId} className="flex justify-between">
                <span>{b.name}</span>
                <span
                  className={
                    b.net > 0
                      ? "text-green-600 dark:text-green-400"
                      : b.net < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-500"
                  }
                >
                  {b.net > 0 ? "i se datorează " : b.net < 0 ? "datorează " : ""}
                  {formatBani(Math.abs(b.net))} RON
                </span>
              </li>
            ))}
          </ul>
        )}

        {settlement.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900">
            <p className="font-medium">Cum se rezolvă:</p>
            {settlement.map((t, i) => (
              <p key={i}>
                <span className="font-medium">{t.fromName}</span> îi dă lui{" "}
                <span className="font-medium">{t.toName}</span>{" "}
                {formatBani(t.amount)} RON
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Cheltuieli</h2>
        {group.expenses.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nicio cheltuială încă.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {group.expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-start justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800"
              >
                <div>
                  <p className="font-medium">{expense.description}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    plătit de {expense.paidBy.name} · împărțit între{" "}
                    {expense.participants.map((p) => p.member.name).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {formatBani(expense.amount)} RON
                  </span>
                  <form
                    action={deleteExpense.bind(null, group.id, expense.id)}
                  >
                    <button
                      type="submit"
                      className="text-sm text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={`Șterge ${expense.description}`}
                    >
                      șterge
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {group.members.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
          <h2 className="text-lg font-medium">Adaugă o cheltuială</h2>
          <form action={boundAddExpense} className="flex flex-col gap-3">
            <input
              type="text"
              name="description"
              placeholder="Descriere (ex: cină)"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
            />
            <input
              type="text"
              inputMode="decimal"
              name="amount"
              placeholder="Sumă (RON)"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
            />

            <label className="flex flex-col gap-1 text-sm">
              Plătit de
              <select
                name="paidById"
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
              >
                {group.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="flex flex-col gap-1 text-sm">
              <legend className="mb-1">Împărțit între</legend>
              {group.members.map((member) => (
                <label key={member.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="participantIds"
                    value={member.id}
                    defaultChecked
                  />
                  {member.name}
                </label>
              ))}
            </fieldset>

            <button
              type="submit"
              className="self-start rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Adaugă cheltuială
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
