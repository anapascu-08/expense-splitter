import { describe, it, expect } from "vitest";
import { buildActivity } from "@/lib/activity";

const d = (iso: string) => new Date(iso);

describe("buildActivity", () => {
  it("merges expenses and payments sorted newest first", () => {
    const items = buildActivity(
      [
        {
          id: "e1",
          description: "Cazare",
          amount: 30000,
          currency: "RON",
          createdAt: d("2026-09-01T10:00:00Z"),
          paidByName: "Alice",
        },
      ],
      [
        {
          id: "p1",
          amount: 5000,
          createdAt: d("2026-09-02T10:00:00Z"),
          fromName: "Bob",
          toName: "Alice",
        },
      ]
    );

    expect(items).toEqual([
      {
        type: "payment",
        id: "p1",
        amount: 5000,
        createdAt: d("2026-09-02T10:00:00Z"),
        fromName: "Bob",
        toName: "Alice",
      },
      {
        type: "expense",
        id: "e1",
        description: "Cazare",
        amount: 30000,
        currency: "RON",
        createdAt: d("2026-09-01T10:00:00Z"),
        paidByName: "Alice",
      },
    ]);
  });

  it("caps the result at `limit` items, keeping the most recent", () => {
    const expenses = [0, 1, 2, 3].map((i) => ({
      id: `e${i}`,
      description: `Exp ${i}`,
      amount: 1000,
      currency: "RON",
      createdAt: d(`2026-09-0${i + 1}T00:00:00Z`),
      paidByName: "Alice",
    }));

    const items = buildActivity(expenses, [], 2);

    expect(items.map((i) => i.id)).toEqual(["e3", "e2"]);
  });

  it("is empty for no expenses and no payments", () => {
    expect(buildActivity([], [])).toEqual([]);
  });

  it("defaults to a limit of 5", () => {
    const expenses = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      description: `Exp ${i}`,
      amount: 1000,
      currency: "RON",
      createdAt: d(`2026-09-01T00:00:0${i}Z`),
      paidByName: "Alice",
    }));

    expect(buildActivity(expenses, [])).toHaveLength(5);
  });
});
