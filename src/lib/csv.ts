import { baniToInput, rateMicrosToInput, convertToBase } from "@/lib/money";
import { categoryLabel } from "@/lib/categories";
import type { MemberBalance } from "@/lib/balances";

// The app is Romanian throughout (formatBani -> "1.234,56"), and spreadsheets
// in a comma-decimal locale expect ";" as the field separator and "," as the
// decimal mark. So this writes ";"-separated rows with comma decimals rather
// than RFC 4180's comma-separated / dot-decimal form.
const DELIM = ";";

// Quote a field if it contains the separator, a double-quote or a newline
// (escaping embedded quotes by doubling them), and neutralise spreadsheet
// formula injection: a leading "=", "@", tab or CR, or a leading "+"/"-" that
// isn't the start of a number, gets a "'" prefix so Excel treats the cell as
// text. Real negative amounts like "-50,00" are left alone.
function csvField(value: string): string {
  const looksNumeric = /^[+-]?\d/.test(value);
  const armed = /^[=@\t\r]/.test(value) || (/^[+-]/.test(value) && !looksNumeric);
  const v = armed ? `'${value}` : value;
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// "1234.56" (from baniToInput / rateMicrosToInput) -> "1234,56" for the sheet.
function roNum(value: string): string {
  return value.replace(".", ",");
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(DELIM)).join("\r\n");
}

export const SPLIT_MODE_LABEL: Record<string, string> = {
  EQUAL: "egal",
  EXACT: "sume exacte",
  PERCENT: "procente",
  SHARES: "cote",
};

// Local (Europe/Bucharest) calendar date, not UTC: an expense entered at
// 01:30 local time belongs to that day, not the previous one.
export function isoDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
  }).format(date);
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
    roNum(baniToInput(e.amount)),
    e.currency,
    roNum(rateMicrosToInput(e.rateMicros)),
    roNum(baniToInput(convertToBase(e.amount, e.rateMicros))),
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
    roNum(baniToInput(b.paid)),
    roNum(baniToInput(b.owed)),
    roNum(baniToInput(b.sent)),
    roNum(baniToInput(b.received)),
    roNum(baniToInput(b.net)),
  ]);
  return toCsv([header, ...rows]);
}
