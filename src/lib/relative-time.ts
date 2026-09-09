// Human-readable Romanian relative time for the activity feed ("acum 5
// minute", "acum 2 zile"), falling back to an absolute date past a week.
// Pure + deterministic: callers pass `now` explicitly, and the fallback date
// is formatted in Europe/Bucharest so it matches what the user's clock shows
// (and doesn't depend on the server's timezone).

const dateFmt = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

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

  return dateFmt.format(date);
}
