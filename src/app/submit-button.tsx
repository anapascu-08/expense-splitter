"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  /** Shown while the form's Server Action is running. */
  pendingLabel?: string;
  className?: string;
  variant?: "default" | "primary";
};

// Submit button that reflects the pending state of its enclosing <form> — the
// spec's "feedback imediat la fiecare acțiune". Must live inside a <form>.
export function SubmitButton({
  children,
  pendingLabel = "Se salvează…",
  className,
  variant = "default",
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className ?? (variant === "primary" ? "btn-primary" : "btn")}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
