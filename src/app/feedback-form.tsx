"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/app/form-state";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
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

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className={rowClassName}>{children}</div>
      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
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
