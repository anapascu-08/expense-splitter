// Amounts are stored as integer "bani" (1 RON = 100 bani) to avoid float rounding issues.

import { currencySymbol } from "@/lib/currencies";

export function toBani(ronInput: string): number {
  const value = Number.parseFloat(ronInput.replace(",", "."));
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
  const value = Number.parseFloat(percentInput.replace(",", "."));
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
  const value = Number.parseFloat(input.replace(",", "."));
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
  const value = Number.parseFloat(input.replace(",", "."));
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
