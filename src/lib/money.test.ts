import { describe, it, expect } from "vitest";
import {
  toBani,
  formatBani,
  baniToInput,
  toBasisPoints,
  basisPointsToInput,
  toShares,
  sharesToInput,
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
