// Amounts are stored as integer "bani" (1 RON = 100 bani) to avoid float rounding issues.

import { currencySymbol } from "@/lib/currencies";

// Parse a human-typed number that may be in Romanian format ("1.234,56"),
// English format ("1,234.56" / "1234.56"), or plain ("1234,56" / "1234").
// Returns NaN for junk (callers clamp to 0).
//
// Disambiguation:
//  - both "." and "," present  -> the LAST one is the decimal separator, the
//    other is thousands grouping ("1.234,56" -> 1234.56, "1,234.56" -> 1234.56).
//  - one separator, repeated    -> thousands grouping ("1.234.567" -> 1234567).
//  - one separator, once, with exactly 3 trailing digits and a 1-3 digit lead
//    -> ambiguous; treated as thousands to match how amounts are displayed
//    ("1.500" -> 1500, "1.006" -> 1006). The expense form shows the parsed
//    amount back so this stays visible.
//  - otherwise                  -> decimal ("12,34" -> 12.34, "1.5" -> 1.5).
export function parseDecimal(input: string): number {
  const cleaned = input.replace(/[^\d.,-]/g, "");
  const sign = cleaned.trimStart().startsWith("-") ? -1 : 1;
  const digits = cleaned.replace(/-/g, "");
  if (digits === "") return NaN;

  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");

  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    normalized = digits.split(thouSep).join("").replace(decSep, ".");
  } else if (lastDot !== -1) {
    normalized = normalizeSingleSeparator(digits, ".");
  } else if (lastComma !== -1) {
    normalized = normalizeSingleSeparator(digits, ",");
  } else {
    normalized = digits;
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? sign * value : NaN;
}

// `sep` occurs only as itself in `s` (no other separator). Decide whether it's
// a decimal point or thousands grouping and return a "."-decimal string.
function normalizeSingleSeparator(s: string, sep: string): string {
  const parts = s.split(sep);
  if (parts.length > 2) return parts.join(""); // repeated -> thousands
  const [head, tail] = parts;
  const looksGrouped = tail.length === 3 && /^[1-9]\d{0,2}$/.test(head);
  return looksGrouped ? head + tail : `${head}.${tail}`;
}

export function toBani(ronInput: string): number {
  const value = parseDecimal(ronInput);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function formatBani(bani: number): string {
  return (bani / 100).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Amount + currency symbol, e.g. "1.234,56 lei" / "49,90 €". The symbol comes
// from lib/currencies; an unknown code falls back to the code itself.
export function formatMoney(bani: number, currencyCode: string): string {
  return `${formatBani(bani)} ${currencySymbol(currencyCode)}`;
}

// Plain "12.34" string for pre-filling a number/decimal input (round-trips through toBani).
export function baniToInput(bani: number): string {
  return (bani / 100).toFixed(2);
}

// Percentages are stored as basis points (1% = 100 bp) so 33.33% survives without float drift.
export function toBasisPoints(percentInput: string): number {
  const value = parseDecimal(percentInput);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function basisPointsToInput(bp: number): string {
  return (bp / 100).toFixed(2);
}

export const FULL_PERCENT_BP = 10000;

// Shares are small whole numbers: a participant with 2 shares owes twice as much
// as one with 1. Anything non-integer is rounded to the nearest whole share.
export function toShares(input: string): number {
  const value = parseDecimal(input);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function sharesToInput(shares: number): string {
  return String(shares);
}

// Exchange rates are stored as integer "micros": how many base-currency units
// one expense-currency unit is worth, times 1_000_000. So RON->RON is exactly
// RATE_SCALE, and 1 EUR = 4.9823 RON is 4_982_300. Six decimals is plenty for
// a manually entered rate and keeps the value an integer in the DB.
export const RATE_SCALE = 1_000_000;

export function toRateMicros(input: string): number {
  const value = parseDecimal(input);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * RATE_SCALE);
}

// "4.9823" for pre-filling a rate input; trailing zeros trimmed, "1" for parity.
export function rateMicrosToInput(micros: number): string {
  return (micros / RATE_SCALE)
    .toFixed(6)
    .replace(/\.?0+$/, "");
}

// Convert an amount in the expense's own currency (bani) to base-currency bani,
// rounded to the nearest whole bani. `rateMicros` of RATE_SCALE is a no-op.
export function convertToBase(amountBani: number, rateMicros: number): number {
  return Math.round((amountBani * rateMicros) / RATE_SCALE);
}
