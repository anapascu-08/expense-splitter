import { describe, it, expect } from "vitest";
import {
  toBani,
  formatBani,
  formatMoney,
  baniToInput,
  toBasisPoints,
  basisPointsToInput,
  toShares,
  sharesToInput,
  toRateMicros,
  rateMicrosToInput,
  convertToBase,
  RATE_SCALE,
  FULL_PERCENT_BP,
} from "@/lib/money";

// Characterization tests: these pin the CURRENT behavior of the money helpers,
// not necessarily the ideal behavior. Edge cases worth noting are called out.

describe("toBani", () => {
  it("converts a plain RON string to integer bani", () => {
    expect(toBani("12.34")).toBe(1234);
    expect(toBani("100")).toBe(10000);
    expect(toBani("0")).toBe(0);
  });

  it("accepts a comma as decimal separator", () => {
    expect(toBani("12,34")).toBe(1234);
  });

  it("rounds to the nearest bani", () => {
    expect(toBani("1.006")).toBe(101);
    expect(toBani("1.004")).toBe(100);
  });

  it("KNOWN QUIRK: 1.005 rounds down because 1.005*100 is 100.4999… in IEEE754", () => {
    expect(toBani("1.005")).toBe(100);
  });

  it("returns 0 for non-numeric input", () => {
    expect(toBani("")).toBe(0);
    expect(toBani("abc")).toBe(0);
  });

  it("parses a leading number out of mixed input (parseFloat behavior)", () => {
    expect(toBani("12.34 lei")).toBe(1234);
  });

  it("does not clamp negatives", () => {
    expect(toBani("-5")).toBe(-500);
  });
});

describe("baniToInput / toBani round-trip", () => {
  it("round-trips whole-bani amounts", () => {
    for (const bani of [0, 1, 99, 100, 1234, 999999]) {
      expect(toBani(baniToInput(bani))).toBe(bani);
    }
  });

  it("baniToInput always has two decimals", () => {
    expect(baniToInput(100)).toBe("1.00");
    expect(baniToInput(5)).toBe("0.05");
  });
});

describe("formatBani", () => {
  it("formats with ro-RO grouping and two decimals", () => {
    // ro-RO uses '.' for thousands and ',' for decimals
    expect(formatBani(123456)).toBe("1.234,56");
    expect(formatBani(0)).toBe("0,00");
    expect(formatBani(5)).toBe("0,05");
  });
});

describe("formatMoney", () => {
  it("appends the currency symbol", () => {
    expect(formatMoney(123456, "RON")).toBe("1.234,56 lei");
    expect(formatMoney(4990, "EUR")).toBe("49,90 €");
  });

  it("falls back to the code for an unknown currency", () => {
    expect(formatMoney(100, "XYZ")).toBe("1,00 XYZ");
  });
});

describe("toRateMicros", () => {
  it("scales a decimal rate by 1_000_000", () => {
    expect(toRateMicros("4.9823")).toBe(4_982_300);
    expect(toRateMicros("1")).toBe(RATE_SCALE);
    expect(toRateMicros("4,9823")).toBe(4_982_300);
  });

  it("clamps non-positive and junk input to 0 (unlike toBani, which keeps negatives)", () => {
    expect(toRateMicros("0")).toBe(0);
    expect(toRateMicros("-2")).toBe(0);
    expect(toRateMicros("")).toBe(0);
    expect(toRateMicros("abc")).toBe(0);
  });
});

describe("rateMicrosToInput / toRateMicros round-trip", () => {
  it("trims trailing zeros", () => {
    expect(rateMicrosToInput(RATE_SCALE)).toBe("1");
    expect(rateMicrosToInput(1_500_000)).toBe("1.5");
    expect(rateMicrosToInput(4_982_300)).toBe("4.9823");
  });

  it("round-trips whole-micro rates", () => {
    for (const micros of [RATE_SCALE, 1_500_000, 4_982_300, 250_000]) {
      expect(toRateMicros(rateMicrosToInput(micros))).toBe(micros);
    }
  });
});

describe("convertToBase", () => {
  it("is a no-op at RATE_SCALE", () => {
    expect(convertToBase(10000, RATE_SCALE)).toBe(10000);
  });

  it("converts expense-currency bani to base-currency bani", () => {
    expect(convertToBase(10000, 4_982_300)).toBe(49823);
    expect(convertToBase(333, 4_982_300)).toBe(1659);
  });

  it("KNOWN QUIRK: half-bani rounds toward +Infinity (Math.round), not to even", () => {
    expect(convertToBase(5, 500_000)).toBe(3); // 2.5 -> 3
    expect(convertToBase(-5, 500_000)).toBe(-2); // -2.5 -> -2
  });
});

describe("toBasisPoints", () => {
  it("converts a percent string to basis points", () => {
    expect(toBasisPoints("33.33")).toBe(3333);
    expect(toBasisPoints("100")).toBe(FULL_PERCENT_BP);
    expect(toBasisPoints("0")).toBe(0);
  });

  it("accepts a comma separator and returns 0 for junk", () => {
    expect(toBasisPoints("12,5")).toBe(1250);
    expect(toBasisPoints("")).toBe(0);
  });
});

describe("basisPointsToInput / toBasisPoints round-trip", () => {
  it("round-trips values that are whole basis points", () => {
    for (const bp of [0, 1, 2500, 3333, 10000]) {
      expect(toBasisPoints(basisPointsToInput(bp))).toBe(bp);
    }
  });
});

describe("toShares", () => {
  it("parses whole share counts", () => {
    expect(toShares("1")).toBe(1);
    expect(toShares("3")).toBe(3);
  });

  it("rounds fractional input to the nearest whole share", () => {
    expect(toShares("2.4")).toBe(2);
    expect(toShares("2.5")).toBe(3);
  });

  it("returns 0 for non-numeric input", () => {
    expect(toShares("")).toBe(0);
    expect(toShares("abc")).toBe(0);
  });
});

describe("sharesToInput", () => {
  it("stringifies the number", () => {
    expect(sharesToInput(2)).toBe("2");
  });
});
