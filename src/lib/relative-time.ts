// Human-readable Romanian relative time for the activity feed ("acum 5
// minute", "acum 2 zile"), falling back to an absolute date past a week.
// Pure + deterministic: callers pass `now` explicitly instead of this
// reading the clock, and the fallback is built from UTC fields so the
// result doesn't depend on the server's local timezone.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Romanian count phrase: 1 -> singular; 2..19 -> bare plural; a number whose
// last two digits are 00 or 20..99 -> "de" + plural ("20 de minute").
function count(n: number, one: string, many: string): string {
  if (n === 1) return `${n} ${one}`;
  const lastTwo = n % 100;
  const needsDe = lastTwo === 0 || lastTwo >= 20;
  return `${n} ${needsDe ? "de " : ""}${many}`;
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "chiar acum";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `acum ${count(diffMin, "minut", "minute")}`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `acum ${count(diffHours, "oră", "ore")}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `acum ${count(diffDays, "zi", "zile")}`;

  return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
}
