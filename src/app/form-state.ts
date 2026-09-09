// Return type for Server Actions that back a form with inline feedback.
// `undefined` is the initial state (nothing submitted yet). `field` names the
// input(s) the error applies to (its `name` attribute) so the form can mark
// them `aria-invalid` — omit it for errors that aren't tied to one field
// (e.g. an authorization check).
export type FormState =
  | { error: string; field?: string | string[] }
  | { ok: string }
  | undefined;
