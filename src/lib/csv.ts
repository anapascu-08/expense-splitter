import { baniToInput } from "@/lib/money";
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

const SPLIT_MODE_LABEL: Record<string, string> = {
  EQUAL: "egal",
  EXACT: "sume exacte",
  PERCENT: "procente",
  SHARES: "cote",
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type ExportExpense = {
  createdAt: Date;
  description: string;
  amount: number; // bani
  paidByName: string;
  category: string | null;
  splitMode: string;
  participantNames: string[];
};

export function expensesToCsv(expenses: ExportExpense[]): string {
  const header = [
    "Data",
    "Descriere",
    "Sumă (RON)",
    "Plătit de",
    "Categorie",
    "Împărțire",
    "Participanți",
  ];
  const rows = expenses.map((e) => [
    isoDate(e.createdAt),
    e.description,
    baniToInput(e.amount),
    e.paidByName,
    categoryLabel(e.category) ?? "",
    SPLIT_MODE_LABEL[e.splitMode] ?? e.splitMode,
    e.participantNames.join(", "),
  ]);
  return toCsv([header, ...rows]);
}

export function balancesToCsv(balances: MemberBalance[]): string {
  const header = [
    "Membru",
    "Plătit (RON)",
    "Datorat (RON)",
    "Trimis (RON)",
    "Primit (RON)",
    "Net (RON)",
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
