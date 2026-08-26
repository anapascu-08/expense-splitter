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
