// Fixed set of supported currencies. A Group picks one base currency at
// creation; every Expense records its own currency plus a manual exchange rate
// so balances can be computed in the group's base currency (see lib/money).
// Codes/symbols/names live here so the forms, lists and exports stay in sync.

export const CURRENCY_CODES = [
  "RON",
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "HUF",
  "BGN",
  "PLN",
  "MDL",
  "TRY",
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "RON";

type CurrencyInfo = { symbol: string; name: string };

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  RON: { symbol: "lei", name: "Leu românesc" },
  EUR: { symbol: "€", name: "Euro" },
  USD: { symbol: "$", name: "Dolar american" },
  GBP: { symbol: "£", name: "Liră sterlină" },
  CHF: { symbol: "CHF", name: "Franc elvețian" },
  HUF: { symbol: "Ft", name: "Forint maghiar" },
  BGN: { symbol: "лв", name: "Leva bulgărească" },
  PLN: { symbol: "zł", name: "Zlot polonez" },
  MDL: { symbol: "L", name: "Leu moldovenesc" },
  TRY: { symbol: "₺", name: "Liră turcească" },
};

export function isCurrency(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value);
}

export function currencySymbol(code: string): string {
  return isCurrency(code) ? CURRENCIES[code].symbol : code;
}

// "EUR — Euro", for a <select> option or an export column.
export function currencyLabel(code: string): string {
  return isCurrency(code) ? `${code} — ${CURRENCIES[code].name}` : code;
}
