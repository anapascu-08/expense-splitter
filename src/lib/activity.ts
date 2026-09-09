// A merged, chronological "what happened" feed for a group — the in-app
// stand-in for a notification: no email/push, just the most recent expenses
// and payments in one list. Pure merge + sort so it's cheap to test; the
// caller already has both arrays loaded for the page.

export type ActivityExpense = {
  id: string;
  description: string;
  amount: number; // bani, in the expense's own currency
  currency: string;
  createdAt: Date;
  paidByName: string;
};

export type ActivityPayment = {
  id: string;
  amount: number; // bani, in the group's base currency
  createdAt: Date;
  fromName: string;
  toName: string;
};

export type ActivityItem =
  | ({ type: "expense" } & ActivityExpense)
  | ({ type: "payment" } & ActivityPayment);

export function buildActivity(
  expenses: ActivityExpense[],
  payments: ActivityPayment[],
  limit = 5
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...expenses.map((e): ActivityItem => ({ type: "expense", ...e })),
    ...payments.map((p): ActivityItem => ({ type: "payment", ...p })),
  ];
  return items
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
