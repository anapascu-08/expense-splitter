// Return type for Server Actions that back a form with inline feedback.
// `undefined` is the initial state (nothing submitted yet).
export type FormState = { error: string } | { ok: string } | undefined;
