import { describe, it, expect } from "vitest";
import {
  splitAmount,
  computeBalances,
  computeSettlement,
  type ExpenseForBalance,
  type MemberBalance,
} from "@/lib/balances";

// Characterization tests: pin the CURRENT behavior of the balance engine.

describe("splitAmount", () => {
  it("splits evenly when it divides cleanly", () => {
    expect(splitAmount(100, [1, 1])).toEqual([50, 50]);
    expect(splitAmount(1000, [1, 2, 1])).toEqual([250, 500, 250]);
  });

  it("gives the leftover bani to earliest participants by remainder, then index", () => {
    expect(splitAmount(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(splitAmount(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(splitAmount(101, [1, 1])).toEqual([51, 50]);
  });

  it("always sums back to the total", () => {
    for (const [total, weights] of [
      [100, [1, 1, 1]],
      [9999, [1, 2, 3, 4]],
      [7, [5, 1, 1]],
      [12345, [1, 1, 1, 1, 1, 1, 1]],
    ] as const) {
      const parts = splitAmount(total, [...weights]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("weights the split proportionally (SHARES mode)", () => {
    expect(splitAmount(300, [1, 2])).toEqual([100, 200]);
  });

  it("returns all zeros when total weight is zero", () => {
    expect(splitAmount(100, [0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("returns an empty array for no participants", () => {
    expect(splitAmount(0, [])).toEqual([]);
  });
});

const members = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Bob" },
];

function balanceOf(list: MemberBalance[], id: string): MemberBalance {
  const found = list.find((b) => b.memberId === id);
  if (!found) throw new Error(`no balance for ${id}`);
  return found;
}

describe("computeBalances", () => {
  it("nets what a member paid against their share of what they joined", () => {
    const expenses: ExpenseForBalance[] = [
      {
        amount: 100,
        paidById: "a",
        participants: [
          { memberId: "a", weight: 1 },
          { memberId: "b", weight: 1 },
        ],
      },
    ];
    const balances = computeBalances(members, expenses);
    expect(balanceOf(balances, "a")).toMatchObject({ paid: 100, owed: 50, net: 50 });
    expect(balanceOf(balances, "b")).toMatchObject({ paid: 0, owed: 50, net: -50 });
  });

  it("folds recorded payments into the net (sent reduces debt, received reduces credit)", () => {
    const expenses: ExpenseForBalance[] = [
      {
        amount: 100,
        paidById: "a",
        participants: [
          { memberId: "a", weight: 1 },
          { memberId: "b", weight: 1 },
        ],
      },
    ];
    const payments = [{ amount: 30, fromId: "b", toId: "a" }];
    const balances = computeBalances(members, expenses, payments);
    expect(balanceOf(balances, "a")).toMatchObject({ received: 30, net: 20 });
    expect(balanceOf(balances, "b")).toMatchObject({ sent: 30, net: -20 });
  });

  it("counts the payer even when the expense has no participants", () => {
    const expenses: ExpenseForBalance[] = [
      { amount: 100, paidById: "a", participants: [] },
    ];
    const balances = computeBalances(members, expenses);
    expect(balanceOf(balances, "a")).toMatchObject({ paid: 100, owed: 0, net: 100 });
  });

  it("net across all members sums to zero", () => {
    const expenses: ExpenseForBalance[] = [
      {
        amount: 100,
        paidById: "a",
        participants: [
          { memberId: "a", weight: 1 },
          { memberId: "b", weight: 1 },
        ],
      },
      {
        amount: 37,
        paidById: "b",
        participants: [
          { memberId: "a", weight: 1 },
          { memberId: "b", weight: 1 },
        ],
      },
    ];
    const balances = computeBalances(members, expenses);
    expect(balances.reduce((s, b) => s + b.net, 0)).toBe(0);
  });
});

describe("computeSettlement", () => {
  it("produces one transfer from the debtor to the creditor", () => {
    const balances: MemberBalance[] = [
      { memberId: "a", name: "Ana", paid: 100, owed: 50, sent: 0, received: 0, net: 50 },
      { memberId: "b", name: "Bob", paid: 0, owed: 50, sent: 0, received: 0, net: -50 },
    ];
    expect(computeSettlement(balances)).toEqual([
      { fromId: "b", fromName: "Bob", toId: "a", toName: "Ana", amount: 50 },
    ]);
  });

  it("greedily matches the largest debtor with the largest creditor", () => {
    const balances: MemberBalance[] = [
      { memberId: "a", name: "Ana", paid: 0, owed: 0, sent: 0, received: 0, net: 30 },
      { memberId: "b", name: "Bob", paid: 0, owed: 0, sent: 0, received: 0, net: -10 },
      { memberId: "c", name: "Cip", paid: 0, owed: 0, sent: 0, received: 0, net: -20 },
    ];
    expect(computeSettlement(balances)).toEqual([
      { fromId: "c", fromName: "Cip", toId: "a", toName: "Ana", amount: 20 },
      { fromId: "b", fromName: "Bob", toId: "a", toName: "Ana", amount: 10 },
    ]);
  });

  it("returns nothing when everyone is settled", () => {
    const balances: MemberBalance[] = [
      { memberId: "a", name: "Ana", paid: 0, owed: 0, sent: 0, received: 0, net: 0 },
    ];
    expect(computeSettlement(balances)).toEqual([]);
  });
});
