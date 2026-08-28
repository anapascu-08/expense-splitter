import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { baniToInput } from "@/lib/money";
import { updateExpense } from "@/app/actions";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId: id },
    include: {
      group: { include: { members: { orderBy: { name: "asc" } } } },
      participants: true,
    },
  });

  if (!expense) notFound();

  const participantIds = new Set(expense.participants.map((p) => p.memberId));
  const boundUpdateExpense = updateExpense.bind(null, id, expense.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <header>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-gray-500 hover:underline dark:text-gray-400"
        >
          ← înapoi la {expense.group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Editează cheltuiala</h1>
      </header>

      <form action={boundUpdateExpense} className="flex flex-col gap-3">
        <input
          type="text"
          name="description"
          defaultValue={expense.description}
          placeholder="Descriere (ex: cină)"
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
        />
        <input
          type="text"
          inputMode="decimal"
          name="amount"
          defaultValue={baniToInput(expense.amount)}
          placeholder="Sumă (RON)"
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
        />

        <label className="flex flex-col gap-1 text-sm">
          Plătit de
          <select
            name="paidById"
            defaultValue={expense.paidById}
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
          >
            {expense.group.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1">Împărțit între</legend>
          {expense.group.members.map((member) => (
            <label key={member.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="participantIds"
                value={member.id}
                defaultChecked={participantIds.has(member.id)}
              />
              {member.name}
            </label>
          ))}
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Salvează
          </button>
          <Link
            href={`/groups/${id}`}
            className="text-sm text-gray-500 hover:underline dark:text-gray-400"
          >
            Anulează
          </Link>
        </div>
      </form>
    </main>
  );
}
