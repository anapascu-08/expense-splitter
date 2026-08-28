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
