import { describe, it, expect } from "vitest";
import {
  CURRENCY_CODES,
  DEFAULT_CURRENCY,
  isCurrency,
  currencySymbol,
  currencyLabel,
} from "@/lib/currencies";

describe("currencies", () => {
  it("has RON as the default and includes it in the list", () => {
    expect(DEFAULT_CURRENCY).toBe("RON");
    expect(CURRENCY_CODES).toContain("RON");
  });

  it("isCurrency recognises known codes and rejects others", () => {
    expect(isCurrency("EUR")).toBe(true);
    expect(isCurrency("RON")).toBe(true);
    expect(isCurrency("eur")).toBe(false);
    expect(isCurrency("XYZ")).toBe(false);
    expect(isCurrency("")).toBe(false);
  });

  it("currencySymbol returns the symbol for a known code, the code itself otherwise", () => {
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("RON")).toBe("lei");
    expect(currencySymbol("XYZ")).toBe("XYZ");
  });

  it("currencyLabel pairs code and name", () => {
    expect(currencyLabel("EUR")).toBe("EUR — Euro");
    expect(currencyLabel("XYZ")).toBe("XYZ");
  });
});
