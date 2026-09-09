"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useActionState,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import type { FormState } from "@/app/form-state";

type Markable = {
  name?: string;
  "aria-describedby"?: string;
  children?: ReactNode;
};

// Walks the form's fields (recursing into wrappers like <label>) and adds
// aria-invalid + aria-describedby to whichever ones are named in `fields`.
function markInvalid(
  node: ReactNode,
  fields: Set<string>,
  errorId: string
): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement<Markable>(child)) return child;
    const { name, "aria-describedby": describedBy, children } = child.props;
    const patch: Partial<Markable> & { "aria-invalid"?: true } = {};
    if (name && fields.has(name)) {
      patch["aria-invalid"] = true;
      patch["aria-describedby"] = describedBy
        ? `${describedBy} ${errorId}`
        : errorId;
    }
    if (children !== undefined) {
      patch.children = markInvalid(children, fields, errorId);
    }
    return cloneElement(child, patch);
  });
}

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  /** Extra classes for the inner row that wraps the caller's fields. */
  rowClassName?: string;
};

// Wraps a plain Server Action form and shows its result inline: the error
// text under the fields, or a discreet success note that fades after a moment.
// React resets the (uncontrolled) fields itself once the action resolves.
export function FeedbackForm({ action, children, rowClassName }: Props) {
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    undefined
  );
  const errorId = useId();
  // Auto-dismiss the success note ~3s after it appears. `state` is a fresh
  // object per submit, so comparing against `dismissed` tells a new success
  // from one that has already timed out.
  const [dismissed, setDismissed] = useState<FormState>(undefined);
  useEffect(() => {
    if (state && "ok" in state) {
      const t = setTimeout(() => setDismissed(state), 3000);
      return () => clearTimeout(t);
    }
  }, [state]);
  const showOk = state !== undefined && "ok" in state && state !== dismissed;

  const invalidFields =
    state && "error" in state && state.field
      ? new Set(Array.isArray(state.field) ? state.field : [state.field])
      : null;
  const fields = invalidFields
    ? markInvalid(children, invalidFields, errorId)
    : children;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className={rowClassName}>{fields}</div>
      {state && "error" in state && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {state.error}
        </p>
      )}
      {showOk && state && "ok" in state && (
        <p
          role="status"
          className="text-sm text-green-600 transition-opacity dark:text-green-400"
        >
          {state.ok}
        </p>
      )}
    </form>
  );
}
