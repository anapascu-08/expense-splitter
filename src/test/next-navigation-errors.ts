import { expect } from "vitest";

// The integration setup mocks `next/navigation` so that redirect()/notFound()
// throw these instead of Next's internal control-flow errors, letting tests
// assert on them directly.

export class RedirectError extends Error {
  constructor(public url: string) {
    super(`redirect(${url})`);
    this.name = "RedirectError";
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("notFound()");
    this.name = "NotFoundError";
  }
}

// Run something expected to redirect and return the target url.
export async function catchRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof RedirectError) return err.url;
    throw err;
  }
  throw new Error("expected a redirect, but the call returned normally");
}

export async function expectNotFound(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(NotFoundError);
}
