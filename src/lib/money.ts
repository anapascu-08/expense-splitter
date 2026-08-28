// Amounts are stored as integer "bani" (1 RON = 100 bani) to avoid float rounding issues.

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
