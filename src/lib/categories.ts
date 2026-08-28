// Fixed set of expense categories. Stored on Expense.category as one of these
// slugs (or null = uncategorised). Labels/icons live here so the form, the list
// and any summary stay in sync.

export const EXPENSE_CATEGORIES = [
  "mancare",
  "transport",
  "cazare",
  "bauturi",
  "activitati",
  "cumparaturi",
  "altele",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  mancare: "Mâncare",
  transport: "Transport",
  cazare: "Cazare",
  bauturi: "Băuturi",
  activitati: "Activități",
  cumparaturi: "Cumpărături",
  altele: "Altele",
};

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  mancare: "🍽️",
  transport: "🚗",
  cazare: "🏠",
  bauturi: "🍺",
  activitati: "🎟️",
  cumparaturi: "🛒",
  altele: "📦",
};

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function categoryLabel(value: string | null | undefined): string | null {
  return value && isExpenseCategory(value) ? CATEGORY_LABELS[value] : null;
}
