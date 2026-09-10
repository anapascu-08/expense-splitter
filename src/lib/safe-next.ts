// Only allow redirecting to same-origin absolute paths. Reject protocol-relative
// ("//evil.com") and the backslash variants ("/\evil.com", "\evil.com") that
// browsers normalise to "//" when following a Location header.
export function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

// Build a "/login?next=…" target for a guard that has no session, dropping the
// query when the destination is just "/" (no point round-tripping to the home
// page). The path is sanitised through safeNext first.
export function loginRedirect(next?: string): string {
  const dest = safeNext(next);
  return dest === "/" ? "/login" : `/login?next=${encodeURIComponent(dest)}`;
}
