import { describe, it, expect } from "vitest";
import { renderTablePdf, expensesToPdf, balancesToPdf } from "@/lib/pdf";
import type { MemberBalance } from "@/lib/balances";

function latin1(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

const COLS = [
  { header: "A", width: 100 },
  { header: "B", width: 100 },
];

describe("renderTablePdf", () => {
  it("emits a well-formed PDF shell", () => {
    const pdf = latin1(
      renderTablePdf({ title: "T", columns: COLS, rows: [["x", "y"]] })
    );
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    expect(pdf).toContain("/Type /Pages");
    expect(pdf).toContain("/BaseFont /Helvetica");
    expect(pdf).toContain("/BaseFont /Helvetica-Bold");
    expect(pdf).toContain("/Encoding /WinAnsiEncoding");
  });

  it("points startxref at the xref table", () => {
    const pdf = latin1(renderTablePdf({ title: "T", columns: COLS, rows: [] }));
    const m = pdf.match(/startxref\n(\d+)\n%%EOF/);
    expect(m).not.toBeNull();
    const off = Number(m![1]);
    expect(pdf.slice(off, off + 4)).toBe("xref");
  });

  it("declares an accurate /Length for every content stream", () => {
    const pdf = latin1(
      renderTablePdf({ title: "T", columns: COLS, rows: [["x", "y"]] })
    );
    const re = /<< \/Length (\d+) >>\nstream\n/g;
    let m: RegExpExecArray | null;
    let seen = 0;
    while ((m = re.exec(pdf))) {
      seen++;
      const len = Number(m[1]);
      const start = m.index + m[0].length;
      expect(pdf.slice(start + len, start + len + 10)).toBe("\nendstream");
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("paginates long tables into multiple pages", () => {
    const rows = Array.from({ length: 65 }, (_, i) => [`r${i}`, "v"]);
    const pdf = latin1(renderTablePdf({ title: "T", columns: COLS, rows }));
    expect(pdf).toContain("/Count 3");
    expect((pdf.match(/\/MediaBox /g) ?? []).length).toBe(3);
  });

  it("keeps a single page for a short table", () => {
    const pdf = latin1(
      renderTablePdf({ title: "T", columns: COLS, rows: [["x", "y"]] })
    );
    expect(pdf).toContain("/Count 1");
    expect((pdf.match(/\/MediaBox /g) ?? []).length).toBe(1);
  });

  it("still produces one page when there are no rows", () => {
    const pdf = latin1(renderTablePdf({ title: "T", columns: COLS, rows: [] }));
    expect(pdf).toContain("/Count 1");
  });

  it("escapes parentheses and backslashes in text", () => {
    const pdf = latin1(
      renderTablePdf({ title: "a(b)c\\d", columns: COLS, rows: [] })
    );
    expect(pdf).toContain("(a\\(b\\)c\\\\d) Tj");
  });

  it("transliterates characters outside WinAnsi but keeps Latin-1 ones", () => {
    const pdf = latin1(
      renderTablePdf({ title: "T", columns: COLS, rows: [["Ștefan îâ", "v"]] })
    );
    expect(pdf).toContain("(Stefan \xEE\xE2) Tj");
    expect(pdf).not.toMatch(/[Ā-￿]/);
  });
});

describe("expensesToPdf / balancesToPdf", () => {
  it("renders expenses with a header row and data", () => {
    const pdf = latin1(
      expensesToPdf(
        [
          {
            createdAt: new Date("2026-08-28T09:30:00.000Z"),
            description: "Cazare",
            amount: 30000,
            currency: "EUR",
            rateMicros: 4_982_300,
            paidByName: "Alice",
            category: "cazare",
            splitMode: "EQUAL",
            participantNames: ["Alice", "Bob"],
          },
        ],
        "Cheltuieli",
        "RON"
      )
    );
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("(Descriere) Tj");
    expect(pdf).toContain("(Cazare) Tj");
    // currency column + base-currency header (ă folded to a, parens escaped)
    expect(pdf).toContain("(EUR) Tj");
    expect(pdf).toContain("(Suma \\(RON\\)) Tj");
  });

  it("renders balances with a header row and member rows", () => {
    const balances: MemberBalance[] = [
      {
        memberId: "a",
        name: "Alice",
        paid: 30000,
        owed: 10000,
        sent: 0,
        received: 5000,
        net: 15000,
      },
    ];
    const pdf = latin1(balancesToPdf(balances));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("(Membru) Tj");
    expect(pdf).toContain("(Alice) Tj");
  });

  it("emits a header-only page when there are no expenses", () => {
    expect(latin1(expensesToPdf([]))).toContain("/Count 1");
  });
});
