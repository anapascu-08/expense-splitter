export type ExpenseForBalance = {
  amount: number;
  paidById: string;
  participants: { memberId: string }[];
};

export type MemberBalance = {
  memberId: string;
  name: string;
  paid: number;
  owed: number;
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
  expenses: ExpenseForBalance[]
): MemberBalance[] {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  for (const m of members) {
    paid.set(m.id, 0);
    owed.set(m.id, 0);
  }

  for (const expense of expenses) {
    paid.set(expense.paidById, (paid.get(expense.paidById) ?? 0) + expense.amount);

    const participantCount = expense.participants.length;
    if (participantCount === 0) continue;

    const baseShare = Math.floor(expense.amount / participantCount);
    let remainder = expense.amount - baseShare * participantCount;

    for (const participant of expense.participants) {
      let share = baseShare;
      if (remainder > 0) {
        share += 1;
        remainder -= 1;
      }
      owed.set(participant.memberId, (owed.get(participant.memberId) ?? 0) + share);
    }
  }

  return members.map((m) => {
    const p = paid.get(m.id) ?? 0;
    const o = owed.get(m.id) ?? 0;
    return { memberId: m.id, name: m.name, paid: p, owed: o, net: p - o };
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
