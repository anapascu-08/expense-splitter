import { baniToInput, rateMicrosToInput, convertToBase } from "@/lib/money";
import { categoryLabel } from "@/lib/categories";
import type { MemberBalance } from "@/lib/balances";

// RFC 4180: quote a field if it contains a comma, double-quote or newline;
// escape embedded quotes by doubling them. Rows are joined with CRLF.
function csvField(value: string): string {
  return /[",\n\r]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}

export const SPLIT_MODE_LABEL: Record<string, string> = {
  EQUAL: "egal",
  EXACT: "sume exacte",
  PERCENT: "procente",
  SHARES: "cote",
};

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type ExportExpense = {
  createdAt: Date;
  description: string;
  amount: number; // bani, in the expense's own currency
  currency: string;
  rateMicros: number;
  paidByName: string;
  category: string | null;
  splitMode: string;
  participantNames: string[];
};

export function expensesToCsv(
  expenses: ExportExpense[],
  baseCurrency = "RON"
): string {
  const header = [
    "Data",
    "Descriere",
    "Sumă",
    "Valută",
    "Curs",
    `Sumă (${baseCurrency})`,
    "Plătit de",
    "Categorie",
    "Împărțire",
    "Participanți",
  ];
  const rows = expenses.map((e) => [
    isoDate(e.createdAt),
    e.description,
    baniToInput(e.amount),
    e.currency,
    rateMicrosToInput(e.rateMicros),
    baniToInput(convertToBase(e.amount, e.rateMicros)),
    e.paidByName,
    categoryLabel(e.category) ?? "",
    SPLIT_MODE_LABEL[e.splitMode] ?? e.splitMode,
    e.participantNames.join(", "),
  ]);
  return toCsv([header, ...rows]);
}

export function balancesToCsv(
  balances: MemberBalance[],
  baseCurrency = "RON"
): string {
  const header = [
    "Membru",
    `Plătit (${baseCurrency})`,
    `Datorat (${baseCurrency})`,
    `Trimis (${baseCurrency})`,
    `Primit (${baseCurrency})`,
    `Net (${baseCurrency})`,
  ];
  const rows = balances.map((b) => [
    b.name,
    baniToInput(b.paid),
    baniToInput(b.owed),
    baniToInput(b.sent),
    baniToInput(b.received),
    baniToInput(b.net),
  ]);
  return toCsv([header, ...rows]);
}
