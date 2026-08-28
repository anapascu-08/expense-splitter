import { isExpenseCategory, type ExpenseCategory } from "@/lib/categories";

export type SummaryExpense = {
  amount: number; // bani
  category: string | null;
  paidById: string;
};

export type CategorySlice = { category: ExpenseCategory | null; total: number };
export type PayerSlice = { memberId: string; total: number };

export function groupTotal(expenses: SummaryExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

// Totals grouped by a key, returned largest first. Insertion order breaks ties,
// so callers that feed a stable expense order get a stable result.
function totalsBy<K>(
  expenses: SummaryExpense[],
  keyOf: (e: SummaryExpense) => K
): { key: K; total: number }[] {
  const totals = new Map<K, number>();
  for (const e of expenses) {
    const k = keyOf(e);
    totals.set(k, (totals.get(k) ?? 0) + e.amount);
  }
  return [...totals.entries()]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total);
}

export function spendByCategory(expenses: SummaryExpense[]): CategorySlice[] {
  return totalsBy(expenses, (e) =>
    e.category && isExpenseCategory(e.category) ? e.category : null
  ).map(({ key, total }) => ({ category: key, total }));
}

export function spendByPayer(expenses: SummaryExpense[]): PayerSlice[] {
  return totalsBy(expenses, (e) => e.paidById).map(({ key, total }) => ({
    memberId: key,
    total,
  }));
}
