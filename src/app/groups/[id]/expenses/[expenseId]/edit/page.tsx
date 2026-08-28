import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { baniToInput, basisPointsToInput } from "@/lib/money";
import { updateExpense } from "@/app/actions";
import { ExpenseForm, type SplitMode } from "@/app/expense-form";

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

  const splitMode = expense.splitMode as SplitMode;
  const weights: Record<string, string> = {};
  for (const p of expense.participants) {
    if (splitMode === "EXACT") weights[p.memberId] = baniToInput(p.weight);
    else if (splitMode === "PERCENT")
      weights[p.memberId] = basisPointsToInput(p.weight);
  }

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

      <ExpenseForm
        members={expense.group.members}
        action={boundUpdateExpense}
        submitLabel="Salvează"
        cancelHref={`/groups/${id}`}
        defaults={{
          description: expense.description,
          amount: baniToInput(expense.amount),
          paidById: expense.paidById,
          splitMode,
          participantIds: expense.participants.map((p) => p.memberId),
          weights,
        }}
      />
    </main>
  );
}
