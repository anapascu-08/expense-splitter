import { describe, it, expect } from "vitest";
import { toCsv, expensesToCsv, balancesToCsv } from "@/lib/csv";
import type { MemberBalance } from "@/lib/balances";

describe("toCsv", () => {
  it("joins fields with commas and rows with CRLF", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });

  it("quotes fields containing a comma, quote, or newline (RFC 4180)", () => {
    expect(toCsv([["a,b", "c"]])).toBe('"a,b",c');
    expect(toCsv([['he said "hi"']])).toBe('"he said ""hi"""');
    expect(toCsv([["line1\nline2"]])).toBe('"line1\nline2"');
  });

  it("does not quote plain fields and preserves surrounding spaces", () => {
    expect(toCsv([[" padded ", "plain"]])).toBe(" padded ,plain");
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});

describe("expensesToCsv", () => {
  it("writes a header plus one row per expense, with currency, rate and base-currency amount", () => {
    const csv = expensesToCsv(
      [
        {
          createdAt: new Date("2026-08-28T09:30:00.000Z"),
          description: "Cazare",
          amount: 30000,
          currency: "RON",
          rateMicros: 1_000_000,
          paidByName: "Alice",
          category: "cazare",
          splitMode: "EQUAL",
          participantNames: ["Alice", "Bob", "Cristi"],
        },
        {
          createdAt: new Date("2026-08-29T12:00:00.000Z"),
          description: "Benzină, plin",
          amount: 12000,
          currency: "EUR",
          rateMicros: 4_982_300,
          paidByName: "Bob",
          category: null,
          splitMode: "SHARES",
          participantNames: ["Alice", "Bob"],
        },
      ],
      "RON"
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Data,Descriere,Sumă,Valută,Curs,Sumă (RON),Plătit de,Categorie,Împărțire,Participanți"
    );
    expect(lines[1]).toBe(
      '2026-08-28,Cazare,300.00,RON,1,300.00,Alice,Cazare,egal,"Alice, Bob, Cristi"'
    );
    // foreign currency: rate shown trimmed, converted amount in the base currency
    expect(lines[2]).toBe(
      '2026-08-29,"Benzină, plin",120.00,EUR,4.9823,597.88,Bob,,cote,"Alice, Bob"'
    );
  });

  it("puts the base currency in the converted-amount header", () => {
    const [header] = expensesToCsv([], "EUR").split("\r\n");
    expect(header).toContain("Sumă (EUR)");
  });

  it("emits just the header when there are no expenses", () => {
    expect(expensesToCsv([]).split("\r\n")).toHaveLength(1);
  });
});

describe("balancesToCsv", () => {
  const balances: MemberBalance[] = [
    { memberId: "a", name: "Alice", paid: 30000, owed: 10000, sent: 0, received: 5000, net: 15000 },
    { memberId: "b", name: "Bob", paid: 0, owed: 10000, sent: 5000, received: 0, net: -5000 },
  ];

  it("writes a header plus one row per member, with signed net", () => {
    const lines = balancesToCsv(balances, "RON").split("\r\n");
    expect(lines[0]).toBe(
      "Membru,Plătit (RON),Datorat (RON),Trimis (RON),Primit (RON),Net (RON)"
    );
    expect(lines[1]).toBe("Alice,300.00,100.00,0.00,50.00,150.00");
    expect(lines[2]).toBe("Bob,0.00,100.00,50.00,0.00,-50.00");
  });

  it("labels the money columns with the group's base currency", () => {
    const [header] = balancesToCsv(balances, "EUR").split("\r\n");
    expect(header).toBe(
      "Membru,Plătit (EUR),Datorat (EUR),Trimis (EUR),Primit (EUR),Net (EUR)"
    );
  });
});
