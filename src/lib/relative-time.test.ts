import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "@/lib/relative-time";

const NOW = new Date("2026-09-09T12:00:00.000Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("formatRelativeTime", () => {
  it("is 'chiar acum' under a minute ago", () => {
    expect(formatRelativeTime(minutesAgo(0), NOW)).toBe("chiar acum");
    expect(formatRelativeTime(new Date(NOW.getTime() - 30_000), NOW)).toBe(
      "chiar acum"
    );
  });

  it("counts minutes with Romanian singular / plural / 'de' plural", () => {
    expect(formatRelativeTime(minutesAgo(1), NOW)).toBe("acum 1 minut");
    expect(formatRelativeTime(minutesAgo(5), NOW)).toBe("acum 5 minute");
    expect(formatRelativeTime(minutesAgo(19), NOW)).toBe("acum 19 minute");
    expect(formatRelativeTime(minutesAgo(20), NOW)).toBe("acum 20 de minute");
    expect(formatRelativeTime(minutesAgo(59), NOW)).toBe("acum 59 de minute");
  });

  it("counts hours with Romanian singular / plural / 'de' plural", () => {
    expect(formatRelativeTime(hoursAgo(1), NOW)).toBe("acum 1 oră");
    expect(formatRelativeTime(hoursAgo(3), NOW)).toBe("acum 3 ore");
    expect(formatRelativeTime(hoursAgo(19), NOW)).toBe("acum 19 ore");
    expect(formatRelativeTime(hoursAgo(23), NOW)).toBe("acum 23 de ore");
  });

  it("counts days, singular and plural, up to a week", () => {
    expect(formatRelativeTime(daysAgo(1), NOW)).toBe("acum 1 zi");
    expect(formatRelativeTime(daysAgo(3), NOW)).toBe("acum 3 zile");
    expect(formatRelativeTime(daysAgo(6), NOW)).toBe("acum 6 zile");
  });

  it("falls back to an absolute date a week or more in the past", () => {
    expect(formatRelativeTime(daysAgo(7), NOW)).toBe("02.09.2026");
    expect(formatRelativeTime(new Date("2026-01-15T09:00:00Z"), NOW)).toBe(
      "15.01.2026"
    );
  });

  it("treats a future date as 'chiar acum' rather than a negative count", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 60_000), NOW)).toBe(
      "chiar acum"
    );
  });
});
