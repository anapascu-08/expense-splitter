import { describe, it, expect } from "vitest";
import {
  groupTotal,
  spendByCategory,
  spendByPayer,
  type SummaryExpense,
} from "@/lib/summary";

const ex = (
  amount: number,
  category: string | null,
  paidById: string
): SummaryExpense => ({ amount, category, paidById });

describe("groupTotal", () => {
  it("sums every expense amount", () => {
    expect(groupTotal([ex(30000, "cazare", "a"), ex(12000, null, "b")])).toBe(42000);
  });

  it("is 0 for no expenses", () => {
    expect(groupTotal([])).toBe(0);
  });
});

describe("spendByCategory", () => {
  it("totals per category, largest first", () => {
    const rows = spendByCategory([
      ex(10000, "transport", "a"),
      ex(30000, "cazare", "a"),
      ex(5000, "transport", "b"),
    ]);
    expect(rows).toEqual([
      { category: "cazare", total: 30000 },
      { category: "transport", total: 15000 },
    ]);
  });

  it("folds missing or unknown categories under null", () => {
    const rows = spendByCategory([
      ex(10000, null, "a"),
      ex(2000, "not-a-real-category", "a"),
      ex(8000, "cazare", "b"),
    ]);
    expect(rows).toEqual([
      { category: null, total: 12000 },
      { category: "cazare", total: 8000 },
    ]);
  });

  it("is empty for no expenses", () => {
    expect(spendByCategory([])).toEqual([]);
  });
});

describe("spendByPayer", () => {
  it("totals what each member paid, largest first", () => {
    const rows = spendByPayer([
      ex(30000, "cazare", "a"),
      ex(12000, "transport", "b"),
      ex(3000, null, "a"),
    ]);
    expect(rows).toEqual([
      { memberId: "a", total: 33000 },
      { memberId: "b", total: 12000 },
    ]);
  });

  it("is empty for no expenses", () => {
    expect(spendByPayer([])).toEqual([]);
  });
});
