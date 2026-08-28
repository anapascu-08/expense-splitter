export type ExpenseForBalance = {
  amount: number;
  paidById: string;
  participants: { memberId: string; weight: number }[];
};

export type PaymentForBalance = {
  amount: number;
  fromId: string;
  toId: string;
};

// Split `total` (bani) proportionally to `weights`, returning whole bani that
// sum to exactly `total`. Leftover bani from integer division go to the
// participants with the largest fractional remainder (ties broken by order).
// EQUAL split is the case where every weight is 1.
export function splitAmount(total: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return weights.map(() => 0);

  const shares = weights.map((w) => Math.floor((total * w) / totalWeight));
  let leftover = total - shares.reduce((sum, s) => sum + s, 0);

  const byRemainder = weights
    .map((w, i) => ({ i, remainder: (total * w) % totalWeight }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

  for (let k = 0; k < byRemainder.length && leftover > 0; k += 1) {
    shares[byRemainder[k].i] += 1;
    leftover -= 1;
  }

  return shares;
}

export type MemberBalance = {
  memberId: string;
  name: string;
  paid: number;
  owed: number;
  // Real payments made / received while settling up.
  sent: number;
  received: number;
  // net > 0 => is owed money, net < 0 => owes money.
  net: number;
};

export type Transfer = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
};

export function computeBalances(
  members: { id: string; name: string }[],
  expenses: ExpenseForBalance[],
  payments: PaymentForBalance[] = []
): MemberBalance[] {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  const sent = new Map<string, number>();
  const received = new Map<string, number>();
  for (const m of members) {
    paid.set(m.id, 0);
    owed.set(m.id, 0);
    sent.set(m.id, 0);
    received.set(m.id, 0);
  }

  for (const expense of expenses) {
    paid.set(expense.paidById, (paid.get(expense.paidById) ?? 0) + expense.amount);

    if (expense.participants.length === 0) continue;

    const shares = splitAmount(
      expense.amount,
      expense.participants.map((p) => p.weight)
    );

    expense.participants.forEach((participant, i) => {
      owed.set(participant.memberId, (owed.get(participant.memberId) ?? 0) + shares[i]);
    });
  }

  for (const payment of payments) {
    sent.set(payment.fromId, (sent.get(payment.fromId) ?? 0) + payment.amount);
    received.set(payment.toId, (received.get(payment.toId) ?? 0) + payment.amount);
  }

  return members.map((m) => {
    const p = paid.get(m.id) ?? 0;
    const o = owed.get(m.id) ?? 0;
    const s = sent.get(m.id) ?? 0;
    const r = received.get(m.id) ?? 0;
    // Paying someone reduces how much you owe; receiving reduces what you're owed.
    return { memberId: m.id, name: m.name, paid: p, owed: o, sent: s, received: r, net: p - o + s - r };
  });
}

// Greedy settle-up: repeatedly match the largest debtor with the largest creditor.
export function computeSettlement(balances: MemberBalance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ id: b.memberId, name: b.name, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ id: b.memberId, name: b.name, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      transfers.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }

  return transfers;
}
