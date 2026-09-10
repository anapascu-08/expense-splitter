import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireGroupAccess } from "@/lib/access";
import { BackLink } from "@/app/back-link";
import {
  baniToInput,
  basisPointsToInput,
  sharesToInput,
  rateMicrosToInput,
} from "@/lib/money";
import { updateExpense } from "@/app/actions";
import { ExpenseForm, type SplitMode } from "@/app/expense-form";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const { user, role } = await requireGroupAccess(id);

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId: id },
    include: {
      group: { include: { members: { orderBy: { name: "asc" } } } },
      participants: true,
    },
  });

  if (!expense) notFound();
  // Only the person who added the expense (or the group owner) may edit it.
  if (role !== "owner" && expense.createdById !== user.id) notFound();

  const splitMode = expense.splitMode as SplitMode;
  const weights: Record<string, string> = {};
  for (const p of expense.participants) {
    if (splitMode === "EXACT") weights[p.memberId] = baniToInput(p.weight);
    else if (splitMode === "PERCENT")
      weights[p.memberId] = basisPointsToInput(p.weight);
    else if (splitMode === "SHARES")
      weights[p.memberId] = sharesToInput(p.weight);
  }

  const boundUpdateExpense = updateExpense.bind(null, id, expense.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-1">
        <BackLink href={`/groups/${id}`}>
          înapoi la {expense.group.name}
        </BackLink>
        <h1 className="text-2xl font-semibold">Editează cheltuiala</h1>
      </header>

      <ExpenseForm
        members={expense.group.members}
        action={boundUpdateExpense}
        submitLabel="Salvează"
        baseCurrency={expense.group.baseCurrency}
        cancelHref={`/groups/${id}`}
        defaults={{
          description: expense.description,
          amount: baniToInput(expense.amount),
          paidById: expense.paidById,
          category: expense.category ?? "",
          currency: expense.currency,
          rate:
            expense.currency === expense.group.baseCurrency
              ? ""
              : rateMicrosToInput(expense.rateMicros),
          splitMode,
          participantIds: expense.participants.map((p) => p.memberId),
          weights,
        }}
      />
    </main>
  );
}
