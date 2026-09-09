// Human-readable Romanian relative time for the activity feed ("acum 5
// minute", "acum 2 zile"), falling back to an absolute date past a week.
// Pure + deterministic: callers pass `now` explicitly instead of this
// reading the clock, and the fallback is built from UTC fields so the
// result doesn't depend on the server's local timezone.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "chiar acum";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `acum ${diffMin} ${diffMin === 1 ? "minut" : "minute"}`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `acum ${diffHours} ${diffHours === 1 ? "oră" : "ore"}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `acum ${diffDays} ${diffDays === 1 ? "zi" : "zile"}`;

  return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
}
