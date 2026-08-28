// Backing store for the mocked `next/headers` cookies() in integration tests.
// A real module so the vi.mock factory can import it without hoisting issues.

export type StoredCookie = { name: string; value: string };

export const cookieJar = new Map<string, string>();

export function resetCookies(): void {
  cookieJar.clear();
}

// Shape returned by the mocked `cookies()` — just the bits the app uses.
export function cookieStore() {
  return {
    get(name: string): StoredCookie | undefined {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    // The app calls set(name, value, options); the options arg is ignored here.
    set(name: string, value: string): void {
      cookieJar.set(name, value);
    },
    delete(name: string): void {
      cookieJar.delete(name);
    },
  };
}
